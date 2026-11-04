/* Mattorundi – liike ja pienet käyttöliittymäparannukset.
   Progressive enhancement: sivu toimii täysin ilman tätä tiedostoa tai ilman GSAP/Lenis-kirjastoja.
   Ei koske lomakkeiden logiikkaan (booking.js / common.js).
   Tunnusanimaatiot:
     1) Hero: vaahtolasta pyyhkii "likaisen" kuvan puhtaaksi, kuplat nousevat
     2) Näin se toimii: reittiviiva piirtyy ja pakettiauto ajaa sitä pitkin, viiva päättyy maton hapsuihin */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var showHero = function () { root.classList.remove('motion-pending'); };

  /* ---------- 1. Kutistuva header ---------- */
  var header = document.querySelector('header.top');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---------- 2. Mobiilin alapalkki piiloon varausosion ja footerin kohdalla ---------- */
  var mbar = document.querySelector('[data-mbar]');
  if (mbar && 'IntersectionObserver' in window) {
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      mbar.classList.toggle('is-hidden', visible.size > 0);
    }, { rootMargin: '0px 0px -30% 0px' });
    $$('#varaa, footer').forEach(function (el) { io.observe(el); });
  }

  /* ---------- 3. Linkki tilausehtoihin avaa ehtolaatikon ---------- */
  var openTerms = function () { var d = document.getElementById('ehdot'); if (d) d.open = true; };
  $$('[data-open-terms]').forEach(function (a) { a.addEventListener('click', openTerms); });
  if (location.hash === '#ehdot') openTerms();

  /* ---------- 4. Lomakkeen edistyminen (myyjän sivu) ---------- */
  var prog = document.querySelector('[data-progress]');
  if (prog) {
    var form = document.getElementById('f');
    var steps = $$('li[data-for]', prog);
    var check = function () {
      steps.forEach(function (li) {
        var fs = document.getElementById(li.getAttribute('data-for')); if (!fs) return;
        var ok = $$('input[required],textarea[required]', fs).every(function (i) { return i.value.trim() !== ''; });
        if (fs.hasAttribute('data-needs-day')) ok = ok && !!document.querySelector('#cal .sel');
        if (fs.hasAttribute('data-needs-check')) ok = ok && !!(document.getElementById('acceptTerms') || {}).checked;
        li.classList.toggle('done', ok);
      });
    };
    if (form) { form.addEventListener('input', check); form.addEventListener('change', check); form.addEventListener('click', function () { setTimeout(check, 0); }); }
    check();
  }

  /* ---------- 5. GSAP + ScrollTrigger + Lenis (vain etusivu) ---------- */
  function initMotion() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (reduce || !gsap || !ST) { showHero(); return; }
    gsap.registerPlugin(ST);

    // Lenis – pehmeä vieritys, kytketty GSAPin tickeriin
    if (window.Lenis && document.querySelector('[data-shrink]')) {
      var lenis = new window.Lenis({ autoRaf: false, lerp: 0.11, smoothWheel: true });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a || a.classList.contains('skip')) return;
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var target = document.querySelector(id); if (!target) return;
        e.preventDefault();
        if (id === '#ehdot') openTerms();
        lenis.scrollTo(target, { offset: -((header && header.offsetHeight) || 64) - 12, duration: 1.1 });
        history.pushState(null, '', id);
      });
    }

    /* --- Hero: slogan, alleviivaus ja puhdistava vaahtolasta --- */
    var lines = $$('[data-hero-line]'), heroBits = $$('[data-hero]'), media = document.querySelector('[data-hero-media]');
    var swoosh = document.querySelector('[data-swoosh]');
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (lines.length) {
      gsap.set(lines, { yPercent: 110 });
      gsap.set(heroBits, { autoAlpha: 0, y: 18 });
      if (swoosh) { var sl = swoosh.getTotalLength(); gsap.set(swoosh, { strokeDasharray: sl, strokeDashoffset: sl }); }
      tl.to(lines, { yPercent: 0, duration: 1.1, stagger: 0.14 }, 0.1)
        .to(heroBits, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.35);
      if (swoosh) tl.to(swoosh, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0.75);
    }
    if (media) {
      var frame = media.querySelector('.frame'), dirt = media.querySelector('.dirt'), squeegee = media.querySelector('.squeegee'),
          bubbles = media.querySelector('.bubbles'), badge = media.querySelector('[data-badge]');
      root.classList.add('sweep');
      gsap.set(media, { autoAlpha: 0, y: 24 });
      gsap.set(badge, { autoAlpha: 0, y: 14, scale: 0.92 });
      tl.to(media, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.2);
      // vaahtolasta kulkee vasemmalta oikealle, lika jää sen taakse pois
      var W = function () { return frame.offsetWidth; };
      var SWEEP = 1.7, START = 1.0;
      gsap.set(dirt, { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.set(squeegee, { x: 0, autoAlpha: 0 });
      tl.to(squeegee, { autoAlpha: 1, duration: 0.2 }, START)
        .to(squeegee, { x: W, duration: SWEEP, ease: 'power2.inOut' }, START)
        .to(dirt, { clipPath: 'inset(0% 0% 0% 100%)', duration: SWEEP, ease: 'power2.inOut' }, START)
        .to(squeegee, { autoAlpha: 0, duration: 0.25 }, START + SWEEP - 0.1)
        .to(badge, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.8)' }, START + SWEEP - 0.2)
        .add(function () { root.classList.remove('sweep'); }, START + SWEEP + 0.2);
      // kuplat syntyvät lastan kohdalle ja nousevat
      for (var i = 0; i < 18; i++) {
        var b = document.createElement('i'); var s = 8 + Math.random() * 18; b.style.setProperty('--s', s + 'px'); bubbles.appendChild(b);
        var at = START + (i / 18) * SWEEP * 0.95;
        (function (el, t) {
          tl.set(el, { left: function () { return (gsap.getProperty(squeegee, 'x') || 0) - 6 + 'px'; }, top: (35 + Math.random() * 55) + '%', autoAlpha: 0, scale: 0.4, x: 0, y: 0 }, t)
            .to(el, { autoAlpha: 0.95, scale: 1, duration: 0.25, ease: 'power1.out' }, t)
            .to(el, { y: -60 - Math.random() * 90, x: (Math.random() - 0.5) * 40, duration: 1.3 + Math.random() * 0.6, ease: 'sine.out' }, t)
            .to(el, { autoAlpha: 0, duration: 0.5 }, t + 1);
        })(b, at);
      }
    }
    showHero();

    // Hero-kuvan kevyt parallaksi
    $$('[data-parallax]').forEach(function (el) {
      gsap.fromTo(el, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: el.parentNode, start: 'top top', end: 'bottom top', scrub: true } });
    });

    /* --- Paljastukset --- */
    $$('[data-reveal]').forEach(function (el) {
      gsap.from(el, { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    gsap.set('[data-reveal-card]', { autoAlpha: 0 });
    ST.batch('[data-reveal-card]', {
      start: 'top 90%', once: true,
      onEnter: function (b) { gsap.fromTo(b, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, overwrite: true }); }
    });

    /* --- Näin se toimii: reittiviiva + pakettiauto (työpöytä), pystyviiva (mobiili) --- */
    var mm = gsap.matchMedia();
    var route = document.querySelector('[data-route]'), van = document.querySelector('[data-van]'), fringe = document.querySelector('[data-fringe]');
    mm.add('(min-width: 801px)', function () {
      if (!route || !van) return;
      var svg = route.ownerSVGElement, L = route.getTotalLength(), VB = 1200;
      root.classList.add('route-anim');
      gsap.set(route, { strokeDasharray: L, strokeDashoffset: L });
      gsap.set(fringe, { autoAlpha: 0 });
      var place = function (p) {
        var r = svg.getBoundingClientRect(), pr = van.parentNode.getBoundingClientRect(), k = r.width / VB, top = r.top - pr.top;
        var a = route.getPointAtLength(Math.max(0, p * L)), b = route.getPointAtLength(Math.min(L, p * L + 4));
        var ang = Math.atan2((b.y - a.y), (b.x - a.x) * k) * 180 / Math.PI;
        van.style.transform = 'translate(' + (r.left - pr.left + a.x * k - 26) + 'px,' + (top + a.y - 26) + 'px) rotate(' + ang + 'deg)';
      };
      place(0);
      var st = ST.create({
        trigger: '.steps', start: 'top 78%', end: 'bottom 45%', scrub: 0.8,
        onUpdate: function (self) {
          var p = self.progress;
          route.style.strokeDashoffset = L * (1 - p);
          place(p);
          gsap.to(fringe, { autoAlpha: p > 0.97 ? 1 : 0, duration: 0.3, overwrite: true });
        },
        onRefresh: function (self) { place(self.progress); }
      });
      return function () { root.classList.remove('route-anim'); st.kill(); route.style.strokeDashoffset = ''; route.style.strokeDasharray = ''; gsap.set(fringe, { clearProps: 'all' }); };
    });
    mm.add('(max-width: 800px)', function () {
      var track = document.querySelector('[data-draw]'); if (!track) return;
      gsap.fromTo(track, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 60%', scrub: 0.6 } });
    });
    gsap.from('[data-step]', { autoAlpha: 0, y: 28, duration: 0.8, ease: 'power3.out', stagger: 0.18, scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true } });

    // Kalenteri ja lomake muuttavat sivun korkeutta → päivitä ScrollTriggerit
    if ('ResizeObserver' in window) {
      var t; new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { ST.refresh(); }, 150); }).observe(document.body);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMotion); else initMotion();
})();
