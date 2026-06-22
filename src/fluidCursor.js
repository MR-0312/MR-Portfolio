// Liquid-ink cursor — a bold monochrome "fluid" that trails the pointer.
// A full-viewport 2D-canvas of additive ink blobs follows the cursor and is
// composited via mix-blend-mode: difference, so it reads as black ink on light
// sections and white ink on dark ones (cappen.com-style). A solid head blob
// keeps it visible even at rest. Pure 2D canvas (no WebGL). It stays out of the
// way (pointer-events: none) and is disabled on touch devices. The site uses
// heavy motion throughout, so this intentionally does NOT gate on
// prefers-reduced-motion. Never throws, so it can't break page boot.
export function initFluidCursor() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'fluid-cursor';
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
    let energy = 0; // rises while moving, decays when idle → ink fades out at rest
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY; active = true;
    }, { passive: true });

    const trail = [];
    const MAX = 28;
    let raf = 0;

    const blob = (x, y, r, a0, a1) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a0})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a1})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const frame = () => {
      head.x += (pointer.x - head.x) * 0.32;
      head.y += (pointer.y - head.y) * 0.32;
      const speed = Math.min(70, Math.hypot(pointer.x - head.x, pointer.y - head.y));
      trail.push({ x: head.x, y: head.y, speed });
      if (trail.length > MAX) trail.shift();
      // ink energy rises while moving, decays when idle → the trail fades out
      energy += (Math.min(1, speed / 16) - energy) * 0.08;

      ctx.clearRect(0, 0, w, h);
      if (active && energy > 0.012) {
        // additive trail → overlapping blobs build into a solid liquid ribbon
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          const t = i / trail.length;                  // 0 = tail … 1 = head
          const r = (14 + t * 46 + speed * 0.6) * dpr;
          const a = (0.05 + t * 0.22) * energy;
          blob(p.x * dpr, p.y * dpr, r, a, a * 0.5);
        }
        // bold head leading the ribbon — fades out when the pointer rests
        blob(head.x * dpr, head.y * dpr, 24 * dpr, 0.9 * energy, 0.4 * energy);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    });
  } catch (e) {
    /* non-essential enhancement — never break the page */
    console.warn('[fluidCursor] disabled:', e);
  }
}
