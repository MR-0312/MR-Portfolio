import './style.css';
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
  'telephony & SIP integration',
  'LLM fine-tuning',
  'applied ML in production',
];

const TICKER = ['LiveKit', 'Twilio SIP', 'ElevenLabs', 'Deepgram', 'Groq Whisper',
  'XTTS', 'WebRTC', 'LangChain', 'Agentic RAG', 'PyTorch', 'Unsloth', 'LoRA',
  'DeepSpeed', 'FastAPI', 'FAISS', 'AWS', 'Supabase', 'Docker'];

/* Mark JS active so the CSS can hide reveal targets. Everything below is
   wrapped: any failure removes `js` so content is never stuck hidden, and a
   hard timeout force-reveals as a final safety net. */
root.classList.add('js');

function forceReveal() {
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
  document.querySelectorAll('[data-split]').forEach((el) => { el.style.opacity = '1'; });
  document.querySelectorAll('.split-line > span').forEach((s) => { s.style.transform = 'none'; });
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
  buildTicker();
  buildWave();
  startTyping();

  // ---- Lenis smooth scroll, wired to GSAP's ticker + ScrollTrigger --------
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // ---- progress bar -------------------------------------------------------
  const bar = document.getElementById('progress');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; },
  });

  setupMarquee();
  setupMagnetic();
  setupProjects();
  setupActiveNav();
  setupHeroScroll();

  // 3D centerpiece in the hero card
  const stage = document.querySelector('[data-scene3d]');
  if (stage) { try { initScene3D(stage); } catch (e) { console.warn('3D scene failed', e); } }

  // Headings split into lines — run after fonts load so line breaks measure
  // correctly, but cap the wait so a slow/blocked font request can't stall.
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
// Above-the-fold elements are already past their ScrollTrigger start at load,
// where the trigger won't reliably fire — so play those immediately.
function inView(el) { return el.getBoundingClientRect().top < window.innerHeight * 0.92; }

/* ---------------------------------------------------------------- ticker */
function buildTicker() {
  const track = document.querySelector('[data-marquee-track]');
  if (!track) return;
  const makeSet = () => {
    const frag = document.createDocumentFragment();
    TICKER.forEach((t) => {
      const s = document.createElement('span');
      s.className = 'ticker-item';
      s.innerHTML = `${t}<b>✦</b>`;
      frag.appendChild(s);
    });
    return frag;
  };
  track.appendChild(makeSet());
  track.appendChild(makeSet()); // duplicate for a seamless -50% loop
  gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
}

/* ------------------------------------------------------------------ wave */
function buildWave() {
  const wave = document.querySelector('[data-wave]');
  if (!wave) return;
  for (let i = 0; i < 40; i++) {
    const dur = (0.7 + ((i * 7) % 9) * 0.12).toFixed(2);
    const delay = ((i * 0.05) % 1.4).toFixed(2);
    const h = (0.2 + ((i * 37) % 80) / 100).toFixed(2);
    const bar = document.createElement('span');
    bar.style.setProperty('--wdur', dur + 's');
    bar.style.setProperty('--wdelay', '-' + delay + 's');
    bar.style.transform = `scaleY(${h})`; // static baseline if CSS anim is blocked
    wave.appendChild(bar);
  }
}

/* ---------------------------------------------------------------- typing */
function startTyping() {
  const el = document.querySelector('[data-typed]');
  if (!el) return;
  let pi = 0, ci = 0, del = false, hold = 6;
  setInterval(() => {
    if (hold > 0) { hold--; return; }
    const full = PHRASES[pi];
    if (!del) { ci++; if (ci >= full.length) { ci = full.length; del = true; hold = 30; } }
    else { ci--; if (ci <= 0) { ci = 0; del = false; pi = (pi + 1) % PHRASES.length; hold = 5; } }
    el.textContent = full.slice(0, ci);
  }, 55);
}

/* ------------------------------------------------------- split headings */
function setupSplitHeadings() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const inners = splitLines(el);
    el.style.opacity = '1'; // parent shown; inner lines stay hidden via gsap's from
    const to = { yPercent: 0, duration: 0.95, ease: EASE, stagger: 0.1 };
    if (inView(el)) {
      gsap.fromTo(inners, { yPercent: 115 }, to);
    } else {
      gsap.fromTo(inners, { yPercent: 115 },
        { ...to, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    }
  });
}

// Splits an element's text into visual lines, preserving explicit <br> breaks.
function splitLines(el) {
  // Tokens: words and explicit line breaks (from <br>).
  const tokens = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      tokens.push({ br: true });
    } else {
      (node.textContent || '').split(/\s+/).filter(Boolean)
        .forEach((w) => tokens.push({ word: w }));
    }
  });

  // Lay words out as inline-blocks to measure natural wrap points.
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

  // Group into lines by vertical offset, breaking on explicit <br> too.
  const lines = [];
  let cur = null, lastTop = null;
  measured.forEach((t) => {
    if (t.br) { cur = null; lastTop = null; return; }
    const top = t.span.offsetTop;
    if (cur === null || (lastTop !== null && Math.abs(top - lastTop) > 2)) {
      cur = []; lines.push(cur);
    }
    cur.push(t.span.textContent);
    lastTop = top;
  });

  el.textContent = '';
  const inners = [];
  lines.forEach((lineWords) => {
    const line = document.createElement('span');
    line.className = 'split-line';
    const inner = document.createElement('span');
    inner.textContent = lineWords.join(' ');
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
    if (inView(container)) {
      gsap.fromTo(kids, { opacity: 0, y: 30 }, to);
    } else {
      gsap.fromTo(kids, { opacity: 0, y: 30 },
        { ...to, scrollTrigger: { trigger: container, start: 'top 84%', once: true } });
    }
  });

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (claimed.has(el)) return;
    const delay = parseFloat(el.getAttribute('data-reveal-delay')) || 0;
    const to = { opacity: 1, y: 0, duration: 0.85, ease: EASE, delay };
    if (inView(el)) {
      gsap.fromTo(el, { opacity: 0, y: 30 }, to);
    } else {
      gsap.fromTo(el, { opacity: 0, y: 30 },
        { ...to, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    }
  });
}

/* ----------------------------------------------------------- count-up */
function setupCounts() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseInt(el.dataset.target, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    const to = {
      v: target, duration: 1.6, ease: 'power2.out',
      onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; },
    };
    if (inView(el)) {
      gsap.to(obj, to);
    } else {
      gsap.to(obj, { ...to, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    }
  });
}

/* ------------------------------------------------- pinned project showcase */
function setupProjects() {
  const shots = Array.from(document.querySelectorAll('[data-shot]'));
  const panels = Array.from(document.querySelectorAll('.proj-panel'));
  const indexEl = document.querySelector('[data-proj-current]');
  if (!shots.length || !panels.length) return;
  let active = -1;
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    shots.forEach((s, j) => s.classList.toggle('is-active', j === i));
    if (indexEl) indexEl.textContent = String(i + 1).padStart(2, '0');
  };
  panels.forEach((panel, i) => {
    ScrollTrigger.create({
      trigger: panel, start: 'top center', end: 'bottom center',
      onToggle: (self) => { if (self.isActive) setActive(i); },
    });
  });
}

/* ----------------------------------------------------------- marquee skew */
function setupMarquee() {
  const ticker = document.querySelector('[data-marquee]');
  if (!ticker) return;
  const skewTo = gsap.quickTo(ticker, 'skewX', { duration: 0.4, ease: EASE });
  ScrollTrigger.create({
    onUpdate: (self) => {
      const v = Math.max(-5, Math.min(5, self.getVelocity() / -260));
      skewTo(v);
    },
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
    ScrollTrigger.create({
      trigger: sec, start: 'top center', end: 'bottom center',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });
}

/* ------------------------------------------------------- hero scroll fx */
function setupHeroScroll() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  gsap.to('[data-parallax]', {
    yPercent: -10, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.scroll-cue', {
    opacity: 0, ease: 'none',
    scrollTrigger: { start: 0, end: 220, scrub: true },
  });
}
