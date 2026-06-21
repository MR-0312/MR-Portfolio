// style.css is loaded via a <link> in index.html (no bundler in production),
// so it is intentionally not imported here.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initScene3D } from './scene3d.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const EASE = 'power3.out';
const PRE_DUR = 2.4; // hero content animates in as the loader curtain lifts

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

/* --------------------------------------------------------------- loader */
// A loader curtain: a continuous vertical film-strip of project thumbnails, a
// filling progress bar + counter, then the curtain lifts to reveal the hero.
function playPreloader() {
  const pre = document.querySelector('[data-pre]');
  if (!pre) return;
  const track = pre.querySelector('[data-pre-track]');
  const bar = pre.querySelector('[data-pre-bar]');
  const countEl = pre.querySelector('[data-pre-count]');

  // track holds two image sets → a seamless -50% vertical loop
  if (track) gsap.to(track, { yPercent: -50, duration: 9, ease: 'none', repeat: -1 });

  const o = { v: 0 };
  gsap.to(o, { v: 100, duration: 1.9, ease: 'power1.inOut', onUpdate: () => {
    if (bar) bar.style.width = o.v + '%';
    if (countEl) countEl.textContent = String(Math.round(o.v)).padStart(2, '0');
  } });
  gsap.to(pre, { yPercent: -100, duration: 0.95, ease: 'power4.inOut', delay: 2.1,
    onComplete: () => { pre.style.display = 'none'; ScrollTrigger.refresh(); } });
}

/* ----------------------------------------- hero scroll wipe (box → screen) */
// Pin the hero and expand the fixed black panel (clipped to the headline box)
// until it fills the viewport — the cappen white→black wipe revealing the 3D.
function setupHeroReveal() {
  const hero = document.querySelector('.hero');
  const box = document.querySelector('[data-hero-box]');
  const panel = document.querySelector('[data-hero-reveal]');
  if (!hero || !box || !panel) return;
  const s = { t: 0, r: 0, b: 0, l: 0 };
  const measure = () => {
    // Vertical offset is measured relative to the hero (scroll-independent), so
    // it stays correct no matter when ScrollTrigger refreshes; during the pin
    // the hero is fixed at top:0 so this offset is the box's viewport position.
    const hr = hero.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const top = br.top - hr.top;
    s.t = top; s.l = br.left;
    s.r = window.innerWidth - (br.left + br.width);
    s.b = window.innerHeight - (top + br.height);
  };
  const apply = (k) => {
    const m = Math.max(0, k);
    panel.style.clipPath = `inset(${s.t * m}px ${s.r * m}px ${s.b * m}px ${s.l * m}px round ${12 * m}px)`;
  };
  ScrollTrigger.create({
    trigger: hero, start: 'top top', end: '+=100%', pin: true, scrub: true, invalidateOnRefresh: true,
    onRefresh: () => { measure(); apply(1); },
    onUpdate: (self) => apply(1 - self.progress),
    // Black out the hero behind the panel before fading it, so the white hero
    // never flashes back between the wipe and the (dark) manifesto.
    onLeave: () => { gsap.set(hero, { backgroundColor: '#0b0b0b' }); gsap.set('.hero-inner', { autoAlpha: 0 }); gsap.to(panel, { autoAlpha: 0, duration: 0.3 }); },
    onEnterBack: () => { gsap.set(hero, { backgroundColor: '' }); gsap.set('.hero-inner', { autoAlpha: 1 }); gsap.to(panel, { autoAlpha: 1, duration: 0.3 }); },
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

const SVGNS = 'http://www.w3.org/2000/svg';
// Build a per-heading SVG turbulence+displacement filter for the liquid reveal.
function makeLiquidFilter(id) {
  let defs = document.getElementById('liquid-defs');
  if (!defs) {
    defs = document.createElementNS(SVGNS, 'svg');
    defs.id = 'liquid-defs';
    defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(defs);
  }
  const f = document.createElementNS(SVGNS, 'filter');
  f.id = id;
  f.setAttribute('x', '-30%'); f.setAttribute('y', '-30%');
  f.setAttribute('width', '160%'); f.setAttribute('height', '160%');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  const turb = document.createElementNS(SVGNS, 'feTurbulence');
  turb.setAttribute('type', 'fractalNoise');
  turb.setAttribute('baseFrequency', '0.02 0.022');
  turb.setAttribute('numOctaves', '2');
  turb.setAttribute('seed', String(Math.floor(Math.random() * 90) + 1));
  turb.setAttribute('result', 'noise');
  const disp = document.createElementNS(SVGNS, 'feDisplacementMap');
  disp.setAttribute('in', 'SourceGraphic'); disp.setAttribute('in2', 'noise');
  disp.setAttribute('scale', '0');
  disp.setAttribute('xChannelSelector', 'R'); disp.setAttribute('yChannelSelector', 'G');
  f.appendChild(turb); f.appendChild(disp);
  defs.appendChild(f);
  return { disp, turb };
}

// Liquid headline reveal: characters rise while an SVG displacement map melts
// from heavy distortion to crisp, then the filter is removed for sharp text.
function setupLiquid() {
  document.querySelectorAll('[data-liquid]').forEach((el, i) => {
    const chars = splitLiquid(el);
    el.style.opacity = '1';
    const id = 'liq' + i;
    const { disp, turb } = makeLiquidFilter(id);
    el.style.filter = `url(#${id})`;
    el.style.webkitFilter = `url(#${id})`;
    const run = (delay) => {
      gsap.fromTo(chars, { yPercent: 118, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.0, ease: 'power4.out', stagger: { each: 0.02 }, delay });
      const a = { s: 44, f: 0.018 };
      gsap.to(a, {
        s: 0, f: 0.009, duration: 1.15, ease: 'power3.out', delay,
        onUpdate: () => {
          disp.setAttribute('scale', a.s.toFixed(2));
          turb.setAttribute('baseFrequency', a.f.toFixed(4) + ' ' + (a.f * 1.15).toFixed(4));
        },
        onComplete: () => { el.style.filter = 'none'; el.style.webkitFilter = 'none'; },
      });
    };
    if (inView(el)) run(PRE_DUR + 0.05);
    else ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => run(0) });
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
  if (s1) { try { initScene3D(s1, { count: 240, scale: 1.0, drift: true }); } catch (e) { console.warn('3D failed', e); } }
  const s2 = document.querySelector('[data-scene3d-2]');
  if (s2) { try { initScene3D(s2, { count: 320, scale: 1.15, drift: true }); } catch (e) { console.warn('3D failed', e); } }
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
