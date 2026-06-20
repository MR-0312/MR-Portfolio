import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh,
  SphereGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry,
  TetrahedronGeometry, IcosahedronGeometry, RingGeometry,
  MeshStandardMaterial, MeshBasicMaterial,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight,
  Clock, MathUtils, ACESFilmicToneMapping, Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const ACCENT = 0xc6f24e;
const BODY = 0xece9e2;
const DARK = 0x14141a;

// Build a friendly low-poly robot mascot out of primitives. Returns the group
// plus references the animation loop needs (eyes for blinking, head for tracking).
function buildRobot() {
  const robot = new Group();

  const bodyMat = new MeshStandardMaterial({ color: BODY, metalness: 0.25, roughness: 0.45 });
  const darkMat = new MeshStandardMaterial({ color: DARK, metalness: 0.4, roughness: 0.35 });
  const glowMat = new MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.6, roughness: 0.3 });

  // head
  const head = new Group();
  const headMesh = new Mesh(new RoundedBoxGeometry(1.7, 1.45, 1.45, 6, 0.42), bodyMat);
  head.add(headMesh);
  // visor / face plate
  const visor = new Mesh(new RoundedBoxGeometry(1.5, 0.95, 0.25, 5, 0.32), darkMat);
  visor.position.set(0, -0.02, 0.72);
  head.add(visor);
  // eyes
  const eyeGeo = new SphereGeometry(0.17, 24, 24);
  const eyeL = new Mesh(eyeGeo, glowMat); eyeL.position.set(-0.34, 0.05, 0.86);
  const eyeR = new Mesh(eyeGeo, glowMat); eyeR.position.set(0.34, 0.05, 0.86);
  head.add(eyeL, eyeR);
  // ear pods
  const earGeo = new CylinderGeometry(0.18, 0.18, 0.22, 20);
  const earL = new Mesh(earGeo, darkMat); earL.rotation.z = Math.PI / 2; earL.position.set(-0.92, 0, 0);
  const earR = new Mesh(earGeo, darkMat); earR.rotation.z = Math.PI / 2; earR.position.set(0.92, 0, 0);
  head.add(earL, earR);
  const earDotL = new Mesh(new SphereGeometry(0.08, 16, 16), glowMat); earDotL.position.set(-1.03, 0, 0);
  const earDotR = new Mesh(new SphereGeometry(0.08, 16, 16), glowMat); earDotR.position.set(1.03, 0, 0);
  head.add(earDotL, earDotR);
  // antenna
  const antenna = new Mesh(new CylinderGeometry(0.035, 0.035, 0.5, 12), darkMat);
  antenna.position.set(0, 0.95, 0);
  const antennaTip = new Mesh(new SphereGeometry(0.12, 20, 20), glowMat);
  antennaTip.position.set(0, 1.25, 0);
  head.add(antenna, antennaTip);
  head.position.y = 0.95;
  robot.add(head);

  // body
  const torso = new Mesh(new RoundedBoxGeometry(1.5, 1.3, 1.05, 6, 0.34), bodyMat);
  torso.position.y = -0.55;
  robot.add(torso);
  // chest light
  const chest = new Mesh(new SphereGeometry(0.16, 24, 24), glowMat);
  chest.position.set(0, -0.4, 0.56);
  robot.add(chest);

  // arms
  const armGeo = new CapsuleGeometry(0.16, 0.7, 8, 16);
  const armL = new Mesh(armGeo, bodyMat); armL.position.set(-0.96, -0.55, 0); armL.rotation.z = 0.28;
  const armR = new Mesh(armGeo, bodyMat); armR.position.set(0.96, -0.55, 0); armR.rotation.z = -0.28;
  const handL = new Mesh(new SphereGeometry(0.2, 20, 20), darkMat); handL.position.set(-1.16, -1.0, 0);
  const handR = new Mesh(new SphereGeometry(0.2, 20, 20), darkMat); handR.position.set(1.16, -1.0, 0);
  robot.add(armL, armR, handL, handR);

  return { robot, head, eyes: [eyeL, eyeR], antennaTip, chest };
}

// Floating wireframe / solid doodle shapes that orbit the mascot.
function buildDoodles() {
  const group = new Group();
  const accentWire = new MeshBasicMaterial({ color: ACCENT, wireframe: true });
  const whiteWire = new MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
  const accentSolid = new MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.4, roughness: 0.4 });

  const defs = [
    { geo: new TorusGeometry(0.45, 0.14, 14, 40), mat: accentWire, pos: [-2.5, 1.6, -0.5] },
    { geo: new IcosahedronGeometry(0.4, 0), mat: whiteWire, pos: [2.6, 1.3, -0.8] },
    { geo: new TetrahedronGeometry(0.34), mat: accentSolid, pos: [2.4, -1.3, 0.4] },
    { geo: new RingGeometry(0.3, 0.42, 32), mat: accentWire, pos: [-2.4, -1.2, 0.2] },
    { geo: new SphereGeometry(0.16, 16, 16), mat: accentSolid, pos: [-1.9, 0.1, 1.4] },
    { geo: new TorusGeometry(0.22, 0.08, 12, 30), mat: whiteWire, pos: [2.0, 0.2, 1.2] },
  ];
  const items = defs.map((d) => {
    const m = new Mesh(d.geo, d.mat);
    m.position.set(...d.pos);
    m.userData = {
      rx: Math.random() * 0.01 + 0.004,
      ry: Math.random() * 0.012 + 0.005,
      bob: Math.random() * 0.3 + 0.15,
      bobSpeed: Math.random() * 0.8 + 0.5,
      phase: Math.random() * Math.PI * 2,
      baseY: d.pos[1],
    };
    group.add(m);
    return m;
  });
  return { group, items };
}

export function initScene3D(container) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return () => {}; // no WebGL — the framed gradient behind the canvas remains as fallback
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  // lights
  scene.add(new AmbientLight(0xffffff, 0.55));
  scene.add(new HemisphereLight(0xffffff, 0x222018, 0.6));
  const key = new DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 4); scene.add(key);
  const rim = new PointLight(ACCENT, 4.0, 30); rim.position.set(-4, 1, 2); scene.add(rim);
  const rim2 = new PointLight(0x88aaff, 1.4, 30); rim2.position.set(4, -2, 3); scene.add(rim2);

  // content
  const world = new Group();
  scene.add(world);
  const { robot, head, eyes, antennaTip, chest } = buildRobot();
  const { group: doodles, items } = buildDoodles();
  world.add(robot, doodles);

  // interaction state
  const pointer = new Vector2(0, 0);
  const target = new Vector2(0, 0);
  let spin = 0;            // click impulse
  let scrollY = window.scrollY;
  const clock = new Clock();
  let blinkAt = 2.5;
  let running = true;

  function onPointerMove(e) {
    const r = container.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  }
  function onLeave() { target.set(0, 0); }
  function onClick() { spin += Math.PI * 1.4; } // surprise: a little flip
  function onScroll() { scrollY = window.scrollY; }

  // track the pointer across the whole window so the robot looks toward the cursor
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('click', onClick);
  window.addEventListener('scroll', onScroll, { passive: true });

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

    // ease pointer
    pointer.x += (target.x - pointer.x) * 0.06;
    pointer.y += (target.y - pointer.y) * 0.06;

    // whole rig: idle float + cursor tilt + scroll drift
    world.position.y = Math.sin(t * 1.1) * 0.12;
    world.rotation.y = pointer.x * 0.6 + Math.sin(t * 0.4) * 0.08 + spin;
    world.rotation.x = pointer.y * 0.32 + Math.sin(t * 0.6) * 0.04;
    world.position.x = pointer.x * 0.25;

    // head looks a touch further toward the cursor
    head.rotation.y = pointer.x * 0.35;
    head.rotation.x = pointer.y * 0.22;

    // decay the click spin
    spin *= Math.pow(0.92, dt * 60);

    // antenna + chest pulse
    const pulse = 1 + Math.sin(t * 3.2) * 0.18;
    antennaTip.scale.setScalar(pulse);
    chest.material.emissiveIntensity = 1.2 + Math.sin(t * 2.4) * 0.5;

    // blink
    if (t > blinkAt) {
      const k = (t - blinkAt);
      const s = k < 0.08 ? 1 - k / 0.08 : k < 0.16 ? (k - 0.08) / 0.08 : 1;
      eyes.forEach((e) => (e.scale.y = Math.max(0.08, s)));
      if (k > 0.16) { blinkAt = t + 2.4 + Math.random() * 2.5; eyes.forEach((e) => (e.scale.y = 1)); }
    }

    // doodles orbit + bob
    items.forEach((m) => {
      const u = m.userData;
      m.rotation.x += u.rx;
      m.rotation.y += u.ry;
      m.position.y = u.baseY + Math.sin(t * u.bobSpeed + u.phase) * u.bob;
    });
    doodles.rotation.y = -scrollY * 0.0006 + Math.sin(t * 0.2) * 0.1;

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
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  };
}
