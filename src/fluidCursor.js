// Fluid ink — a smoke/fluid field confined to the hero title only.
// A 2D-canvas particle fluid: the pointer injects ink with its own velocity,
// particles are advected by a curl-noise turbulence field and dissipate, giving
// a swirling liquid-smoke look. The canvas is positioned exactly over the
// "BUILDING PRODUCTION AI SYSTEMS" heading and composited with
// mix-blend-mode: difference, so the ink only appears on the title and flows
// through the letterforms (cappen-style). Inspired by the WebGL Navier-Stokes
// "fluid cursor" technique, implemented in 2D for reliability. Disabled on
// touch; never throws.
export function initFluidCursor() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const target = document.querySelector('.hero-title');
    if (!target) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'fluid-title';
    Object.assign(canvas.style, {
      position: 'fixed', left: '0', top: '0',
      pointerEvents: 'none', zIndex: '8', mixBlendMode: 'difference',
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    document.body.appendChild(canvas);

    const PAD = 26;            // let ink bleed a little around the glyphs
    let dpr = 1, rect = { left: 0, top: 0, width: 0, height: 0 }, bw = 0, bh = 0;

    const sync = () => {
      const r = target.getBoundingClientRect();
      rect = { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.left = rect.left + 'px';
      canvas.style.top = rect.top + 'px';
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const nw = Math.max(1, Math.floor(rect.width * dpr));
      const nh = Math.max(1, Math.floor(rect.height * dpr));
      if (nw !== bw || nh !== bh) { canvas.width = bw = nw; canvas.height = bh = nh; } // only resize buffer when size changes (avoids clearing on scroll)
    };
    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('scroll', sync, { passive: true });

    const ptr = { x: 0, y: 0, px: 0, py: 0, inside: false };
    window.addEventListener('pointermove', (e) => {
      const inside = e.clientX >= rect.left && e.clientX <= rect.left + rect.width
                  && e.clientY >= rect.top && e.clientY <= rect.top + rect.height;
      ptr.px = ptr.x; ptr.py = ptr.y;
      ptr.x = e.clientX - rect.left; ptr.y = e.clientY - rect.top;
      if (inside && !ptr.inside) { ptr.px = ptr.x; ptr.py = ptr.y; } // no jump on entry
      ptr.inside = inside;
      if (inside) emit();
    }, { passive: true });

    const parts = [];
    const MAX = 340;
    const emit = () => {
      const dx = ptr.x - ptr.px, dy = ptr.y - ptr.py;
      const speed = Math.hypot(dx, dy);
      const n = Math.min(5, 1 + Math.floor(speed / 7));
      for (let i = 0; i < n; i++) {
        if (parts.length >= MAX) parts.shift();
        const t = i / n;
        parts.push({
          x: ptr.px + dx * t + (Math.random() - 0.5) * 6,
          y: ptr.py + dy * t + (Math.random() - 0.5) * 6,
          vx: dx * 0.16 + (Math.random() - 0.5) * 0.7,
          vy: dy * 0.16 + (Math.random() - 0.5) * 0.7,
          life: 1, r: 12 + Math.random() * 24 + speed * 0.5,
        });
      }
    };

    // cheap curl-ish turbulence field
    const curl = (x, y, t) => Math.sin(x * 0.012 + t) * Math.cos(y * 0.011 - t * 0.7);

    let raf = 0, t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) * 0.001;
      ctx.clearRect(0, 0, bw, bh);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const a = curl(p.x, p.y, t) * Math.PI;          // swirl direction
        p.vx += Math.cos(a) * 0.06; p.vy += Math.sin(a) * 0.06;
        p.vx *= 0.95; p.vy *= 0.95;
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.016;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const r = p.r * (0.55 + 0.45 * p.life) * dpr;
        const a2 = 0.16 * p.life;
        const g = ctx.createRadialGradient(p.x * dpr, p.y * dpr, 0, p.x * dpr, p.y * dpr, r);
        g.addColorStop(0, `rgba(255,255,255,${a2})`);
        g.addColorStop(0.5, `rgba(255,255,255,${a2 * 0.4})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x * dpr, p.y * dpr, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    });
  } catch (e) {
    /* non-essential enhancement — never break the page */
    console.warn('[fluidTitle] disabled:', e);
  }
}
