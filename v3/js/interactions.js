/* ═══════════════════════════════════════════
   OmniFlow Interactions
   3D card tilt + any future hover effects.
   ═══════════════════════════════════════════ */

(function () {
  "use strict";

  const isReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;

  if (isReducedMotion || isMobile) return;

  function initCardTilt() {
    const cards = document.querySelectorAll("[data-tilt]");
    if (cards.length === 0) return;

    cards.forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = ((y - centerY) / centerY) * -6;
        var rotateY = ((x - centerX) / centerX) * 6;

        card.style.transform =
          "perspective(1000px) rotateX(" +
          rotateX +
          "deg) rotateY(" +
          rotateY +
          "deg) scale(1.02)";
        card.style.transition = "transform 0.1s ease";
      });

      card.addEventListener("mouseleave", function () {
        card.style.transform =
          "perspective(1000px) rotateX(0) rotateY(0) scale(1)";
        card.style.transition = "transform 0.4s ease";
      });
    });
  }

  if (document.readyState === "complete") {
    initCardTilt();
  } else {
    window.addEventListener("load", initCardTilt);
  }
})();
