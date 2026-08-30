import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Background = ON-CHAIN GAME WORLD (independent of PRESENT portfolio UI)
 * Felt table · roulette · dice · chips · minting coins · block chain · VRF aura
 */

/* —— PRESENT UI wiring only —— */
const sections = [...document.querySelectorAll(".sec")];
const railBtns = [...document.querySelectorAll("#rail button")];
const hint = document.getElementById("hint");

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      const i = Number(e.target.dataset.i);
      railBtns.forEach((b, idx) => b.classList.toggle("on", idx === i));
      document.body.dataset.mood = e.target.dataset.mood || "mist";
      setMood(e.target.dataset.mood || "mist");
    });
  },
  { threshold: 0.3 }
);
sections.forEach((s) => io.observe(s));
railBtns.forEach((b) =>
  b.addEventListener("click", () => sections[Number(b.dataset.jump)]?.scrollIntoView({ behavior: "smooth" }))
);
addEventListener("scroll", () => (hint.style.opacity = scrollY > 80 ? "0" : "1"), { passive: true });

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
const lerp = (a, b, t) => a + (b - a) * t;

/* —— Renderer —— */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x060810, 0.024);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 8, 18);

/* —— Lights —— */
const hemi = new THREE.HemisphereLight(0x9eb8ff, 0x120810, 0.4);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe0c0, 1.1);
key.position.set(-8, 16, 6);
scene.add(key);
const tableGlow = new THREE.PointLight(0x1a5c3a, 8, 40, 2);
tableGlow.position.set(0, 3, 0);
scene.add(tableGlow);
const goldL = new THREE.PointLight(0xc6a45a, 6, 35, 2);
goldL.position.set(5, 4, 3);
scene.add(goldL);
const neonL = new THREE.PointLight(0xff4d6d, 5, 40, 2);
neonL.position.set(-5, 3, 2);
scene.add(neonL);
const cyanL = new THREE.PointLight(0x5ec8d8, 4, 40, 2);
cyanL.position.set(3, 5, -4);
scene.add(cyanL);

/* —— Sky: deep casino void with grid —— */
const skyU = { uTime: { value: 0 }, uTint: { value: new THREE.Color(0x0a1020) } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(120, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyU,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uTint; varying vec3 vP;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 n=normalize(vP);
        float h=n.y*.5+.5;
        vec3 col=mix(vec3(.04,.06,.1), uTint, h);
        // holographic grid
        float g=abs(sin(n.x*18.+uTime*.1))+abs(sin(n.z*18.-uTime*.08));
        col+=vec3(.05,.15,.22)*smoothstep(1.6,1.95,g)*(1.-h*.5);
        float stars=step(.996,hash(floor(n.xz*200.)));
        col+=stars*vec3(.7,.85,1.)*(.4+.6*h);
        gl_FragColor=vec4(col,1.);
      }`,
  })
);
scene.add(sky);

/* —— Felt gaming table —— */
function feltTex() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#0d3d28";
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    x.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.04})`;
    x.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  // gold rail ring
  x.strokeStyle = "#c6a45a";
  x.lineWidth = 10;
  x.beginPath();
  x.ellipse(256, 256, 200, 140, 0, 0, 7);
  x.stroke();
  x.strokeStyle = "rgba(255,220,150,0.25)";
  x.lineWidth = 2;
  x.beginPath();
  x.ellipse(256, 256, 170, 110, 0, 0, 7);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const table = new THREE.Mesh(
  new THREE.CylinderGeometry(9, 9.4, 0.55, 64),
  new THREE.MeshStandardMaterial({
    map: feltTex(),
    roughness: 0.75,
    metalness: 0.1,
  })
);
table.position.y = -0.2;
scene.add(table);

const tableRim = new THREE.Mesh(
  new THREE.TorusGeometry(9.2, 0.22, 12, 64),
  new THREE.MeshStandardMaterial({ color: 0x8a5a2b, metalness: 0.7, roughness: 0.3, emissive: 0x3a2008, emissiveIntensity: 0.2 })
);
tableRim.rotation.x = Math.PI / 2;
tableRim.position.y = 0.15;
scene.add(tableRim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(40, 64),
  new THREE.MeshStandardMaterial({ color: 0x0a0c14, roughness: 0.35, metalness: 0.6 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.55;
scene.add(floor);

/* —— Roulette wheel (complete) —— */
const roulette = new THREE.Group();
const wheelRim = new THREE.Mesh(
  new THREE.TorusGeometry(2.8, 0.28, 16, 64),
  new THREE.MeshStandardMaterial({ color: 0xc6a45a, metalness: 0.85, roughness: 0.25, emissive: 0x5a3a10, emissiveIntensity: 0.25 })
);
wheelRim.rotation.x = Math.PI / 2;
roulette.add(wheelRim);

const wheelDisc = new THREE.Group();
for (let i = 0; i < 24; i++) {
  const seg = new THREE.Mesh(
    new THREE.CircleGeometry(2.55, 6, (i / 24) * Math.PI * 2, (Math.PI * 2) / 24),
    new THREE.MeshStandardMaterial({
      color: i % 2 ? 0xb0392f : 0x12141c,
      roughness: 0.55,
      side: THREE.DoubleSide,
      metalness: 0.2,
    })
  );
  seg.rotation.x = -Math.PI / 2;
  wheelDisc.add(seg);
}
const hub = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.55, 0.35, 24),
  new THREE.MeshStandardMaterial({ color: 0xc6a45a, metalness: 0.9, roughness: 0.2 })
);
hub.position.y = 0.15;
const cone = new THREE.Mesh(
  new THREE.ConeGeometry(0.35, 0.7, 16),
  new THREE.MeshStandardMaterial({ color: 0xe8d090, metalness: 0.85, roughness: 0.2 })
);
cone.position.y = 0.55;
wheelDisc.add(hub, cone);
roulette.add(wheelDisc);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.4, roughness: 0.2 })
);
roulette.add(ball);
roulette.position.set(-4.2, 0.35, 1.5);
scene.add(roulette);

/* —— Dice —— */
function pipFace(n) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#f4f2ee";
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = "#c6a45a";
  x.lineWidth = 4;
  x.strokeRect(4, 4, 120, 120);
  x.fillStyle = "#15161c";
  const map = {
    1: [[64, 64]],
    2: [
      [36, 36],
      [92, 92],
    ],
    3: [
      [32, 32],
      [64, 64],
      [96, 96],
    ],
    4: [
      [36, 36],
      [36, 92],
      [92, 36],
      [92, 92],
    ],
    5: [
      [36, 36],
      [36, 92],
      [64, 64],
      [92, 36],
      [92, 92],
    ],
    6: [
      [36, 28],
      [36, 64],
      [36, 100],
      [92, 28],
      [92, 64],
      [92, 100],
    ],
  }[n];
  map.forEach(([px, py]) => {
    x.beginPath();
    x.arc(px, py, 11, 0, 7);
    x.fill();
  });
  return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.4 });
}
const dice = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), [pipFace(1), pipFace(6), pipFace(2), pipFace(5), pipFace(3), pipFace(4)]);
dice.position.set(3.5, 1.2, 2.2);
scene.add(dice);

const dice2 = dice.clone();
dice2.position.set(4.8, 0.9, 1.2);
dice2.rotation.set(0.4, 0.8, 0.2);
scene.add(dice2);

/* —— Poker chips —— */
const chips = [];
const chipColors = [0xc23a2b, 0x1e2a4a, 0xc6a45a, 0x2a8f6e, 0xf0f0f0];
for (let s = 0; s < 5; s++) {
  for (let i = 0; i < 6; i++) {
    const chip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.08, 32),
      new THREE.MeshStandardMaterial({
        color: chipColors[s],
        metalness: 0.35,
        roughness: 0.4,
        emissive: chipColors[s],
        emissiveIntensity: 0.08,
      })
    );
    chip.position.set(2.2 + s * 0.15, 0.2 + i * 0.09, -2.5 + s * 0.9);
    chip.rotation.x = Math.PI / 2;
    scene.add(chip);
    chips.push(chip);
  }
}

/* —— Orbiting crypto coins —— */
function coinFace(sym, col) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = col;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(255,255,255,0.35)";
  x.lineWidth = 10;
  x.beginPath();
  x.arc(128, 128, 110, 0, 7);
  x.stroke();
  // circuit etching
  x.strokeStyle = "rgba(0,0,0,0.2)";
  x.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.beginPath();
    x.moveTo(128, 128);
    x.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
    x.stroke();
  }
  x.fillStyle = "#fff";
  x.font = "bold 110px Georgia";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(sym, 128, 138);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const coins = [];
const coinSpecs = [
  ["Ξ", "#3d5afe"],
  ["฿", "#f2a900"],
  ["◎", "#14f195"],
  ["◆", "#c23a2b"],
  ["⬡", "#5ec8d8"],
];
coinSpecs.forEach(([sym, col], i) => {
  const tex = coinFace(sym, col);
  const edge = new THREE.MeshStandardMaterial({ color: col, metalness: 0.9, roughness: 0.25, emissive: col, emissiveIntensity: 0.2 });
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.75, roughness: 0.3 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 48), [edge, face, face]);
  coin.rotation.x = Math.PI / 2;
  coin.userData = { a: (i / coinSpecs.length) * Math.PI * 2, r: 6.5 + i * 0.35, spd: 0.35 - i * 0.04, spin: 1.2 + rand() };
  scene.add(coin);
  coins.push(coin);
});

/* —— Growing block chain —— */
const chain = new THREE.Group();
const blockMat = new THREE.MeshStandardMaterial({
  color: 0x152038,
  metalness: 0.55,
  roughness: 0.35,
  emissive: 0x0a1830,
  emissiveIntensity: 0.5,
});
for (let i = 0; i < 9; i++) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), blockMat.clone());
  b.position.set(-8 + i * 1.85, 2.8 + Math.sin(i * 0.9) * 0.5, -6);
  b.rotation.y = i * 0.15;
  // hash glow face
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ color: 0x5ec8d8, transparent: true, opacity: 0.35 })
  );
  face.position.z = 0.56;
  b.add(face);
  chain.add(b);
  if (i > 0) {
    const link = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: 0xc6a45a, emissive: 0xc6a45a, emissiveIntensity: 0.4, metalness: 0.8 })
    );
    link.rotation.z = Math.PI / 2;
    link.position.set(-8 + i * 1.85 - 0.9, 2.8 + Math.sin(i * 0.9) * 0.5, -6);
    chain.add(link);
  }
}
scene.add(chain);

/* —— Holographic betting board —— */
function holoTex() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(10,20,40,0.9)";
  x.fillRect(0, 0, 512, 320);
  x.strokeStyle = "#5ec8d8";
  x.lineWidth = 2;
  x.strokeRect(12, 12, 488, 296);
  x.fillStyle = "#c6a45a";
  x.font = "600 28px sans-serif";
  x.fillText("PROVABLY FAIR  ·  VRF", 28, 52);
  x.fillStyle = "#5ec8d8";
  x.font = "18px monospace";
  const rows = ["commit  0x7a…f3", "reveal  0x91…2c", "seed    block.timestamp", "roll    (seed ⊕ salt) % 6", "payout  5.4×  ETH"];
  rows.forEach((r, i) => x.fillText(r, 36, 100 + i * 36));
  // bars
  for (let i = 0; i < 12; i++) {
    const h = 20 + rand() * 80;
    x.fillStyle = i % 2 ? "rgba(194,58,43,0.7)" : "rgba(94,200,216,0.7)";
    x.fillRect(320 + i * 14, 260 - h, 10, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const holo = new THREE.Mesh(
  new THREE.PlaneGeometry(6.5, 4),
  new THREE.MeshStandardMaterial({
    map: holoTex(),
    transparent: true,
    opacity: 0.88,
    emissive: 0x5ec8d8,
    emissiveIntensity: 0.25,
    emissiveMap: holoTex(),
    side: THREE.DoubleSide,
  })
);
holo.position.set(0, 4.5, -8);
holo.rotation.x = -0.15;
scene.add(holo);

const holoFrame = new THREE.Mesh(
  new THREE.PlaneGeometry(6.8, 4.3),
  new THREE.MeshBasicMaterial({ color: 0xc6a45a, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
);
holoFrame.position.copy(holo.position);
holoFrame.position.z -= 0.05;
holoFrame.rotation.copy(holo.rotation);
scene.add(holoFrame);

/* —— Neon pillars (game hall) —— */
const pillars = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const col = i % 2 ? 0xff4d6d : 0x5ec8d8;
  const p = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 7, 0.35),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 })
  );
  p.position.set(Math.cos(a) * 14, 3, Math.sin(a) * 14);
  p.userData.pulse = i;
  scene.add(p);
  pillars.push(p);
}

/* —— Card fans —— */
function cardTex(rank, red) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 180;
  const x = c.getContext("2d");
  x.fillStyle = "#f8f4ec";
  x.fillRect(0, 0, 128, 180);
  x.strokeStyle = "#c6a45a";
  x.strokeRect(4, 4, 120, 172);
  x.fillStyle = red ? "#c23a2b" : "#12141c";
  x.font = "bold 42px Georgia";
  x.fillText(rank, 16, 50);
  x.font = "36px Georgia";
  x.fillText(red ? "♥" : "♠", 48, 110);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cards = new THREE.Group();
["A", "K", "Q", "J", "10"].forEach((r, i) => {
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.55),
    new THREE.MeshStandardMaterial({ map: cardTex(r, i % 2 === 0), roughness: 0.5, side: THREE.DoubleSide })
  );
  card.position.set(-1.5 + i * 0.35, 0.9, -1.8);
  card.rotation.y = -0.4 + i * 0.2;
  card.rotation.x = -0.5;
  cards.add(card);
});
scene.add(cards);

/* —— Particle sparks (chip glitter / hash dust) —— */
const SPARK_N = 400;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(SPARK_N * 3);
for (let i = 0; i < SPARK_N; i++) {
  sparkPos[i * 3] = (rand() - 0.5) * 30;
  sparkPos[i * 3 + 1] = rand() * 12;
  sparkPos[i * 3 + 2] = (rand() - 0.5) * 30;
}
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(
  sparkGeo,
  new THREE.PointsMaterial({ color: 0xc6a45a, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true })
);
scene.add(sparks);

/* —— Post —— */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.65, 0.45, 0.72);
composer.addPass(bloom);
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec4 c=texture2D(tDiffuse,vUv);
        c.rgb+=(hash(vUv*1200.+uTime)*2.-1.)*0.025;
        float d=distance(vUv,vec2(.5));
        c.rgb*=smoothstep(1.0,.42,d);
        gl_FragColor=c;
      }`,
  })
);
const film = composer.passes[composer.passes.length - 1];
composer.addPass(new OutputPass());

/* —— Mood (subtle; game world stays; PRESENT UI is separate) —— */
const moodT = { bloom: 0.65, neon: 5, cyan: 4, gold: 6, table: 8 };
function setMood(m) {
  if (m === "neon") Object.assign(moodT, { bloom: 0.85, neon: 12, cyan: 8, gold: 4, table: 5 });
  else if (m === "circuit" || m === "desk") Object.assign(moodT, { bloom: 0.75, neon: 4, cyan: 12, gold: 7, table: 7 });
  else Object.assign(moodT, { bloom: 0.62, neon: 5, cyan: 4, gold: 6, table: 8 });
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
  bloom.setSize(innerWidth, innerHeight);
});

const t0 = performance.now();
let scrollProg = 0;
let ballA = 0;

function tick() {
  const t = (performance.now() - t0) / 1000;
  const maxS = Math.max(1, document.body.scrollHeight - innerHeight);
  scrollProg = lerp(scrollProg, scrollY / maxS, 0.05);

  skyU.uTime.value = t;
  film.uniforms.uTime.value = t;

  bloom.strength = lerp(bloom.strength, moodT.bloom, 0.05);
  neonL.intensity = lerp(neonL.intensity, moodT.neon, 0.05);
  cyanL.intensity = lerp(cyanL.intensity, moodT.cyan, 0.05);
  goldL.intensity = lerp(goldL.intensity, moodT.gold, 0.05);
  tableGlow.intensity = lerp(tableGlow.intensity, moodT.table, 0.05);

  // orbit camera above the game table — background only
  const camR = 16 - scrollProg * 3;
  const camY = 7.5 + Math.sin(scrollProg * Math.PI) * 1.5;
  camera.position.x = lerp(camera.position.x, Math.sin(t * 0.08) * 2 + mouse.x * 1.5, 0.04);
  camera.position.y = lerp(camera.position.y, camY + mouse.y * 0.8, 0.04);
  camera.position.z = lerp(camera.position.z, camR, 0.04);
  camera.lookAt(mouse.x * 0.5, 1.2, -2);

  // roulette
  wheelDisc.rotation.y += 0.025;
  ballA -= 0.045;
  ball.position.set(Math.cos(ballA) * 2.35, 0.28, Math.sin(ballA) * 2.35);

  // dice tumble
  dice.rotation.x += 0.02;
  dice.rotation.y += 0.028;
  dice.position.y = 1.2 + Math.abs(Math.sin(t * 2.5)) * 0.85;
  dice2.rotation.x -= 0.015;
  dice2.rotation.z += 0.02;
  dice2.position.y = 0.9 + Math.abs(Math.sin(t * 2.1 + 1)) * 0.6;

  // coins orbit
  coins.forEach((c) => {
    c.userData.a += c.userData.spd * 0.015;
    const a = c.userData.a;
    c.position.set(Math.cos(a) * c.userData.r, 2.5 + Math.sin(a * 1.4) * 1.2, Math.sin(a) * c.userData.r - 1);
    c.rotation.z += c.userData.spin * 0.04;
  });

  chain.children.forEach((b, i) => {
    if (b.geometry?.type === "BoxGeometry") b.rotation.y += 0.006 + i * 0.0004;
  });

  holo.position.y = 4.5 + Math.sin(t * 0.6) * 0.15;
  holo.material.emissiveIntensity = 0.2 + Math.sin(t * 2) * 0.08;
  holoFrame.position.copy(holo.position);
  holoFrame.position.z -= 0.05;

  pillars.forEach((p, i) => {
    p.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5 + i) * 0.5;
  });

  cards.rotation.y = Math.sin(t * 0.3) * 0.08;

  const sp = sparks.geometry.attributes.position;
  for (let i = 0; i < SPARK_N; i++) {
    let y = sp.getY(i) + 0.01 + (i % 5) * 0.002;
    if (y > 12) y = 0;
    sp.setY(i, y);
    sp.setX(i, sp.getX(i) + Math.sin(t + i) * 0.002);
  }
  sp.needsUpdate = true;

  table.rotation.y = Math.sin(t * 0.05) * 0.02;

  composer.render();
  requestAnimationFrame(tick);
}

setMood("dawn");
tick();
requestAnimationFrame(() => {
  document.getElementById("loader")?.classList.add("done");
  sections[0]?.classList.add("in");
});
