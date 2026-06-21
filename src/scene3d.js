import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Points,
  IcosahedronGeometry, TorusGeometry, BufferGeometry, BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, PointsMaterial,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight,
  Clock, ACESFilmicToneMapping, Vector2, AdditiveBlending,
} from 'three';

// Monochrome palette to match the black & white cappen aesthetic.
const WHITE = 0xf1f0ec;
const SILVER = 0xbfbeb8;
const SPARK  = 0xff3a12;   // the one red-orange micro-accent

// An abstract "voice orb": a faceted metal core that pulses like a waveform,
// wrapped in crossed wireframe rings inside a soft particle field. Returns the
// pieces the animation loop needs.
function buildOrb(scale) {
  const orb = new Group();
  orb.scale.setScalar(scale);

  const coreGeo = new IcosahedronGeometry(1.25, 4);
  const base = coreGeo.attributes.position.array.slice();
  const coreMat = new MeshStandardMaterial({
    color: SILVER, metalness: 0.85, roughness: 0.28, flatShading: true,
  });
  const core = new Mesh(coreGeo, coreMat);
  orb.add(core);

  const shell = new Mesh(
    new IcosahedronGeometry(1.34, 2),
    new MeshBasicMaterial({ color: WHITE, wireframe: true, transparent: true, opacity: 0.16 }),
  );
  orb.add(shell);

  const ringMat = new MeshBasicMaterial({ color: WHITE, wireframe: true, transparent: true, opacity: 0.4 });
  const ringA = new Mesh(new TorusGeometry(1.95, 0.01, 8, 120), ringMat);
  ringA.rotation.x = Math.PI * 0.5;
  const ringB = new Mesh(new TorusGeometry(2.25, 0.01, 8, 120), ringMat.clone());
  ringB.rotation.set(Math.PI * 0.32, Math.PI * 0.2, 0);
  orb.add(ringA, ringB);

  // a single warm spark orbiting — the only color in the scene
  const spark = new Mesh(
    new IcosahedronGeometry(0.08, 1),
    new MeshStandardMaterial({ color: SPARK, emissive: SPARK, emissiveIntensity: 2.2, roughness: 0.3 }),
  );
  orb.add(spark);

  return { orb, core, coreGeo, base, ringA, ringB, spark };
}

function buildParticles(count, scale) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = (3.0 + Math.random() * 3.6) * scale;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({ color: WHITE, size: 0.022 * scale, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false });
  return new Points(geo, mat);
}

export function initScene3D(container, opts = {}) {
  const count = opts.count || 200;
  const scale = opts.scale || 1.0;
  const drift = !!opts.drift;

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return () => {}; // no WebGL — gradient panel behind the canvas remains as fallback
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6.6);

  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  scene.add(new AmbientLight(0xffffff, 0.45));
  scene.add(new HemisphereLight(0xffffff, 0x111111, 0.7));
  const key = new DirectionalLight(0xffffff, 2.0); key.position.set(3, 4, 5); scene.add(key);
  const rim = new PointLight(0xffffff, 3.5, 30); rim.position.set(-4, 1, 2); scene.add(rim);
  const warm = new PointLight(SPARK, 1.4, 30); warm.position.set(4, -2, 3); scene.add(warm);

  const world = new Group();
  scene.add(world);
  const { core, coreGeo, base, ringA, ringB, spark, orb } = buildOrb(scale);
  const particles = buildParticles(count, scale);
  world.add(orb, particles);

  const pointer = new Vector2(0, 0);
  const target = new Vector2(0, 0);
  let spin = 0;
  const clock = new Clock();
  let running = true;

  function onPointerMove(e) {
    const r = container.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  }
  function onLeave() { target.set(0, 0); }
  function onClick() { spin += Math.PI * 1.2; }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('click', onClick);

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const posAttr = coreGeo.attributes.position;
  const vCount = posAttr.count;

  function frame() {
    if (!running) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, clock.getDelta());

    pointer.x += (target.x - pointer.x) * 0.06;
    pointer.y += (target.y - pointer.y) * 0.06;

    world.position.y = Math.sin(t * 1.1) * 0.08 * scale;
    world.rotation.y = pointer.x * 0.7 + t * (drift ? 0.05 : 0.12) + spin;
    world.rotation.x = pointer.y * 0.4 + Math.sin(t * 0.5) * 0.05;
    spin *= Math.pow(0.92, dt * 60);

    // waveform displacement of the core verts (audio-reactive feel)
    const amp = 0.12 + Math.abs(Math.sin(t * 1.6)) * 0.06;
    for (let i = 0; i < vCount; i++) {
      const ix = i * 3;
      const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
      const n = Math.sin(bx * 3 + t * 2.4) * Math.cos(by * 3 + t * 1.8) * Math.sin(bz * 3 + t * 2.0);
      const k = 1 + n * amp;
      posAttr.array[ix] = bx * k; posAttr.array[ix + 1] = by * k; posAttr.array[ix + 2] = bz * k;
    }
    posAttr.needsUpdate = true;
    coreGeo.computeVertexNormals();

    ringA.rotation.z = t * 0.5;
    ringB.rotation.z = -t * 0.35;
    spark.position.set(Math.cos(t * 1.3) * 2.1, Math.sin(t * 0.9) * 1.4, Math.sin(t * 1.3) * 2.1);

    particles.rotation.y = t * 0.04;
    particles.rotation.x = Math.sin(t * 0.2) * 0.1;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

  function onVisibility() {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  return function cleanup() {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerleave', onLeave);
    renderer.domElement.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  };
}
