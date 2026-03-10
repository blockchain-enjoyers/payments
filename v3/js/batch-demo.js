/* ═══════════════════════════════════════════
   OmniFlow Batch Demo Animation
   Animates table rows: Pending → Processing → Confirmed
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  const table = document.getElementById('batchTable');
  const timer = document.getElementById('batchTimer');
  if (!table || !timer) return;

  const statuses = Array.from(table.querySelectorAll('.batch__status'));
  let animated = false;

  const STATUS_FLOW = [
    { text: 'Processing', status: 'processing' },
    { text: 'Confirmed \u2713', status: 'confirmed' },
  ];

  function animateRow(statusEl, delay) {
    return new Promise((resolve) => {
      setTimeout(() => {
        statusEl.textContent = STATUS_FLOW[0].text;
        statusEl.setAttribute('data-status', STATUS_FLOW[0].status);

        setTimeout(() => {
          statusEl.textContent = STATUS_FLOW[1].text;
          statusEl.setAttribute('data-status', STATUS_FLOW[1].status);
          resolve();
        }, 600 + Math.random() * 400);
      }, delay);
    });
  }

  function runAnimation() {
    if (animated) return;
    animated = true;

    var startTime = performance.now();
    var timerFrame;

    function updateTimer() {
      var elapsed = (performance.now() - startTime) / 1000;
      timer.textContent = elapsed.toFixed(1) + 's';
      if (elapsed < 10) timerFrame = requestAnimationFrame(updateTimer);
    }
    updateTimer();

    var delays = [0, 400, 800, 1200, 1600];
    var promises = statuses.map(function(el, i) { return animateRow(el, delays[i]); });

    Promise.all(promises).then(function() {
      cancelAnimationFrame(timerFrame);
      var finalTime = (performance.now() - startTime) / 1000;
      timer.textContent = finalTime.toFixed(1) + 's';
    });
  }

  function resetAnimation() {
    animated = false;
    statuses.forEach(function(el) {
      el.textContent = 'Pending';
      el.setAttribute('data-status', 'pending');
    });
    timer.textContent = '0.0s';
  }

  var observer = new IntersectionObserver(
    function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !animated) {
          runAnimation();
        } else if (!entry.isIntersecting && animated) {
          resetAnimation();
        }
      });
    },
    { threshold: 0.5 }
  );

  observer.observe(table);
})();
