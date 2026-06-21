// style.css is loaded via a <link> in index.html (no bundler in production),
// so it is intentionally not imported here.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initScene3D } from './scene3d.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const EASE = 'power3.out';
const PRE_DUR = 0.25; // small delay before above-the-fold content animates in

const PHRASES = [
  'real-time voice AI',
  'LLM agent orchestration',
  'telephony & SIP',
  'sub-3s voice RAG',
  'LLM fine-tuning',
];

root.classList.add('js');

function forceReveal() {
  document.querySelectorAll('[data-reveal]').forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
  document.querySelectorAll('[data-split],[data-liquid]').forEach((el) => { el.style.opacity = '1'; });
  document.querySelectorAll('.split-line > span, .liq-char').forEach((s) => { s.style.transform = 'none'; });
  const pre = document.querySelector('[data-pre]'); if (pre) pre.style.display = 'none';
}
const safety = setTimeout(forceReveal, 5000);

try { boot(); }
catch (err) {
  console.error('[portfolio] init failed — showing static content', err);
  root.classList.remove('js'); clearTimeout(safety);
}

function boot() {
  startTyping();
  setupCursor();
  playPreloader();

  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const bar = document.getElementById('progress');
  if (bar) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; } });

  setupMagnetic();
  setupActiveNav();
  setupCollage();
  setupIndexRows();
  setupHeroReveal();

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, wait(600)]).then(() => {
    setupLiquid();        // splits headings (preserves embedded 3D box)
    setupSplitHeadings();
    setupReveals();
    setupCounts();
    init3D();             // after liquid split so embedded canvases survive
    ScrollTrigger.refresh();
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function inView(el) { return el.getBoundingClientRect().top < window.innerHeight * 0.92; }

/* --------------------------------------------------------------- preloader */
// Scroll-driven preloader (cappen-style): the thumbnail strip cycles, and the
// curtain lifts away the moment the visitor starts to scroll. A fallback timer
// lifts it anyway so it can never trap the page.
function playPreloader() {
  const pre = document.querySelector('[data-pre]');
  if (!pre) return;
  const imgs = Array.from(pre.querySelectorAll('.pre-stack img'));
  const countEl = pre.querySelector('[data-pre-count]');
  if (imgs.length) gsap.set(imgs[0], { opacity: 1 });

  let i = 0;
  const cyc = setInterval(() => {
    i = (i + 1) % imgs.length;
    imgs.forEach((im, j) => gsap.to(im, { opacity: j === i ? 1 : 0, duration: 0.12 }));
  }, 150);
  const c = { v: 0 };
  gsap.to(c, { v: 99, duration: 1.4, ease: 'power1.inOut',
    onUpdate: () => { if (countEl) countEl.textContent = String(Math.round(c.v)).padStart(2, '0'); } });

  let lifted = false;
  const evs = ['wheel', 'touchmove', 'scroll', 'keydown'];
  const lift = () => {
    if (lifted) return; lifted = true;
    clearInterval(cyc);
    evs.forEach((e) => window.removeEventListener(e, lift));
    pre.removeEventListener('click', lift);
    gsap.to(imgs, { scale: 0.9, stagger: 0.03, duration: 0.35, ease: EASE });
    gsap.to(pre, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', delay: 0.1,
      onComplete: () => { pre.style.display = 'none'; ScrollTrigger.refresh(); } });
  };
  evs.forEach((e) => window.addEventListener(e, lift, { passive: true }));
  pre.addEventListener('click', lift);
  setTimeout(lift, 6000); // safety: lift even if the visitor never scrolls
}

/* --------------------------------------- hero scroll reveal (box → screen) */
// The fixed black panel is clipped to the headline's media box, then the clip
// expands to fill the viewport as the hero scrolls — the white→black wipe.
function setupHeroReveal() {
  const hero = document.querySelector('.hero');
  const box = document.querySelector('[data-hero-box]');
  const panel = document.querySelector('[data-hero-reveal]');
  if (!hero || !box || !panel) return;
  let s = { t: 0, r: 0, b: 0, l: 0 };
  const measure = () => {
    const r = box.getBoundingClientRect();
    s = { t: r.top, r: window.innerWidth - r.right, b: window.innerHeight - r.bottom, l: r.left };
  };
  const apply = (e) => {
    const k = Math.max(0, e);
    panel.style.clipPath = `inset(${s.t * k}px ${s.r * k}px ${s.b * k}px ${s.l * k}px round ${12 * k}px)`;
  };
  ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true,
    onRefresh: () => { measure(); apply(1); },
    onUpdate: (self) => apply(1 - self.progress),
    onLeave: () => gsap.to(panel, { autoAlpha: 0, duration: 0.3 }),
    onEnterBack: () => gsap.to(panel, { autoAlpha: 1, duration: 0.3 }),
  });
  measure(); apply(1);
}

/* --------------------------------------------------------------- cursor */
function setupCursor() {
  const cur = document.querySelector('[data-cursor]');
  if (!cur || window.matchMedia('(hover: none)').matches) return;
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.22, ease: 'power3' });
  const yTo = gsap.quickTo(cur, 'y', { duration: 0.22, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  document.querySelectorAll('a, button, [data-magnetic], .card-media, .irow, .stat').forEach((el) => {
    el.addEventListener('pointerenter', () => cur.classList.add('is-hover'));
    el.addEventListener('pointerleave', () => cur.classList.remove('is-hover'));
  });
}

/* ---------------------------------------------------------------- typing */
function startTyping() {
  const el = document.querySelector('[data-typed]');
  if (!el) return;
  let pi = 0, ci = 0, del = false, hold = 6;
  setInterval(() => {
    if (hold > 0) { hold--; return; }
    const full = PHRASES[pi];
    if (!del) { ci++; if (ci >= full.length) { ci = full.length; del = true; hold = 28; } }
    else { ci--; if (ci <= 0) { ci = 0; del = false; pi = (pi + 1) % PHRASES.length; hold = 5; } }
    el.textContent = full.slice(0, ci);
  }, 55);
}

/* ----------------------------------------------------- liquid headlines */
// Split into per-character spans (preserving <br> and any embedded element
// like the hero media box), then assemble them with a wavy stagger.
function splitLiquid(el) {
  const nodes = Array.from(el.childNodes);
  el.textContent = '';
  const chars = [];
  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const ch of node.textContent) {
        if (ch === ' ') { el.appendChild(document.createTextNode(' ')); continue; }
        const s = document.createElement('span'); s.className = 'liq-char'; s.textContent = ch;
        el.appendChild(s); chars.push(s);
      }
    } else if (node.nodeName === 'BR') {
      el.appendChild(node);
    } else {
      const s = document.createElement('span'); s.className = 'liq-char'; s.appendChild(node);
      el.appendChild(s); chars.push(s);
    }
  });
  return chars;
}

function setupLiquid() {
  document.querySelectorAll('[data-liquid]').forEach((el) => {
    const chars = splitLiquid(el);
    el.style.opacity = '1';
    const base = { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: { each: 0.022, from: 'start' } };
    if (inView(el)) {
      gsap.fromTo(chars, { yPercent: 118, opacity: 0 }, { ...base, delay: PRE_DUR + 0.05 });
    } else {
      gsap.fromTo(chars, { yPercent: 118, opacity: 0 }, { ...base, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    }
  });
}

/* ------------------------------------------------------- split headings */
function setupSplitHeadings() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const inners = splitLines(el);
    el.style.opacity = '1';
    const to = { yPercent: 0, duration: 1.0, ease: EASE, stagger: 0.1 };
    if (inView(el)) gsap.fromTo(inners, { yPercent: 115 }, { ...to, delay: PRE_DUR + 0.05 });
    else gsap.fromTo(inners, { yPercent: 115 }, { ...to, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}

function splitLines(el) {
  const tokens = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') tokens.push({ br: true });
    else (node.textContent || '').split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ word: w }));
  });
  el.textContent = '';
  const measured = tokens.map((t) => {
    if (t.br) { el.appendChild(document.createElement('br')); return t; }
    const s = document.createElement('span'); s.style.display = 'inline-block'; s.textContent = t.word;
    el.appendChild(s); el.appendChild(document.createTextNode(' ')); t.span = s; return t;
  });
  const lines = [];
  let cur = null, lastTop = null;
  measured.forEach((t) => {
    if (t.br) { cur = null; lastTop = null; return; }
    const top = t.span.offsetTop;
    if (cur === null || (lastTop !== null && Math.abs(top - lastTop) > 2)) { cur = []; lines.push(cur); }
    cur.push(t.span.textContent); lastTop = top;
  });
  el.textContent = '';
  const inners = [];
  lines.forEach((words) => {
    const line = document.createElement('span'); line.className = 'split-line';
    const inner = document.createElement('span'); inner.textContent = words.join(' ');
    line.appendChild(inner); el.appendChild(line); inners.push(inner);
  });
  return inners;
}

/* --------------------------------------------------------------- reveals */
function setupReveals() {
  const claimed = new Set();
  document.querySelectorAll('[data-stagger]').forEach((container) => {
    const step = parseFloat(container.getAttribute('data-stagger')) || 0.08;
    const kids = Array.from(container.querySelectorAll('[data-reveal]'));
    kids.forEach((k) => claimed.add(k));
    const to = { opacity: 1, y: 0, duration: 0.85, ease: EASE, stagger: step };
    if (inView(container)) gsap.fromTo(kids, { opacity: 0, y: 28 }, { ...to, delay: PRE_DUR });
    else gsap.fromTo(kids, { opacity: 0, y: 28 }, { ...to, scrollTrigger: { trigger: container, start: 'top 86%', once: true } });
  });
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (claimed.has(el)) return;
    const to = { opacity: 1, y: 0, duration: 0.85, ease: EASE };
    if (inView(el)) gsap.fromTo(el, { opacity: 0, y: 28 }, { ...to, delay: PRE_DUR });
    else gsap.fromTo(el, { opacity: 0, y: 28 }, { ...to, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}

/* ----------------------------------------------------------- count-up */
function setupCounts() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseInt(el.dataset.target, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    const to = { v: target, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; } };
    if (inView(el)) gsap.to(obj, { ...to, delay: PRE_DUR });
    else gsap.to(obj, { ...to, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
}

/* -------------------------------------------------- collage parallax */
function setupCollage() {
  const imgs = gsap.utils.toArray('[data-collage] .c-img');
  if (!imgs.length) return;
  const sec = document.querySelector('.manifesto');
  imgs.forEach((img) => {
    const depth = parseFloat(img.dataset.depth) || 0.1;
    gsap.fromTo(img, { yPercent: depth * 130 }, {
      yPercent: -depth * 130, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* ------------------------------------------- color-inverting index rows */
function setupIndexRows() {
  document.querySelectorAll('[data-row]').forEach((row) => {
    ScrollTrigger.create({
      trigger: row, start: 'top 60%', end: 'bottom 40%',
      onToggle: (s) => row.classList.toggle('is-active', s.isActive),
    });
  });
}

/* ------------------------------------------------------------ 3D scenes */
function init3D() {
  const s1 = document.querySelector('[data-scene3d]');
  if (s1) { try { initScene3D(s1, { count: 240, scale: 1.3, drift: true }); } catch (e) { console.warn('3D failed', e); } }
  const s2 = document.querySelector('[data-scene3d-2]');
  if (s2) { try { initScene3D(s2, { count: 320, scale: 1.5, drift: true }); } catch (e) { console.warn('3D failed', e); } }
}

/* -------------------------------------------------------------- magnetic */
function setupMagnetic() {
  if (window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: EASE });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: EASE });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.45);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ------------------------------------------------------------ active nav */
function setupActiveNav() {
  document.querySelectorAll('.nav-links a[data-nav]').forEach((a) => {
    const sec = document.getElementById(a.dataset.nav);
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top center', end: 'bottom center', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });
}
