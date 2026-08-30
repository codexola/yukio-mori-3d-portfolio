import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/* —— UI wiring (images + career live in HTML; Three.js is atmosphere) —— */
const sections = [...document.querySelectorAll(".sec")];
const railBtns = [...document.querySelectorAll("#rail button")];
const hint = document.getElementById("hint");

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        const i = Number(e.target.dataset.i);
        railBtns.forEach((b, idx) => b.classList.toggle("on", idx === i));
        document.body.dataset.mood = e.target.dataset.mood || "mist";
        setMood(e.target.dataset.mood || "mist");
      }
    });
  },
  { threshold: 0.35 }
);
sections.forEach((s) => io.observe(s));

railBtns.forEach((b) => {
  b.addEventListener("click", () => {
    const i = Number(b.dataset.jump);
    sections[i]?.scrollIntoView({ behavior: "smooth" });
  });
});

addEventListener("scroll", () => {
  hint.style.opacity = scrollY > 80 ? "0" : "1";
}, { passive: true });

/* —— Three.js ambient layer —— */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 2, 14);

const hemi = new THREE.HemisphereLight(0xffe8d0, 0x1a1020, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd2a8, 1.2);
key.position.set(-6, 10, 4);
scene.add(key);
const accent = new THREE.PointLight(0xc23a2b, 4, 40);
accent.position.set(4, 3, 2);
scene.add(accent);
const cyan = new THREE.PointLight(0x5ec8d8, 2, 35);
cyan.position.set(-5, 2, -2);
scene.add(cyan);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(310826);

/* floating particles — sakura / embers / ash by mood */
const PARTICLE_N = 500;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLE_N * 3);
const pVel = [];
for (let i = 0; i < PARTICLE_N; i++) {
  pPos[i * 3] = (rand() - 0.5) * 30;
  pPos[i * 3 + 1] = rand() * 16 - 2;
  pPos[i * 3 + 2] = (rand() - 0.5) * 20 - 4;
  pVel.push({
    x: (rand() - 0.5) * 0.015,
    y: -0.008 - rand() * 0.02,
    z: (rand() - 0.5) * 0.01,
  });
}
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: 0xffb7c5,
  size: 0.08,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  sizeAttenuation: true,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/* subtle torii silhouette */
const torii = new THREE.Group();
const vermillion = new THREE.MeshStandardMaterial({
  color: 0xc23a2b,
  metalness: 0.25,
  roughness: 0.55,
  emissive: 0x4a1008,
  emissiveIntensity: 0.35,
});
const black = new THREE.MeshStandardMaterial({ color: 0x1a1520, roughness: 0.7 });
for (const x of [-2.2, 2.2]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 16), vermillion);
  post.position.set(x, 0.5, -6);
  torii.add(post);
}
const kasagi = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 0.7), black);
kasagi.position.set(0, 3.85, -6);
const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 0.45), vermillion);
nuki.position.set(0, 2.6, -6);
torii.add(kasagi, nuki);
scene.add(torii);

/* holographic ring — chain/AI motif */
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.2, 0.03, 12, 96),
  new THREE.MeshBasicMaterial({ color: 0x5ec8d8, transparent: true, opacity: 0.55 })
);
ring.rotation.x = Math.PI / 2.4;
ring.position.set(0, 1.2, -2);
scene.add(ring);

const ring2 = ring.clone();
ring2.scale.set(1.35, 1.35, 1.35);
ring2.material = new THREE.MeshBasicMaterial({ color: 0xc6a45a, transparent: true, opacity: 0.3 });
scene.add(ring2);

/* ledger cubes orbiting softly */
const ledger = new THREE.Group();
for (let i = 0; i < 8; i++) {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x1e2438,
      metalness: 0.7,
      roughness: 0.25,
      emissive: 0x5ec8d8,
      emissiveIntensity: 0.25,
    })
  );
  const a = (i / 8) * Math.PI * 2;
  cube.position.set(Math.cos(a) * 4.5, Math.sin(a * 2) * 0.4, Math.sin(a) * 4.5 - 2);
  cube.userData.a = a;
  ledger.add(cube);
}
scene.add(ledger);

/* lantern glow spheres — salon night */
const lanterns = [];
for (let i = 0; i < 6; i++) {
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff6b4a,
      emissive: 0xff3355,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    })
  );
  lamp.position.set((rand() - 0.5) * 10, 1 + rand() * 3, -3 - rand() * 4);
  scene.add(lamp);
  lanterns.push(lamp);
}

let mood = "dawn";
function setMood(m) {
  mood = m;
  if (m === "neon") {
    pMat.color.set(0xff6b8a);
    accent.intensity = 10;
    cyan.intensity = 6;
    bloom.strength = 0.7;
    hemi.intensity = 0.3;
  } else if (m === "circuit") {
    pMat.color.set(0x9ef0ff);
    accent.intensity = 3;
    cyan.intensity = 8;
    bloom.strength = 0.55;
    hemi.intensity = 0.45;
  } else if (m === "dawn" || m === "mist") {
    pMat.color.set(0xffb7c5);
    accent.intensity = 4;
    cyan.intensity = 2;
    bloom.strength = 0.4;
    hemi.intensity = 0.6;
  } else if (m === "desk" || m === "ink") {
    pMat.color.set(0xc6a45a);
    accent.intensity = 5;
    cyan.intensity = 3;
    bloom.strength = 0.45;
    hemi.intensity = 0.5;
  } else {
    pMat.color.set(0xe8d5b5);
    accent.intensity = 4;
    cyan.intensity = 2.5;
    bloom.strength = 0.4;
  }
}

const mouse = { x: 0, y: 0 };
addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
});

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const t0 = performance.now();
function tick() {
  const t = (performance.now() - t0) / 1000;

  camera.position.x = mouse.x * 0.8;
  camera.position.y = 2 + mouse.y * 0.4;
  camera.lookAt(mouse.x * 0.3, 1.2, -4);

  torii.rotation.y = Math.sin(t * 0.15) * 0.08;
  ring.rotation.z = t * 0.2;
  ring2.rotation.z = -t * 0.12;
  ring.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.3) * 0.1;

  ledger.children.forEach((c, i) => {
    c.userData.a += 0.006;
    const a = c.userData.a;
    c.position.set(Math.cos(a) * 4.5, Math.sin(t + i) * 0.5 + 1, Math.sin(a) * 4.5 - 2);
    c.rotation.x += 0.01;
    c.rotation.y += 0.015;
  });

  lanterns.forEach((l, i) => {
    l.material.emissiveIntensity = 0.8 + Math.sin(t * 2.5 + i) * 0.45;
    l.position.y += Math.sin(t + i) * 0.0015;
  });

  const pos = particles.geometry.attributes.position;
  for (let i = 0; i < PARTICLE_N; i++) {
    let x = pos.getX(i) + pVel[i].x + Math.sin(t + i) * 0.004;
    let y = pos.getY(i) + pVel[i].y;
    let z = pos.getZ(i) + pVel[i].z;
    if (y < -3) {
      y = 12;
      x = (rand() - 0.5) * 30;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;

  composer.render();
  requestAnimationFrame(tick);
}

setMood("dawn");
tick();
requestAnimationFrame(() => {
  document.getElementById("loader").classList.add("done");
  sections[0]?.classList.add("in");
});
