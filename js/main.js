/* =========================================================================
   ULTRAGALACTICSTACHE — interaction & motion layer
   Vanilla JS. GSAP + ScrollTrigger are optional enhancements: every reveal
   uses gsap.from() so if the CDN fails to load, content stays visible.
   ========================================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';

  if (hasGSAP && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* -----------------------------------------------------------------------
     1. Starfield canvas — layered parallax dots, twinkle, pause when hidden
     ----------------------------------------------------------------------- */
  function initStarfield () {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w, h, layers, raf, running = true;

    const LAYER_CONF = [
      { count: 90, speed: 0.02, size: [0.5, 1.1], alpha: [0.25, 0.55] },
      { count: 60, speed: 0.05, size: [0.8, 1.6], alpha: [0.35, 0.75] },
      { count: 34, speed: 0.09, size: [1.2, 2.2], alpha: [0.5, 1] }
    ];

    function buildLayers () {
      layers = LAYER_CONF.map((conf) => {
        const stars = [];
        for (let i = 0; i < conf.count; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: conf.size[0] + Math.random() * (conf.size[1] - conf.size[0]),
            baseAlpha: conf.alpha[0] + Math.random() * (conf.alpha[1] - conf.alpha[0]),
            phase: Math.random() * Math.PI * 2,
            speed: conf.speed
          });
        }
        return stars;
      });
    }

    function resize () {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLayers();
    }

    let t = 0;
    function draw () {
      ctx.clearRect(0, 0, w, h);
      layers.forEach((stars) => {
        stars.forEach((s) => {
          const twinkle = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(t * 0.02 + s.phase);
          ctx.globalAlpha = s.baseAlpha * twinkle;
          ctx.fillStyle = '#eaf6ff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
          if (!reduceMotion) {
            s.y += s.speed;
            if (s.y > h + 4) { s.y = -4; s.x = Math.random() * w; }
          }
        });
      });
      ctx.globalAlpha = 1;
      t++;
      if (running && !reduceMotion) raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    if (reduceMotion) return; // static single frame, no loop needed

    window.addEventListener('resize', debounce(resize, 200));
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    });
  }

  function debounce (fn, wait) {
    let id;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), wait);
    };
  }

  /* -----------------------------------------------------------------------
     2. Navigation — scroll state + mobile menu
     ----------------------------------------------------------------------- */
  function initNav () {
    const nav = document.querySelector('.site-nav');
    const toggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.mobile-menu');
    if (!nav) return;

    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > (window.matchMedia('(max-width: 599px)').matches ? 0 : 40));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!toggle || !menu) return;
    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    const openMenu = () => {
      toggle.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      expanded ? closeMenu() : openMenu();
    });
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* -----------------------------------------------------------------------
     3. Scroll reveals (gsap.from — safe no-op if GSAP absent)
     ----------------------------------------------------------------------- */
  function initReveals () {
    if (!hasGSAP || !window.ScrollTrigger) return;
    const dur = reduceMotion ? 0.01 : 0.9;
    const y = reduceMotion ? 0 : 28;

    document.querySelectorAll('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        opacity: 0,
        y,
        duration: dur,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    document.querySelectorAll('[data-reveal-group]').forEach((group) => {
      const items = group.querySelectorAll('[data-reveal-item]');
      if (!items.length) return;
      gsap.from(items, {
        opacity: 0,
        y,
        duration: dur,
        ease: 'power3.out',
        stagger: reduceMotion ? 0 : 0.12,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true }
      });
    });
  }

  /* -----------------------------------------------------------------------
     4. Animated meters (strength section)
     ----------------------------------------------------------------------- */
  function initMeters () {
    const meters = document.querySelectorAll('.meter[data-target]');
    if (!meters.length) return;

    const animate = (meter) => {
      const target = parseFloat(meter.dataset.target);
      const fill = meter.querySelector('.meter__fill');
      const valueEl = meter.querySelector('.meter__value');
      const spark = meter.querySelector('.meter__spark');
      const suffix = meter.dataset.suffix || '%';

      if (reduceMotion || !hasGSAP) {
        if (fill) fill.style.width = Math.min(target, 100) + '%';
        return;
      }

      const state = { v: 0 };
      gsap.to(state, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate: () => {
          if (fill) fill.style.width = Math.min(state.v, 100) + '%';
          if (valueEl) valueEl.textContent = state.v.toFixed(1) + suffix;
        },
        onComplete: () => {
          if (spark) {
            gsap.fromTo(spark,
              { left: '0%', opacity: 0.9, scale: 1 },
              { left: Math.min(target, 100) + '%', opacity: 0, duration: 0.6, ease: 'power1.out' }
            );
          }
        }
      });
    };

    if (hasGSAP && window.ScrollTrigger) {
      meters.forEach((m) => {
        ScrollTrigger.create({
          trigger: m,
          start: 'top 85%',
          once: true,
          onEnter: () => animate(m)
        });
      });
    } else {
      meters.forEach(animate);
    }
  }

  /* -----------------------------------------------------------------------
     5. Magnetic buttons (desktop, fine pointer only)
     ----------------------------------------------------------------------- */
  function initMagnetic () {
    if (reduceMotion || !isFinePointer) return;
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      const strength = 14;
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * strength;
        const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* -----------------------------------------------------------------------
     6. 3D tilt for cards/panels (desktop, fine pointer only)
     ----------------------------------------------------------------------- */
  function initTilt () {
    if (reduceMotion || !isFinePointer) return;
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      const max = 7;
      const baseLift = card.classList.contains('product-card--featured') && window.innerWidth >= 760 ? -14 : -4;
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (0.5 - py) * max * 2;
        const ry = (px - 0.5) * max * 2;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(${baseLift}px)`;
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* -----------------------------------------------------------------------
     7. Cursor-reactive glass sheen (cheap, CSS var driven)
     ----------------------------------------------------------------------- */
  function initGlassSheen () {
    if (reduceMotion || !isFinePointer) return;
    document.querySelectorAll('.glass').forEach((panel) => {
      panel.addEventListener('mousemove', (e) => {
        const r = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        panel.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* -----------------------------------------------------------------------
     9. Newsletter (demo, no backend)
     ----------------------------------------------------------------------- */
  function initNewsletter () {
    const form = document.querySelector('[data-newsletter]');
    if (!form) return;
    const status = (form.closest('.newsletter') || form).querySelector('[data-newsletter-status]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (status) {
        status.textContent = 'TRANSMISSION RECEIVED — WELCOME TO THE FLEET, ' + (input.value.split('@')[0] || 'COMMANDER').toUpperCase();
      }
      form.reset();
    });
  }

  /* -----------------------------------------------------------------------
     10. Footer year
     ----------------------------------------------------------------------- */
  function initYear () {
    const el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* -----------------------------------------------------------------------
     Boot
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initStarfield();
    initNav();
    initReveals();
    initMeters();
    initMagnetic();
    initTilt();
    initGlassSheen();
    initNewsletter();
    initYear();
  });
})();
