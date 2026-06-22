// fluidTitle.js — a real-time WebGL fluid that distorts the hero title.
//
// A semi-Lagrangian Navier–Stokes fluid (velocity + dye, ping-pong FBOs,
// Jacobi pressure solve, vorticity confinement) runs on a canvas placed over
// the hero <h1>. The title text is rasterised into a texture and, in the final
// pass, its UVs are displaced by the fluid velocity field while black dye is
// composited in — so the letters of "BUILDING PRODUCTION AI SYSTEMS" melt and
// swirl under the pointer (cappen-style), and nowhere else.
//
// Progressive enhancement: returns silently (leaving the normal DOM title) if
// WebGL2 / float render targets aren't available, and never throws.
//
// Fluid algorithm follows the standard GPU technique popularised by Pavel
// Dobryakov's MIT-licensed WebGL-Fluid-Simulation, reimplemented here.

export function initFluidTitle() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const title = document.querySelector('.hero-title');
    if (!title) return;

    // capture the lines before any split/animation mutates the <h1>
    const lines = title.innerHTML.split(/<br\s*\/?>/i)
      .map((s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toUpperCase())
      .filter(Boolean);
    if (!lines.length) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'fluid-title-gl';
    Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '6' });

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false, depth: false, stencil: false });
    if (!gl) return; // no WebGL2 → keep DOM title
    if (!gl.getExtension('EXT_color_buffer_float')) return; // need float render targets
    const linFloat = !!gl.getExtension('OES_texture_float_linear');
    document.body.appendChild(canvas);

    /* ---------- gl helpers ---------- */
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const VERT = `#version 300 es
      precision highp float; in vec2 aPos; out vec2 vUv;
      void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const prog = (fragSrc) => {
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    };
    // fullscreen quad
    const quad = gl.createVertexArray(); gl.bindVertexArray(quad);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const makeFBO = (w, h, internal, format, filter) => {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.FLOAT, null);
      const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo, w, h, texelX: 1 / w, texelY: 1 / h,
        attach(id){ gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    };
    const makeDouble = (w, h, internal, format, filter) => {
      let a = makeFBO(w, h, internal, format, filter), b = makeFBO(w, h, internal, format, filter);
      return { w, h, texelX: 1/w, texelY: 1/h,
        get read(){ return a; }, get write(){ return b; }, swap(){ const t=a; a=b; b=t; } };
    };
    const blit = (target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
      draw();
    };

    /* ---------- shaders ---------- */
    const F = (body) => `#version 300 es
      precision highp float; precision highp sampler2D;
      in vec2 vUv; out vec4 frag; ${body}`;

    const splat = prog(F(`uniform sampler2D uTarget; uniform float aspect; uniform vec3 color;
      uniform vec2 point; uniform float radius;
      void main(){ vec2 p = vUv - point; p.x *= aspect; vec3 base = texture(uTarget, vUv).xyz;
      float s = exp(-dot(p,p)/radius); frag = vec4(base + s*color, 1.0); }`));
    const advection = prog(F(`uniform sampler2D uVelocity; uniform sampler2D uSource;
      uniform vec2 texel; uniform float dt; uniform float dissipation;
      void main(){ vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texel;
      frag = texture(uSource, coord) / (1.0 + dissipation * dt); }`));
    const divergence = prog(F(`uniform sampler2D uVelocity; uniform vec2 texel;
      void main(){ float L=texture(uVelocity, vUv-vec2(texel.x,0.)).x; float R=texture(uVelocity, vUv+vec2(texel.x,0.)).x;
      float T=texture(uVelocity, vUv+vec2(0.,texel.y)).y; float B=texture(uVelocity, vUv-vec2(0.,texel.y)).y;
      frag = vec4(0.5*(R-L+T-B),0.,0.,1.); }`));
    const curl = prog(F(`uniform sampler2D uVelocity; uniform vec2 texel;
      void main(){ float L=texture(uVelocity, vUv-vec2(texel.x,0.)).y; float R=texture(uVelocity, vUv+vec2(texel.x,0.)).y;
      float T=texture(uVelocity, vUv+vec2(0.,texel.y)).x; float B=texture(uVelocity, vUv-vec2(0.,texel.y)).x;
      frag = vec4(R-L-(T-B),0.,0.,1.); }`));
    const vorticity = prog(F(`uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform vec2 texel;
      uniform float curlAmt; uniform float dt;
      void main(){ float L=texture(uCurl, vUv-vec2(texel.x,0.)).x; float R=texture(uCurl, vUv+vec2(texel.x,0.)).x;
      float T=texture(uCurl, vUv+vec2(0.,texel.y)).x; float B=texture(uCurl, vUv-vec2(0.,texel.y)).x;
      float C=texture(uCurl, vUv).x; vec2 force=0.5*vec2(abs(T)-abs(B), abs(R)-abs(L));
      force /= length(force)+1e-4; force *= curlAmt*C; force.y *= -1.0;
      vec2 vel=texture(uVelocity, vUv).xy; frag=vec4(vel+force*dt,0.,1.); }`));
    const pressure = prog(F(`uniform sampler2D uPressure; uniform sampler2D uDivergence; uniform vec2 texel;
      void main(){ float L=texture(uPressure, vUv-vec2(texel.x,0.)).x; float R=texture(uPressure, vUv+vec2(texel.x,0.)).x;
      float T=texture(uPressure, vUv+vec2(0.,texel.y)).x; float B=texture(uPressure, vUv-vec2(0.,texel.y)).x;
      float div=texture(uDivergence, vUv).x; frag=vec4((L+R+T+B-div)*0.25,0.,0.,1.); }`));
    const gradSub = prog(F(`uniform sampler2D uPressure; uniform sampler2D uVelocity; uniform vec2 texel;
      void main(){ float L=texture(uPressure, vUv-vec2(texel.x,0.)).x; float R=texture(uPressure, vUv+vec2(texel.x,0.)).x;
      float T=texture(uPressure, vUv+vec2(0.,texel.y)).x; float B=texture(uPressure, vUv-vec2(0.,texel.y)).x;
      vec2 vel=texture(uVelocity, vUv).xy; vel-=vec2(R-L,T-B); frag=vec4(vel,0.,1.); }`));
    const display = prog(F(`uniform sampler2D uText; uniform sampler2D uVelocity; uniform sampler2D uDye;
      uniform vec3 paper; uniform vec3 ink; uniform float disp;
      void main(){ vec2 vel = texture(uVelocity, vUv).xy; vec2 d = vel * disp;
      float tA = texture(uText, vUv + d).a; float dye = texture(uDye, vUv).x;
      float k = clamp(tA + dye, 0.0, 1.0); frag = vec4(mix(paper, ink, k), 1.0); }`));

    /* ---------- text texture ---------- */
    const textTex = gl.createTexture();
    const tctx = document.createElement('canvas').getContext('2d');
    let dpr = 1, rect = { left: 0, top: 0, width: 0, height: 0 };
    const buildText = () => {
      const cs = getComputedStyle(title);
      const fs = parseFloat(cs.fontSize);
      const lh = (parseFloat(cs.lineHeight) || fs * 0.82);
      const w = canvas.width, h = canvas.height;
      tctx.canvas.width = w; tctx.canvas.height = h;
      tctx.clearRect(0, 0, w, h);
      tctx.fillStyle = '#fff';
      tctx.textBaseline = 'alphabetic';
      tctx.font = `900 ${fs * dpr}px ${cs.fontFamily}`;
      const padTop = 26 * dpr; const x = 26 * dpr;
      // approximate the cap block: place lines from the top with the title line-height
      let y = padTop + fs * dpr * 0.82;
      for (const ln of lines) { tctx.fillText(ln, x, y); y += lh * dpr; }
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // 2D canvas is Y-down; GL samples Y-up
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tctx.canvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    };

    /* ---------- buffers ---------- */
    const SIM = 128;
    const filt = linFloat ? gl.LINEAR : gl.NEAREST;
    let velocity, dye, divFBO, curlFBO, pressureA;
    const initBuffers = () => {
      velocity = makeDouble(SIM, SIM, gl.RG16F, gl.RG, filt);
      dye = makeDouble(SIM, SIM, gl.R16F, gl.RED, filt);
      divFBO = makeFBO(SIM, SIM, gl.R16F, gl.RED, gl.NEAREST);
      curlFBO = makeFBO(SIM, SIM, gl.R16F, gl.RED, gl.NEAREST);
      pressureA = makeDouble(SIM, SIM, gl.R16F, gl.RED, gl.NEAREST);
    };
    initBuffers();

    const PAPER = [0.98, 0.98, 0.98], INK = [0.039, 0.039, 0.039];

    /* ---------- placement ---------- */
    const place = () => {
      const r = title.getBoundingClientRect();
      const PAD = 26;
      rect = { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.left = rect.left + 'px'; canvas.style.top = rect.top + 'px';
      canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
      const nw = Math.max(2, Math.floor(rect.width * dpr)), nh = Math.max(2, Math.floor(rect.height * dpr));
      if (nw !== canvas.width || nh !== canvas.height) { canvas.width = nw; canvas.height = nh; buildText(); }
    };

    // text rendering needs the webfont; render once now and again when ready
    place();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildText);
    window.addEventListener('resize', place, { passive: true });
    window.addEventListener('scroll', place, { passive: true });

    // WebGL is live → hide the DOM title (kept for a11y/SEO/layout)
    title.style.visibility = 'hidden';

    /* ---------- pointer ---------- */
    const ptr = { x: 0, y: 0, dx: 0, dy: 0, down: false, inside: false };
    window.addEventListener('pointermove', (e) => {
      const inside = e.clientX >= rect.left && e.clientX <= rect.left + rect.width
                  && e.clientY >= rect.top && e.clientY <= rect.top + rect.height;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      ptr.dx = (nx - ptr.x); ptr.dy = (ny - ptr.y);
      ptr.x = nx; ptr.y = ny; ptr.inside = inside;
      if (inside) ptr.down = true;
    }, { passive: true });

    const doSplat = (x, y, dx, dy) => {
      const aspect = canvas.width / canvas.height;
      gl.useProgram(splat.p);
      gl.uniform1i(splat.u.uTarget, velocity.read.attach(0));
      gl.uniform1f(splat.u.aspect, aspect);
      gl.uniform2f(splat.u.point, x, y);
      gl.uniform1f(splat.u.radius, 0.0006);
      gl.uniform3f(splat.u.color, dx * 140.0, dy * 140.0, 0.0);
      blit(velocity.write); velocity.swap();
      gl.uniform1i(splat.u.uTarget, dye.read.attach(0));
      gl.uniform3f(splat.u.color, 1.0, 1.0, 1.0);
      blit(dye.write); dye.swap();
    };

    /* ---------- sim step ---------- */
    const VEL_DISS = 1.6, DYE_DISS = 1.7, PRESSURE_ITERS = 18, CURL = 9.0;
    const step = (dt) => {
      gl.disable(gl.BLEND);
      // curl + vorticity
      gl.useProgram(curl.p);
      gl.uniform2f(curl.u.texel, velocity.texelX, velocity.texelY);
      gl.uniform1i(curl.u.uVelocity, velocity.read.attach(0)); blit(curlFBO);
      gl.useProgram(vorticity.p);
      gl.uniform2f(vorticity.u.texel, velocity.texelX, velocity.texelY);
      gl.uniform1i(vorticity.u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticity.u.uCurl, curlFBO.attach(1));
      gl.uniform1f(vorticity.u.curlAmt, CURL); gl.uniform1f(vorticity.u.dt, dt);
      blit(velocity.write); velocity.swap();
      // divergence
      gl.useProgram(divergence.p);
      gl.uniform2f(divergence.u.texel, velocity.texelX, velocity.texelY);
      gl.uniform1i(divergence.u.uVelocity, velocity.read.attach(0)); blit(divFBO);
      // pressure solve
      gl.useProgram(pressure.p);
      gl.uniform2f(pressure.u.texel, velocity.texelX, velocity.texelY);
      gl.uniform1i(pressure.u.uDivergence, divFBO.attach(0));
      for (let i = 0; i < PRESSURE_ITERS; i++) {
        gl.uniform1i(pressure.u.uPressure, pressureA.read.attach(1));
        blit(pressureA.write); pressureA.swap();
      }
      // subtract gradient
      gl.useProgram(gradSub.p);
      gl.uniform2f(gradSub.u.texel, velocity.texelX, velocity.texelY);
      gl.uniform1i(gradSub.u.uPressure, pressureA.read.attach(0));
      gl.uniform1i(gradSub.u.uVelocity, velocity.read.attach(1));
      blit(velocity.write); velocity.swap();
      // advect velocity then dye
      gl.useProgram(advection.p);
      gl.uniform2f(advection.u.texel, velocity.texelX, velocity.texelY);
      gl.uniform1f(advection.u.dt, dt);
      gl.uniform1i(advection.u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advection.u.uSource, velocity.read.attach(0));
      gl.uniform1f(advection.u.dissipation, VEL_DISS);
      blit(velocity.write); velocity.swap();
      gl.uniform1i(advection.u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advection.u.uSource, dye.read.attach(1));
      gl.uniform1f(advection.u.dissipation, DYE_DISS);
      blit(dye.write); dye.swap();
    };

    /* ---------- render ---------- */
    let raf = 0, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.016, (now - last) / 1000) || 0.016; last = now;
      if (ptr.down && (Math.abs(ptr.dx) > 0 || Math.abs(ptr.dy) > 0)) { doSplat(ptr.x, ptr.y, ptr.dx, ptr.dy); ptr.dx = 0; ptr.dy = 0; }
      step(dt);
      // final: distorted text + dye, straight to screen
      gl.useProgram(display.p);
      gl.uniform1i(display.u.uText, (gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, textTex), 0));
      gl.uniform1i(display.u.uVelocity, velocity.read.attach(1));
      gl.uniform1i(display.u.uDye, dye.read.attach(2));
      gl.uniform3f(display.u.paper, PAPER[0], PAPER[1], PAPER[2]);
      gl.uniform3f(display.u.ink, INK[0], INK[1], INK[2]);
      gl.uniform1f(display.u.disp, 0.0012);
      blit(null);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
  } catch (e) {
    // any failure → leave the plain DOM title untouched
    const t = document.querySelector('.hero-title'); if (t) t.style.visibility = '';
    const c = document.querySelector('.fluid-title-gl'); if (c) c.remove();
    console.warn('[fluidTitle] WebGL effect disabled:', e);
  }
}
