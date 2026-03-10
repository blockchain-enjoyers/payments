/* ═══════════════════════════════════════════
   OmniFlow Flow Field
   Perlin noise particles for hero background.
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  const canvas = document.getElementById('flowCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const tablet = window.matchMedia('(min-width: 768px) and (max-width: 1279px)').matches;

  const PARTICLE_COUNT = mobile ? 80 : tablet ? 150 : 300;
  const ENABLE_MOUSE = !mobile;
  const FLOW_OPACITY_MULT = mobile ? 0.7 : 1.0;

  const COLORS = ['#1894E8', '#9F72FF', '#62E2A4', '#627eea', '#0052ff'];
  const TWO_PI = Math.PI * 2;
  const NOISE_SCALE = 0.003;
  const TIME_SCALE = 0.0005;
  const HORIZONTAL_BIAS = 0.3;
  const VORTEX_RADIUS = 200;

  let W, H;
  let mouseX = -9999, mouseY = -9999;
  let particles = [];
  let time = 0;
  let paused = false;
  let animId = null;

  // ── Simplex Noise ──
  const SimplexNoise = (() => {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const grad3 = [
      [1,1],[-1,1],[1,-1],[-1,-1],
      [1,0],[-1,0],[0,1],[0,-1],
      [1,1],[-1,1],[1,-1],[-1,-1]
    ];
    const perm = new Uint8Array(512);
    const permMod12 = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = 42;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = (s >>> 0) % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      permMod12[i] = perm[i] % 12;
    }
    function dot2(g, x, y) { return g[0] * x + g[1] * y; }
    function noise2D(xin, yin) {
      const si = (xin + yin) * F2;
      const i = Math.floor(xin + si);
      const j = Math.floor(yin + si);
      const t = (i + j) * G2;
      const x0 = xin - (i - t);
      const y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      const gi0 = permMod12[ii + perm[jj]];
      const gi1 = permMod12[ii + i1 + perm[jj + j1]];
      const gi2 = permMod12[ii + 1 + perm[jj + 1]];
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot2(grad3[gi0], x0, y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot2(grad3[gi1], x1, y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot2(grad3[gi2], x2, y2); }
      return 70 * (n0 + n1 + n2);
    }
    return { noise2D };
  })();

  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function getBgColor() {
    return getTheme() === 'dark' ? '#0B0D12' : '#FFFFFF';
  }

  function getBaseOpacity() {
    const base = getTheme() === 'dark' ? 0.35 : 0.20;
    return base * FLOW_OPACITY_MULT;
  }

  function getTrailAlpha() {
    return getTheme() === 'dark' ? 0.05 : 0.08;
  }

  class Particle {
    constructor() { this.reset(true); }

    reset(initial) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : Math.random() * H;
      this.prevX = this.x;
      this.prevY = this.y;
      this.speed = 1.5 + Math.random();
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.opacityBase = 0.15 + Math.random() * 0.2;
      this.lineWidth = 1 + Math.random();
    }

    update() {
      this.prevX = this.x;
      this.prevY = this.y;
      const noiseVal = SimplexNoise.noise2D(
        this.x * NOISE_SCALE,
        this.y * NOISE_SCALE + time * TIME_SCALE
      );
      let angle = noiseVal * TWO_PI * 2;
      let vx = Math.cos(angle) * this.speed + HORIZONTAL_BIAS;
      let vy = Math.sin(angle) * this.speed;

      if (ENABLE_MOUSE) {
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < VORTEX_RADIUS && dist > 1) {
          const strength = (1 - dist / VORTEX_RADIUS) * 3;
          const perpX = -dy / dist;
          const perpY = dx / dist;
          const blend = strength / (strength + 1);
          vx = vx * (1 - blend) + perpX * this.speed * 2 * blend;
          vy = vy * (1 - blend) + perpY * this.speed * 2 * blend;
        }
      }

      this.x += vx;
      this.y += vy;

      let wrapped = false;
      if (this.x > W) { this.x = 0; wrapped = true; }
      else if (this.x < 0) { this.x = W; wrapped = true; }
      if (this.y > H) { this.y = 0; wrapped = true; }
      else if (this.y < 0) { this.y = H; wrapped = true; }

      if (wrapped) {
        if (this.x <= 0 || this.x >= W) this.y = Math.random() * H;
        this.prevX = this.x;
        this.prevY = this.y;
      }
    }

    draw() {
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = hexToRGBA(this.color, this.opacityBase * getBaseOpacity() / 0.2);
      ctx.lineWidth = this.lineWidth;
      ctx.stroke();
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    const bg = getBgColor();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }
  }

  function animate() {
    if (paused) { animId = requestAnimationFrame(animate); return; }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getBgColor();
    ctx.fillRect(0, 0, W, H);

    time++;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles[i].update();
      particles[i].draw();
    }

    animId = requestAnimationFrame(animate);
  }

  if (ENABLE_MOUSE) {
    window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resize, 100);
  });

  window.addEventListener('omniflow:visibility', (e) => {
    paused = e.detail.hidden;
  });

  init();
  animate();
})();
