// style.css is loaded via a <link> in index.html (no bundler in production),
// so it is intentionally not imported here.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initScene3D } from './scene3d.js';
import { initFluidCursor } from './fluidCursor.js';

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
  initFluidCursor();
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

/* --------------------------------------------------------------- intro */
// Scroll-driven intro (cappen-style): an in-flow first screen. The thumbnail
// strip auto-cycles, and as you scroll the intro away the strip parallaxes,
// the counter fills, and it dissolves to reveal the hero below. No fixed
// curtain / scroll-lock, so it can never trap the page.
function playPreloader() {
  const pre = document.querySelector('[data-pre]');
  if (!pre) return;
  // Intro plays once per session. Within a visit (reloads / coming back to the
  // tab) it's skipped so it isn't repetitive; a fresh session/tab shows it again.
  let introSeen = false;
  try { introSeen = sessionStorage.getItem('mr_intro_seen') === '1'; } catch (e) {}
  if (introSeen) { pre.remove(); return; }
  try { sessionStorage.setItem('mr_intro_seen', '1'); } catch (e) {}
  const imgs = Array.from(pre.querySelectorAll('.pre-stack img'));
  const stack = pre.querySelector('[data-pre-stack]');
  const countEl = pre.querySelector('[data-pre-count]');
  if (imgs.length) gsap.set(imgs[0], { opacity: 1 });

  let i = 0;
  const cyc = setInterval(() => {
    i = (i + 1) % imgs.length;
    imgs.forEach((im, j) => gsap.to(im, { opacity: j === i ? 1 : 0, duration: 0.12 }));
  }, 150);

  if (stack) gsap.to(stack, { yPercent: -42, ease: 'none', scrollTrigger: { trigger: pre, start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to(pre, { autoAlpha: 0.12, ease: 'none', scrollTrigger: { trigger: pre, start: 'center top', end: 'bottom top', scrub: true } });
  ScrollTrigger.create({
    trigger: pre, start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => { if (countEl) countEl.textContent = String(Math.round(self.progress * 99)).padStart(2, '0'); },
    onLeave: () => clearInterval(cyc),
  });
}

/* --------------------------------------------------------------- cursor */
function setupCursor() {
  const cur = document.querySelector('[data-cursor]');
  if (!cur || window.matchMedia('(hover: none)').matches) return;
  gsap.set(cur, { x: -100, y: -100 }); // park off-screen until the first move (no top-left dot)
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
  if (s1) { try { initScene3D(s1, { count: 110, scale: 0.85 }); } catch (e) { console.warn('3D failed', e); } }
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
