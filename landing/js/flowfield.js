/* ═══════════════════════════════════════════
   OmniFlow Flow Field
   Static Perlin noise rivers with mouse vortex.
   Trail array approach — no ghost artifacts.
   ═══════════════════════════════════════════ */

(function () {
  "use strict";

  const canvas = document.getElementById("flowCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reducedMotion) return;

  const mobile = window.matchMedia("(max-width: 767px)").matches;

  const PARTICLE_COUNT = mobile ? 150 : 300;
  const TRAIL_LENGTH = 30;

  const COLORS = ["#1894E8", "#9F72FF", "#62E2A4", "#627eea", "#0052ff"];
  const TWO_PI = Math.PI * 2;
  const NOISE_SCALE = 0.003;
  const HORIZONTAL_BIAS = 0.5;
  const VORTEX_RADIUS = 150;

  let W, H;
  let mouseX = -9999,
    mouseY = -9999;
  let particles = [];
  let time = 0;
  let paused = false;
  let animId = null;
  let bgColor = "#0B0D12";
  let lastTime = 0;
  let trailAccum = 0;

  // ── Simplex Noise ──
  const SimplexNoise = (() => {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const grad3 = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
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
    function dot2(g, x, y) {
      return g[0] * x + g[1] * y;
    }
    function noise2D(xin, yin) {
      const si = (xin + yin) * F2;
      const i = Math.floor(xin + si);
      const j = Math.floor(yin + si);
      const t = (i + j) * G2;
      const x0 = xin - (i - t);
      const y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; }
      else { i1 = 0; j1 = 1; }
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
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function updateBgColor() {
    bgColor = getTheme() === "dark" ? "#0B0D12" : "#FFFFFF";
  }

  class Particle {
    constructor() {
      this.trail = [];
      this.homeX = Math.random() * W;
      this.homeY = Math.random() * H;
      this.reset();
    }

    reset() {
      this.x = this.homeX;
      this.y = this.homeY;
      this.prevX = this.x;
      this.prevY = this.y;
      this.speed = 1.5 + Math.random();
      this.trail = [];
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.opacity = 0.3 + Math.random() * 0.2;
      this.lineWidth = 1 + Math.random();
    }

    update(dt) {
      this.prevX = this.x;
      this.prevY = this.y;

      // Static flow noise
      const noiseVal = SimplexNoise.noise2D(
        this.x * NOISE_SCALE,
        this.y * NOISE_SCALE,
      );
      let angle = noiseVal * TWO_PI * 2;

      let vx = Math.cos(angle) * this.speed + HORIZONTAL_BIAS;
      let vy = Math.sin(angle) * this.speed;

      // Mouse vortex
      const dx_m = this.x - mouseX;
      const dy_m = this.y - mouseY;
      const dist_m = Math.sqrt(dx_m * dx_m + dy_m * dy_m);
      if (dist_m < VORTEX_RADIUS && dist_m > 1) {
        const strength = (1 - dist_m / VORTEX_RADIUS) * 3;
        const perpX = -dy_m / dist_m;
        const perpY = dx_m / dist_m;
        const blend = strength / (strength + 1);
        vx = vx * (1 - blend) + perpX * this.speed * 2 * blend;
        vy = vy * (1 - blend) + perpY * this.speed * 2 * blend;
      }

      this.x += vx * dt;
      this.y += vy * dt;

      // Off-screen → restart from home
      if (this.x > W || this.x < 0 || this.y > H || this.y < 0) {
        this.x = this.homeX;
        this.y = this.homeY;
        this.prevX = this.x;
        this.prevY = this.y;
        this.trail = [];
      }

      // Trail push handled in animate() with throttling
    }

    draw() {
      const len = this.trail.length;
      if (len < 2) return;
      ctx.lineWidth = this.lineWidth;
      for (let i = 1; i < len; i++) {
        const age = (len - i) / len;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.strokeStyle = hexToRGBA(this.color, this.opacity * (1 - age));
        ctx.stroke();
      }
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    updateBgColor();
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }
  }

  function animate(timestamp) {
    if (paused) {
      lastTime = 0;
      animId = requestAnimationFrame(animate);
      return;
    }

    if (!lastTime) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / 16.667, 3.0); // normalize to 60fps, clamp

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Throttle trail points to ~60fps rate
    trailAccum += elapsed;
    const addTrail = trailAccum >= 16;
    if (addTrail) trailAccum = 0;

    time++;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles[i].update(dt);
      if (addTrail) {
        particles[i].trail.push({ x: particles[i].x, y: particles[i].y });
        if (particles[i].trail.length > TRAIL_LENGTH) particles[i].trail.shift();
      }
      particles[i].draw();
    }

    animId = requestAnimationFrame(animate);
  }

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener("mouseleave", () => {
    mouseX = -9999;
    mouseY = -9999;
  });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resize();
    }, 100);
  });

  window.addEventListener("omniflow:visibility", (e) => {
    paused = e.detail.hidden;
  });

  const observer = new MutationObserver(() => updateBgColor());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  init();
  animate();
})();
