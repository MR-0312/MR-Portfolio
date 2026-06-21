// style.css is loaded via a <link> in index.html (no bundler in production),
// so it is intentionally not imported here.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initScene3D } from './scene3d.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const EASE = 'power3.out';

const PHRASES = [
  'real-time voice AI',
  'LLM agent orchestration',
  'telephony & SIP',
  'sub-3s voice RAG',
  'LLM fine-tuning',
];

/* Mark JS active so the CSS can hide reveal targets + show the intro. Any
   failure removes `js` so content is never stuck hidden, and a hard timeout
   force-reveals as a final safety net. */
root.classList.add('js');

function forceReveal() {
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    el.style.opacity = '1'; el.style.transform = 'none';
  });
  document.querySelectorAll('[data-split]').forEach((el) => { el.style.opacity = '1'; });
  document.querySelectorAll('.split-line > span').forEach((s) => { s.style.transform = 'none'; });
  const intro = document.querySelector('[data-intro]');
  if (intro) intro.style.display = 'none';
}
const safety = setTimeout(forceReveal, 4000);

try {
  boot();
} catch (err) {
  console.error('[portfolio] init failed — showing static content', err);
  root.classList.remove('js');
  clearTimeout(safety);
}

function boot() {
  startTyping();
  setupCursor();
  playIntro();

  // ---- Lenis smooth scroll, wired to GSAP's ticker + ScrollTrigger --------
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // ---- progress bar -------------------------------------------------------
  const bar = document.getElementById('progress');
  if (bar) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; } });

  setupMagnetic();
  setupProjects();
  setupActiveNav();
  setupCollage();

  // two monochrome 3D objects: capabilities panel + contact backdrop
  const s1 = document.querySelector('[data-scene3d]');
  if (s1) { try { initScene3D(s1, { count: 180, scale: 1.0 }); } catch (e) { console.warn('3D failed', e); } }
  const s2 = document.querySelector('[data-scene3d-2]');
  if (s2) { try { initScene3D(s2, { count: 320, scale: 1.5, drift: true }); } catch (e) { console.warn('3D failed', e); } }

  // Split headings after fonts load so line breaks measure correctly, capped
  // so a slow/blocked font request can never stall the reveals.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, wait(600)]).then(() => {
    setupSplitHeadings();
    setupReveals();
    setupCounts();
    ScrollTrigger.refresh();
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function inView(el) { return el.getBoundingClientRect().top < window.innerHeight * 0.92; }

/* ----------------------------------------------------------- intro screen */
function playIntro() {
  const intro = document.querySelector('[data-intro]');
  if (!intro) return;
  gsap.to(intro, {
    yPercent: -100, duration: 0.9, ease: 'power4.inOut', delay: 1.1,
    onComplete: () => { intro.style.display = 'none'; ScrollTrigger.refresh(); },
  });
}

/* --------------------------------------------------------------- cursor */
function setupCursor() {
  const cur = document.querySelector('[data-cursor]');
  if (!cur || window.matchMedia('(hover: none)').matches) return;
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.22, ease: 'power3' });
  const yTo = gsap.quickTo(cur, 'y', { duration: 0.22, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  const hot = 'a, button, [data-magnetic], .row, .proj-row, .stat';
  document.querySelectorAll(hot).forEach((el) => {
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

/* -------------------------------------------------- collage parallax */
function setupCollage() {
  const imgs = gsap.utils.toArray('[data-collage] .c-img');
  if (!imgs.length) return;
  const sec = document.querySelector('.manifesto');
  imgs.forEach((img) => {
    const depth = parseFloat(img.dataset.depth) || 0.1;
    gsap.fromTo(img, { yPercent: depth * 120 }, {
      yPercent: -depth * 120, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* ------------------------------------------------------- split headings */
function setupSplitHeadings() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const inners = splitLines(el);
    el.style.opacity = '1';
    const to = { yPercent: 0, duration: 1.0, ease: EASE, stagger: 0.1 };
    if (inView(el)) gsap.fromTo(inners, { yPercent: 115 }, to);
    else gsap.fromTo(inners, { yPercent: 115 }, { ...to, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}

// Splits text into visual lines, preserving explicit <br> breaks.
function splitLines(el) {
  const tokens = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') tokens.push({ br: true });
    else (node.textContent || '').split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ word: w }));
  });

  el.textContent = '';
  const measured = tokens.map((t) => {
    if (t.br) { el.appendChild(document.createElement('br')); return t; }
    const s = document.createElement('span');
    s.style.display = 'inline-block';
    s.textContent = t.word;
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    t.span = s;
    return t;
  });

  const lines = [];
  let cur = null, lastTop = null;
  measured.forEach((t) => {
    if (t.br) { cur = null; lastTop = null; return; }
    const top = t.span.offsetTop;
    if (cur === null || (lastTop !== null && Math.abs(top - lastTop) > 2)) { cur = []; lines.push(cur); }
    cur.push(t.span.textContent);
    lastTop = top;
  });

  el.textContent = '';
  const inners = [];
  lines.forEach((words) => {
    const line = document.createElement('span');
    line.className = 'split-line';
    const inner = document.createElement('span');
    inner.textContent = words.join(' ');
    line.appendChild(inner);
    el.appendChild(line);
    inners.push(inner);
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
    if (inView(container)) gsap.fromTo(kids, { opacity: 0, y: 28 }, to);
    else gsap.fromTo(kids, { opacity: 0, y: 28 }, { ...to, scrollTrigger: { trigger: container, start: 'top 86%', once: true } });
  });
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (claimed.has(el)) return;
    const to = { opacity: 1, y: 0, duration: 0.85, ease: EASE };
    if (inView(el)) gsap.fromTo(el, { opacity: 0, y: 28 }, to);
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
    if (inView(el)) gsap.to(obj, to);
    else gsap.to(obj, { ...to, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
}

/* ------------------------------------------------- pinned project showcase */
function setupProjects() {
  const shots = Array.from(document.querySelectorAll('[data-shot]'));
  const rows = Array.from(document.querySelectorAll('.proj-row'));
  const indexEl = document.querySelector('[data-proj-current]');
  if (!shots.length || !rows.length) return;
  let active = -1;
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    shots.forEach((s, j) => s.classList.toggle('is-active', j === i));
    if (indexEl) indexEl.textContent = String(i + 1).padStart(2, '0');
  };
  rows.forEach((row, i) => {
    ScrollTrigger.create({ trigger: row, start: 'top center', end: 'bottom center', onToggle: (s) => { if (s.isActive) setActive(i); } });
  });
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
