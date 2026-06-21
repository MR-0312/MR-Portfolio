import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Points,
  IcosahedronGeometry, TorusGeometry, BufferGeometry, BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, PointsMaterial,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight,
  Clock, ACESFilmicToneMapping, Vector2, Vector3, Box3, AdditiveBlending,
} from 'three';
// GLTFLoader is imported dynamically inside loadModel() so that a CDN/addon
// failure only disables the 3D model (falling back to the procedural core),
// rather than breaking the whole site's module graph.

// Monochrome palette to match the black & white cappen aesthetic.
const WHITE = 0xf1f0ec;
const SILVER = 0xbfbeb8;
const SPARK  = 0xff3a12;   // the one red-orange micro-accent

// Load the GLB centerpiece once, recolour it to monochrome metal (keeping the
// model's normal-map detail), normalise its size, and cache the result so both
// 3D scenes can clone it.
let modelPromise = null;
function loadModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((resolve, reject) =>
      new GLTFLoader().load('/models/helmet.glb', resolve, undefined, reject));
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        const old = o.material;
        o.material = new MeshStandardMaterial({
          color: 0xb9b8b2, metalness: 0.95, roughness: 0.4,
          normalMap: old && old.normalMap ? old.normalMap : null,
        });
      }
    });
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    model.position.sub(center);                       // centre at origin
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(2.7 / maxDim);              // normalise to ~2.7 units
    return model;
  })();
  return modelPromise;
}

// Fallback faceted core if the GLB can't load — never leave the scene empty.
function buildFallbackCore() {
  return new Mesh(
    new IcosahedronGeometry(1.25, 3),
    new MeshStandardMaterial({ color: SILVER, metalness: 0.85, roughness: 0.3, flatShading: true }),
  );
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
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  scene.add(new AmbientLight(0xffffff, 0.5));
  scene.add(new HemisphereLight(0xffffff, 0x111111, 0.7));
  const key = new DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 5); scene.add(key);
  const rim = new PointLight(0xffffff, 3.5, 30); rim.position.set(-4, 1, 2); scene.add(rim);
  const warm = new PointLight(SPARK, 1.6, 30); warm.position.set(4, -2, 3); scene.add(warm);

  const world = new Group();
  scene.add(world);

  // core group — populated by the GLB (or the fallback) once ready
  const coreGroup = new Group();
  coreGroup.scale.setScalar(scale);
  world.add(coreGroup);
  loadModel()
    .then((tpl) => { coreGroup.add(tpl.clone(true)); })
    .catch((err) => { console.warn('GLB load failed — using fallback core', err); coreGroup.add(buildFallbackCore()); });

  // rings + particles + the one warm spark (instant, procedural)
  const ringMat = new MeshBasicMaterial({ color: WHITE, wireframe: true, transparent: true, opacity: 0.4 });
  const ringA = new Mesh(new TorusGeometry(1.95 * scale, 0.01 * scale, 8, 120), ringMat);
  ringA.rotation.x = Math.PI * 0.5;
  const ringB = new Mesh(new TorusGeometry(2.25 * scale, 0.01 * scale, 8, 120), ringMat.clone());
  ringB.rotation.set(Math.PI * 0.32, Math.PI * 0.2, 0);
  world.add(ringA, ringB);
  const spark = new Mesh(
    new IcosahedronGeometry(0.08 * scale, 1),
    new MeshStandardMaterial({ color: SPARK, emissive: SPARK, emissiveIntensity: 2.2, roughness: 0.3 }),
  );
  world.add(spark);
  const particles = buildParticles(count, scale);
  world.add(particles);

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

  function frame() {
    if (!running) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, clock.getDelta());

    pointer.x += (target.x - pointer.x) * 0.06;
    pointer.y += (target.y - pointer.y) * 0.06;

    world.position.y = Math.sin(t * 1.1) * 0.08 * scale;
    world.rotation.y = pointer.x * 0.7 + t * (drift ? 0.06 : 0.14) + spin;
    world.rotation.x = pointer.y * 0.4 + Math.sin(t * 0.5) * 0.05;
    spin *= Math.pow(0.92, dt * 60);

    coreGroup.rotation.y = t * 0.2;
    ringA.rotation.z = t * 0.5;
    ringB.rotation.z = -t * 0.35;
    spark.position.set(Math.cos(t * 1.3) * 2.1 * scale, Math.sin(t * 0.9) * 1.4 * scale, Math.sin(t * 1.3) * 2.1 * scale);
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
