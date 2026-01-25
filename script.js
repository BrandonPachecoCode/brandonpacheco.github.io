/* =========================
   SHOWREEL HERO BUBBLES — Apple-smooth scroll reveal (UPDATED)
   - Down = fast reveal
   - Up = faster hide
   - Typing dots before each bubble (except title bubble)
   - Pop bounce
========================= */

(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const groups = Array.from(document.querySelectorAll(".hero-bubbles"));
  if (!groups.length) return;

  // SNAPPY timings (Apple-ish)
  const T = {
    down: { typing: 120, gap: 90, pop: 380 },
    up:   { typing: 80,  gap: 55, pop: 300 },
    hideDownDelay: 60,
    hideUpDelay: 20,
    hideDownStagger: 45,
    hideUpStagger: 28
  };

  // Scroll direction
  let lastY = window.scrollY || 0;
  let dir = "down";
  window.addEventListener("scroll", () => {
    const y = window.scrollY || 0;
    dir = y > lastY ? "down" : "up";
    lastY = y;
  }, { passive: true });

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function isTitleBubble(b) {
    return b.classList.contains("title") || b.dataset.role === "title";
  }

  function ensureTyping(b) {
    // Title bubble should NOT get typing dots
    if (isTitleBubble(b)) return;

    if (!b.querySelector(".typing")) {
      const typing = document.createElement("span");
      typing.className = "typing";
      typing.setAttribute("aria-hidden", "true");
      typing.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
      // Put typing before the text span (nice for screen readers too)
      b.prepend(typing);
    }
  }

  function killAnim(b) {
    if (b._wa) { try { b._wa.cancel(); } catch (_) {} }
    b._wa = null;
  }

  function resetBubble(b) {
    killAnim(b);
    b.classList.remove("is-in", "is-typing");
    b.classList.add("is-out");
    b.setAttribute("aria-hidden", "true");
  }

  function showTyping(b) {
    killAnim(b);
    b.classList.remove("is-in", "is-out");
    b.classList.add("is-typing");
    b.setAttribute("aria-hidden", "true");
  }

  function showBubble(b, popMs) {
    killAnim(b);
    b.classList.remove("is-typing", "is-out");
    b.classList.add("is-in");
    b.setAttribute("aria-hidden", "false");

    if (prefersReduced) return;

    // Extra smooth pop using Web Animations (GPU transform)
    b._wa = b.animate(
      [
        { transform: "translateY(10px) scale(0.985)", opacity: 0.0, filter: "blur(6px)" },
        { transform: "translateY(-2px) scale(1.02)",  opacity: 1.0, filter: "blur(0px)", offset: 0.72 },
        { transform: "translateY(0px) scale(1.0)",    opacity: 1.0, filter: "blur(0px)" }
      ],
      { duration: popMs, easing: "cubic-bezier(.2,.9,.2,1)", fill: "both" }
    );
  }

  function clearTimers(g) {
    if (g._timers) g._timers.forEach(t => clearTimeout(t));
    g._timers = [];
  }

  function setTimer(g, fn, ms) {
    const t = setTimeout(fn, ms);
    g._timers.push(t);
  }

  function allIn(bubbles) {
    return bubbles.every(b => b.classList.contains("is-in"));
  }

  async function revealGroup(g, direction) {
    clearTimers(g);

    const bubbles = Array.from(g.querySelectorAll(".hero-bubble"));
    if (!bubbles.length) return;

    // prevent double-runs flicker
    if (g._state === "shown" && allIn(bubbles)) return;

    g._state = "showing";
    g._runId = (g._runId || 0) + 1;
    const runId = g._runId;

    const cfg = direction === "down" ? T.down : T.up;

    if (prefersReduced) {
      bubbles.forEach(b => {
        b.classList.add("is-in");
        b.classList.remove("is-out", "is-typing");
        b.setAttribute("aria-hidden", "false");
      });
      g._state = "shown";
      return;
    }

    // If we were hidden, start hidden; if partially shown, continue smoothly.
    // DO NOT hard-reset everything on every reveal (that caused flicker).
    bubbles.forEach(b => {
      if (!b.classList.contains("is-in")) {
        // keep hidden state consistent
        b.classList.add("is-out");
        b.classList.remove("is-typing");
        b.setAttribute("aria-hidden", "true");
      }
    });

    // Title bubble: show immediately, no typing
    const title = bubbles.find(isTitleBubble);
    if (title && !title.classList.contains("is-in")) {
      showBubble(title, cfg.pop);
      await sleep(60);
    }

    // Reveal the rest in order
    for (let i = 0; i < bubbles.length; i++) {
      if (!g.classList.contains("hb-active")) return;
      if (g._runId !== runId) return;

      const b = bubbles[i];
      if (isTitleBubble(b)) continue;

      // already visible? skip
      if (b.classList.contains("is-in")) continue;

      showTyping(b);
      await sleep(cfg.typing);

      if (!g.classList.contains("hb-active")) return;
      if (g._runId !== runId) return;

      showBubble(b, cfg.pop);
      await sleep(cfg.gap);
    }

    g._state = "shown";
  }

  function hideGroup(g, direction) {
    clearTimers(g);
    g._runId = (g._runId || 0) + 1; // cancels reveal
    g._state = "hidden";

    const bubbles = Array.from(g.querySelectorAll(".hero-bubble"));
    if (!bubbles.length || prefersReduced) return;

    const isDown = direction === "down";
    const base = isDown ? T.hideDownDelay : T.hideUpDelay;
    const stagger = isDown ? T.hideDownStagger : T.hideUpStagger;

    // Hide in reverse (feels like chat retracting)
    [...bubbles].reverse().forEach((b, i) => {
      setTimer(g, () => resetBubble(b), base + i * stagger);
    });
  }

  // Setup
  groups.forEach(g => {
    const bubbles = Array.from(g.querySelectorAll(".hero-bubble"));
    bubbles.forEach(ensureTyping);
    g._timers = [];
    g._state = "hidden";
    bubbles.forEach(resetBubble);
  });

  // Observer
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const g = entry.target;
      if (entry.isIntersecting) {
        g.classList.add("hb-active");
        revealGroup(g, dir);
      } else {
        g.classList.remove("hb-active");
        hideGroup(g, dir);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: "22% 0px -18% 0px"
  });

  groups.forEach(g => io.observe(g));

  // Play on load if already in view
  window.addEventListener("load", () => {
    groups.forEach(g => {
      const r = g.getBoundingClientRect();
      const inView = r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
      if (inView) {
        g.classList.add("hb-active");
        revealGroup(g, "down");
      }
    });
  });
})();