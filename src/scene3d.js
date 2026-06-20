import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Points,
  IcosahedronGeometry, TorusGeometry, BufferGeometry, BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, PointsMaterial,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight,
  Clock, ACESFilmicToneMapping, Vector2, AdditiveBlending,
} from 'three';

const ACCENT = 0x2436ff;   // cobalt
const SPARK  = 0xff5a2e;   // warm spark
const LIGHT  = 0xeae7ff;

// An abstract "voice orb": a faceted core that pulses like a waveform, wrapped
// in two crossed wireframe rings, inside a soft particle field. Returns the
// pieces the animation loop needs (core for the pulse, its base positions).
function buildOrb() {
  const orb = new Group();

  // faceted core — keep a copy of the rest positions so we can displace + restore
  const coreGeo = new IcosahedronGeometry(1.25, 4);
  const base = coreGeo.attributes.position.array.slice();
  const coreMat = new MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.35,
    metalness: 0.4, roughness: 0.25, flatShading: true,
  });
  const core = new Mesh(coreGeo, coreMat);
  orb.add(core);

  // glowing wireframe shell over the core
  const shell = new Mesh(
    new IcosahedronGeometry(1.32, 2),
    new MeshBasicMaterial({ color: LIGHT, wireframe: true, transparent: true, opacity: 0.18 }),
  );
  orb.add(shell);

  // two crossed rings
  const ringMat = new MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.5 });
  const ringA = new Mesh(new TorusGeometry(1.95, 0.012, 8, 120), ringMat);
  ringA.rotation.x = Math.PI * 0.5;
  const ringB = new Mesh(new TorusGeometry(2.25, 0.012, 8, 120), ringMat.clone());
  ringB.rotation.set(Math.PI * 0.32, Math.PI * 0.2, 0);
  orb.add(ringA, ringB);

  // a single warm spark orbiting the orb
  const spark = new Mesh(
    new IcosahedronGeometry(0.09, 1),
    new MeshStandardMaterial({ color: SPARK, emissive: SPARK, emissiveIntensity: 2.0, roughness: 0.3 }),
  );
  orb.add(spark);

  return { orb, core, coreGeo, base, ringA, ringB, spark };
}

// Soft particle field drifting behind the orb.
function buildParticles(count = 260) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 3.2 + Math.random() * 3.4;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({
    color: LIGHT, size: 0.03, transparent: true, opacity: 0.6,
    blending: AdditiveBlending, depthWrite: false,
  });
  return new Points(geo, mat);
}

export function initScene3D(container) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return () => {}; // no WebGL — the framed gradient behind the canvas remains as fallback
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6.4);

  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  // lights
  scene.add(new AmbientLight(0xffffff, 0.5));
  scene.add(new HemisphereLight(0xbcc4ff, 0x110a1a, 0.7));
  const key = new DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5); scene.add(key);
  const rim = new PointLight(ACCENT, 5.0, 30); rim.position.set(-4, 1, 2); scene.add(rim);
  const rim2 = new PointLight(SPARK, 2.0, 30); rim2.position.set(4, -2, 3); scene.add(rim2);

  // content
  const world = new Group();
  scene.add(world);
  const { orb, core, coreGeo, base, ringA, ringB, spark } = buildOrb();
  const particles = buildParticles();
  world.add(orb, particles);

  // interaction state
  const pointer = new Vector2(0, 0);
  const target = new Vector2(0, 0);
  let spin = 0;            // click impulse
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

    // ease pointer
    pointer.x += (target.x - pointer.x) * 0.06;
    pointer.y += (target.y - pointer.y) * 0.06;

    // whole rig: idle float + cursor tilt + click spin
    world.position.y = Math.sin(t * 1.1) * 0.08;
    world.rotation.y = pointer.x * 0.7 + t * 0.12 + spin;
    world.rotation.x = pointer.y * 0.4 + Math.sin(t * 0.5) * 0.05;
    spin *= Math.pow(0.92, dt * 60);

    // waveform displacement of the core verts (audio-reactive feel)
    const amp = 0.12 + Math.abs(Math.sin(t * 1.6)) * 0.06;
    for (let i = 0; i < vCount; i++) {
      const ix = i * 3;
      const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
      const len = Math.hypot(bx, by, bz) || 1;
      const n = Math.sin(bx * 3 + t * 2.4) * Math.cos(by * 3 + t * 1.8) * Math.sin(bz * 3 + t * 2.0);
      const k = 1 + n * amp;
      posAttr.array[ix]     = (bx / len) * len * k;
      posAttr.array[ix + 1] = (by / len) * len * k;
      posAttr.array[ix + 2] = (bz / len) * len * k;
    }
    posAttr.needsUpdate = true;
    coreGeo.computeVertexNormals();
    core.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 1.6)) * 0.35;

    // rings counter-rotate
    ringA.rotation.z = t * 0.5;
    ringB.rotation.z = -t * 0.35;

    // spark orbits
    spark.position.set(Math.cos(t * 1.3) * 2.1, Math.sin(t * 0.9) * 1.4, Math.sin(t * 1.3) * 2.1);

    // particles drift
    particles.rotation.y = t * 0.04;
    particles.rotation.x = Math.sin(t * 0.2) * 0.1;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

  // pause when tab hidden (saves battery/CPU)
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
