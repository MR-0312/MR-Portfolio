// Liquid-ink cursor — a monochrome "fluid" that trails the pointer.
// A full-viewport 2D-canvas of soft ink blobs follows the cursor with easing,
// composited via mix-blend-mode: difference so it reads as black ink on light
// sections and white ink on dark ones (cappen.com-style). Pure 2D canvas — no
// WebGL needed — and it stays out of the way: pointer-events none, disabled on
// touch and for users who prefer reduced motion. Never throws (so it can't break
// the rest of the page boot).
export function initFluidCursor() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '9', mixBlendMode: 'difference',
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    document.body.appendChild(canvas);

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const head = { x: pointer.x, y: pointer.y };
    let active = false;
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY; active = true;
    }, { passive: true });

    const trail = [];
    const MAX = 24;
    let raf = 0;

    const frame = () => {
      // ease the head toward the pointer for organic lag, then record the trail
      head.x += (pointer.x - head.x) * 0.3;
      head.y += (pointer.y - head.y) * 0.3;
      const speed = Math.min(60, Math.hypot(pointer.x - head.x, pointer.y - head.y));
      trail.push({ x: head.x, y: head.y, speed });
      if (trail.length > MAX) trail.shift();

      ctx.clearRect(0, 0, w, h);
      if (active) {
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          const t = i / trail.length;                 // 0 = tail … 1 = head
          const r = (8 + t * 40 + speed * 0.7) * dpr;  // taper + stretch with speed
          const a = 0.06 + t * 0.5;
          const g = ctx.createRadialGradient(p.x * dpr, p.y * dpr, 0, p.x * dpr, p.y * dpr, r);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(0.6, `rgba(255,255,255,${a * 0.4})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x * dpr, p.y * dpr, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    });
  } catch (e) {
    /* fluid cursor is a non-essential enhancement — never break the page */
    console.warn('[fluidCursor] disabled:', e);
  }
}
