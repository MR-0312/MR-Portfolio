// neuralField.js — an interactive "neural network" behind the hero.
//
// Drifting nodes are wired together by proximity; signal pulses race along the
// connections (neurons firing); and the network lights up and links to your
// cursor like a live neuron. Pure 2D canvas, monochrome, themed for an AI
// engineer. Reliable everywhere (no WebGL), degrades to an ambient drift on
// touch / reduced-motion, and never throws (so it can't break the page).
export function initNeuralField() {
  try {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const fine = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
    const inner = hero.querySelector('.hero-inner');
    if (inner) { inner.style.position = 'relative'; inner.style.zIndex = '1'; }

    const canvas = document.createElement('canvas');
    canvas.className = 'neural-field';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', zIndex: '0', pointerEvents: 'none' });
    hero.insertBefore(canvas, hero.firstChild);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const INK = '10,10,10';
    let w = 0, h = 0, dpr = 1, LINK = 150, nodes = [], pulses = [];

    const build = () => {
      const r = hero.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.width = Math.max(1, Math.floor(r.width * dpr));
      h = canvas.height = Math.max(1, Math.floor(r.height * dpr));
      LINK = Math.min(190, Math.max(120, r.width / 9)) * dpr;
      const count = Math.round(Math.min(96, Math.max(34, (r.width * r.height) / 15000)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.14 * dpr, vy: (Math.random() - 0.5) * 0.14 * dpr,
          ph: Math.random() * Math.PI * 2,
        });
      }
    };
    build();
    window.addEventListener('resize', build, { passive: true });

    const ptr = { x: -1e5, y: -1e5, on: false };
    if (fine) {
      window.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        ptr.on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        ptr.x = (e.clientX - r.left) * dpr; ptr.y = (e.clientY - r.top) * dpr;
      }, { passive: true });
      window.addEventListener('pointerleave', () => { ptr.on = false; }, { passive: true });
    }

    const PR = 210 * dpr;            // cursor influence radius
    const spawnPulse = () => {
      const a = nodes[(Math.random() * nodes.length) | 0];
      let best = null, bd = (LINK * 1.05) ** 2;
      for (const b of nodes) {
        if (b === a) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = b; }
      }
      if (best) pulses.push({ a, b: best, t: 0, sp: 0.018 + Math.random() * 0.022 });
    };

    let raf = 0, f = 0;
    const tick = () => {
      f++;
      ctx.clearRect(0, 0, w, h);
      const link2 = LINK * LINK;

      // move nodes (+ gentle pull toward the cursor)
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) n.x += w; else if (n.x > w) n.x -= w;
        if (n.y < 0) n.y += h; else if (n.y > h) n.y -= h;
        if (ptr.on) {
          const dx = ptr.x - n.x, dy = ptr.y - n.y, d = Math.hypot(dx, dy);
          if (d < PR && d > 1) { const fce = (1 - d / PR) * 0.4; n.x += (dx / d) * fce; n.y += (dy / d) * fce; }
        }
      }

      // edges — brighten where they pass near the cursor
      ctx.lineWidth = dpr;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 >= link2) continue;
          const close = 1 - Math.sqrt(d2) / LINK;
          let al = close * 0.16;
          if (ptr.on) {
            const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5;
            const pd = Math.hypot(ptr.x - mx, ptr.y - my);
            if (pd < PR) al += (1 - pd / PR) * close * 0.5;   // lit region around the cursor
          }
          ctx.strokeStyle = `rgba(${INK},${al})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      // cursor links into the network (the cursor as a live neuron)
      if (ptr.on) {
        for (const n of nodes) {
          const dx = ptr.x - n.x, dy = ptr.y - n.y, d = Math.hypot(dx, dy);
          if (d < PR) {
            ctx.strokeStyle = `rgba(${INK},${(1 - d / PR) * 0.55})`;
            ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(n.x, n.y); ctx.stroke();
          }
        }
      }

      // nodes (subtle breathing; brighter near the cursor)
      for (const n of nodes) {
        let a = 0.45 + Math.sin(f * 0.03 + n.ph) * 0.12;
        let rad = 1.5 * dpr;
        if (ptr.on) { const d = Math.hypot(ptr.x - n.x, ptr.y - n.y); if (d < PR) { const k = 1 - d / PR; a += k * 0.4; rad += k * 1.6 * dpr; } }
        ctx.fillStyle = `rgba(${INK},${Math.min(1, a)})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, 6.283); ctx.fill();
      }

      // cursor node
      if (ptr.on) {
        ctx.fillStyle = `rgba(${INK},0.9)`;
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 3 * dpr, 0, 6.283); ctx.fill();
      }

      // signal pulses travelling along edges (neurons firing)
      if (!reduce && f % (ptr.on ? 5 : 13) === 0) spawnPulse();
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]; p.t += p.sp;
        if (p.t >= 1) { pulses.splice(i, 1); continue; }
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        const a = Math.sin(p.t * Math.PI) * 0.95;
        ctx.fillStyle = `rgba(${INK},${a})`;
        ctx.beginPath(); ctx.arc(x, y, 2.6 * dpr, 0, 6.283); ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(tick); });
  } catch (e) {
    console.warn('[neuralField] disabled:', e);
  }
}
