import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Background as a moving ink painting —
 * 墨の海 · 鳥居 · 花びら · 光の筆致
 * UI owns career/images; this layer is pure atmosphere.
 */

/* ——— UI ——— */
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
        setMood(e.target.dataset.mood || "mist", i);
      }
    });
  },
  { threshold: 0.32 }
);
sections.forEach((s) => io.observe(s));

railBtns.forEach((b) => {
  b.addEventListener("click", () => {
    sections[Number(b.dataset.jump)]?.scrollIntoView({ behavior: "smooth" });
  });
});

addEventListener(
  "scroll",
  () => {
    hint.style.opacity = scrollY > 80 ? "0" : "1";
  },
  { passive: true }
);

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(8262026);

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
const perm = Uint8Array.from({ length: 512 }, (_, i) => i & 255);
for (let i = 255; i > 0; i--) {
  const j = (rand() * (i + 1)) | 0;
  [perm[i], perm[j]] = [perm[j], perm[i]];
  perm[i + 256] = perm[i];
}
function noise2(x, y) {
  const X = Math.floor(x) & 255,
    Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x),
    v = fade(y);
  const aa = perm[perm[X] + Y],
    ab = perm[perm[X] + Y + 1],
    ba = perm[perm[X + 1] + Y],
    bb = perm[perm[X + 1] + Y + 1];
  const g = (h, px, py) => (h & 1 ? -px : px) + (h & 2 ? -py : py);
  return lerp(lerp(g(aa, x, y), g(ba, x - 1, y), u), lerp(g(ab, x, y - 1), g(bb, x - 1, y - 1), u), v);
}

/* ——— Renderer ——— */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a090c, 0.028);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 3.2, 18);

/* ——— Lights ——— */
const hemi = new THREE.HemisphereLight(0xffe2c8, 0x0c0814, 0.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffc9a0, 1.35);
sun.position.set(-12, 18, 8);
scene.add(sun);
const moon = new THREE.DirectionalLight(0x6a8cff, 0.15);
moon.position.set(10, 8, -6);
scene.add(moon);
const shuLight = new THREE.PointLight(0xc23a2b, 6, 50, 2);
shuLight.position.set(3, 4, 2);
scene.add(shuLight);
const kinLight = new THREE.PointLight(0xc6a45a, 3, 40, 2);
kinLight.position.set(-4, 3, 1);
scene.add(kinLight);
const neonLight = new THREE.PointLight(0xff4d6d, 0, 45, 2);
neonLight.position.set(-2, 2.5, 0);
scene.add(neonLight);
const cyanLight = new THREE.PointLight(0x5ec8d8, 0, 40, 2);
cyanLight.position.set(4, 2, -2);
scene.add(cyanLight);

/* ——— Sumi sky dome ——— */
const skyUniforms = {
  uTime: { value: 0 },
  uTop: { value: new THREE.Color(0x0b0e18) },
  uHorizon: { value: new THREE.Color(0x2a2030) },
  uGlow: { value: new THREE.Color(0xc48a5a) },
  uMood: { value: 0 },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: skyUniforms,
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop, uHorizon, uGlow;
    uniform float uTime, uMood;
    varying vec3 vPos;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
      vec2 u = f*f*(3.-2.*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
    }
    void main() {
      vec3 n = normalize(vPos);
      float h = n.y * 0.5 + 0.5;
      vec3 col = mix(uHorizon, uTop, smoothstep(0.15, 0.95, h));
      float band = exp(-pow((h - 0.42) * 5.5, 2.0));
      col += uGlow * band * (0.35 + 0.25 * uMood);
      // sumi wash grain
      float g = noise(n.xz * 4.0 + uTime * 0.02) * 0.06;
      col += g;
      // ink clouds
      float c = noise(n.xz * 2.2 + vec2(uTime * 0.01, 0.0));
      col = mix(col, col * 0.55, smoothstep(0.55, 0.85, c) * (1.0 - h) * 0.45);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 64, 32), skyMat);
scene.add(sky);

/* ——— Ink water ——— */
const waterUniforms = {
  uTime: { value: 0 },
  uColorDeep: { value: new THREE.Color(0x0a1018) },
  uColorShallow: { value: new THREE.Color(0x1a3048) },
  uSpec: { value: new THREE.Color(0xc6a45a) },
  uOpacity: { value: 0.92 },
};
const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: waterUniforms,
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = sin(p.x * 0.35 + uTime * 0.7) * 0.12
              + cos(p.y * 0.28 - uTime * 0.55) * 0.08
              + sin((p.x + p.y) * 0.15 + uTime * 0.4) * 0.06;
      p.z += w;
      vWave = w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColorDeep, uColorShallow, uSpec;
    uniform float uTime, uOpacity;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      float fres = pow(1.0 - abs(vWave) * 4.0, 2.0);
      vec3 col = mix(uColorDeep, uColorShallow, vUv.y * 0.5 + 0.25 + vWave);
      // brush-like specular strokes
      float stroke = sin(vUv.x * 40.0 + uTime * 0.8 + vWave * 10.0);
      col += uSpec * smoothstep(0.85, 1.0, stroke) * 0.15;
      col += uSpec * fres * 0.2;
      float alpha = uOpacity * (0.75 + fres * 0.2);
      gl_FragColor = vec4(col, alpha);
    }
  `,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 80, 160, 100), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -1.6;
scene.add(water);

/* ——— Distant Fuji (ink silhouette) ——— */
function buildFuji() {
  const g = new THREE.Group();
  const H = 22,
    R = 18;
  const geo = new THREE.ConeGeometry(R, H, 96, 48, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yN = THREE.MathUtils.clamp((v.y + H / 2) / H, 0, 1);
    const profile = Math.pow(1 - yN, 0.7);
    const rr = Math.hypot(v.x, v.z) || 1;
    v.x = (v.x / rr) * R * profile;
    v.z = (v.z / rr) * R * profile;
    const ang = Math.atan2(v.z, v.x);
    const fold = Math.sin(ang * 7) * 0.25 * (1 - yN) + noise2(Math.cos(ang) * 2, Math.sin(ang) * 2) * 0.4 * (1 - yN);
    const len = Math.hypot(v.x, v.z) || 1;
    v.x += (v.x / len) * fold;
    v.z += (v.z / len) * fold;
    if (yN > 0.9) v.y -= (yN - 0.9) * 6;
    pos.setXYZ(i, v.x, v.y, v.z);
    const c = new THREE.Color();
    if (yN > 0.72) c.set(0xe8eef8);
    else if (yN > 0.5) c.set(0x4a5060).lerp(new THREE.Color(0xd8e0ec), (yN - 0.5) / 0.22);
    else if (yN > 0.25) c.set(0x2a303c);
    else c.set(0x14241c);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: false,
    })
  );
  mesh.position.set(8, H / 2 - 3.5, -42);
  g.add(mesh);
  return g;
}
const fuji = buildFuji();
scene.add(fuji);

/* ——— Mist layers (sumi wash planes) ——— */
function mistTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d");
  const grd = x.createRadialGradient(256, 140, 20, 256, 128, 220);
  grd.addColorStop(0, "rgba(240,230,220,0.55)");
  grd.addColorStop(0.45, "rgba(200,190,185,0.18)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(255,255,255,${0.02 + rand() * 0.04})`;
    x.beginPath();
    x.ellipse(rand() * 512, rand() * 256, 40 + rand() * 80, 10 + rand() * 20, rand(), 0, 7);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const mistTex = mistTexture();
const mists = [];
for (let i = 0; i < 5; i++) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(50 + i * 12, 10 + i * 2),
    new THREE.MeshBasicMaterial({
      map: mistTex,
      transparent: true,
      opacity: 0.22 - i * 0.025,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  m.position.set((i - 2) * 4, -0.2 + i * 0.4, -8 - i * 5);
  m.rotation.y = (i - 2) * 0.08;
  m.userData.speed = 0.15 + i * 0.04;
  m.userData.baseX = m.position.x;
  scene.add(m);
  mists.push(m);
}

/* ——— Calligraphy ink ribbons ——— */
function makeRibbon(seed, color, width = 0.08) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = Math.sin(t * Math.PI * 2 + seed) * (6 + seed);
    const y = 1.5 + Math.sin(t * Math.PI * 3 + seed * 2) * 2.2 + t * 1.5;
    const z = -4 - t * 18 + Math.cos(t * 4 + seed) * 2;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 120, width, 6, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.4,
    transparent: true,
    opacity: 0.75,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.seed = seed;
  mesh.userData.base = pts.map((p) => p.clone());
  return mesh;
}
const ribbons = [
  makeRibbon(0.2, 0xc23a2b, 0.06),
  makeRibbon(1.1, 0xc6a45a, 0.045),
  makeRibbon(2.4, 0x5ec8d8, 0.04),
];
ribbons.forEach((r) => scene.add(r));

/* ——— Proper torii (mid-ground) ——— */
function buildTorii() {
  const g = new THREE.Group();
  const shu = new THREE.MeshStandardMaterial({
    color: 0xb83228,
    roughness: 0.48,
    metalness: 0.12,
    emissive: 0x3a0a08,
    emissiveIntensity: 0.2,
  });
  const sumi = new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.65 });
  const posts = [-2.6, 2.6].map((x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 7.4, 24), shu);
    p.position.set(x, 2.1, 0);
    g.add(p);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.35, 16), sumi);
    foot.position.set(x, -1.4, 0);
    g.add(foot);
    return p;
  });
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.42, 0.85), sumi);
  kasagi.position.set(0, 5.95, 0);
  kasagi.rotation.z = 0.015;
  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.28, 0.55), shu);
  shimaki.position.set(0, 5.35, 0);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.26, 0.48), shu);
  nuki.position.set(0, 3.55, 0);
  const gakuzuka = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.35), shu);
  gakuzuka.position.set(0, 4.45, 0);
  g.add(kasagi, shimaki, nuki, gakuzuka);
  // soft reflection ghost
  const ghost = g.clone();
  ghost.scale.y = -0.55;
  ghost.position.y = -3.1;
  ghost.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.18;
      o.material.depthWrite = false;
    }
  });
  g.add(ghost);
  g.position.set(-5.5, 0.2, -6);
  g.rotation.y = 0.35;
  void posts;
  return g;
}
const torii = buildTorii();
scene.add(torii);

/* ——— Salon lanterns (paper chochin) ——— */
function paperLanternTex() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 120);
  g.addColorStop(0, "#fff0d8");
  g.addColorStop(0.4, "#ff8a5c");
  g.addColorStop(0.75, "#c23a2b");
  g.addColorStop(1, "#3a1010");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(80,20,20,0.35)";
  x.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    x.beginPath();
    x.moveTo(0, 40 + i * 30);
    x.lineTo(256, 40 + i * 30);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const lanternTex = paperLanternTex();
const lanternGroup = new THREE.Group();
const lanterns = [];
for (let i = 0; i < 9; i++) {
  const L = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 18),
    new THREE.MeshStandardMaterial({
      map: lanternTex,
      emissive: 0xff5533,
      emissiveIntensity: 0.65,
      emissiveMap: lanternTex,
      roughness: 0.55,
      transparent: true,
      opacity: 0.92,
    })
  );
  body.scale.set(1, 1.25, 1);
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.8, 6),
    new THREE.MeshBasicMaterial({ color: 0x1a1010 })
  );
  cord.position.y = 1.2;
  L.add(body, cord);
  L.position.set(-8 + i * 2.1, 2.2 + Math.sin(i) * 0.4, -1.5 - (i % 3) * 1.2);
  L.userData.phase = i * 0.7;
  lanternGroup.add(L);
  lanterns.push(L);
}
lanternGroup.visible = false;
scene.add(lanternGroup);

/* ——— Soft neon panels (salon night, not toy cubes) ——— */
const neonPanels = new THREE.Group();
for (let i = 0; i < 7; i++) {
  const col = [0xff4d6d, 0x5ec8d8, 0xff8a5c, 0xc6a45a][i % 4];
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 2.2 + rand() * 2.5),
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
  );
  panel.position.set(6 + (i % 2) * 1.5, 1.5 + rand(), -2 - i * 1.4);
  panel.rotation.y = -0.6;
  panel.userData.pulse = rand() * 6;
  neonPanels.add(panel);
}
neonPanels.visible = false;
scene.add(neonPanels);

/* ——— Constellation of light (AI / chain — calligraphy dots) ——— */
const constellation = new THREE.Group();
const nodes = [];
const nodeMat = new THREE.MeshStandardMaterial({
  color: 0x5ec8d8,
  emissive: 0x5ec8d8,
  emissiveIntensity: 0.8,
  metalness: 0.6,
  roughness: 0.25,
});
for (let i = 0; i < 24; i++) {
  const n = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rand() * 0.05, 12, 12), nodeMat.clone());
  n.position.set((rand() - 0.5) * 14, 0.5 + rand() * 5, -2 - rand() * 12);
  constellation.add(n);
  nodes.push(n);
}
const lineMat = new THREE.LineBasicMaterial({ color: 0xc6a45a, transparent: true, opacity: 0.35 });
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[i].position.distanceTo(nodes[j].position) < 4.2) {
      const geo = new THREE.BufferGeometry().setFromPoints([nodes[i].position, nodes[j].position]);
      constellation.add(new THREE.Line(geo, lineMat));
    }
  }
}
constellation.visible = false;
scene.add(constellation);

/* ——— Sakura petals (instanced quads) ——— */
function petalTex() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(0,0,0,0)";
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#ffc0cb";
  x.beginPath();
  x.moveTo(32, 8);
  x.quadraticCurveTo(48, 20, 44, 40);
  x.quadraticCurveTo(32, 52, 20, 40);
  x.quadraticCurveTo(16, 20, 32, 8);
  x.fill();
  x.fillStyle = "rgba(255,255,255,0.35)";
  x.beginPath();
  x.ellipse(32, 28, 6, 10, 0, 0, 7);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const PETAL_N = 420;
const petalGeo = new THREE.PlaneGeometry(0.22, 0.22);
const petalMat = new THREE.MeshBasicMaterial({
  map: petalTex(),
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const petals = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_N);
const petalState = [];
const dummy = new THREE.Object3D();
for (let i = 0; i < PETAL_N; i++) {
  const s = {
    x: (rand() - 0.5) * 40,
    y: rand() * 20,
    z: (rand() - 0.5) * 30 - 5,
    rx: rand() * 6,
    ry: rand() * 6,
    rz: rand() * 6,
    vx: (rand() - 0.5) * 0.02,
    vy: -0.01 - rand() * 0.025,
    vz: (rand() - 0.5) * 0.015,
    spin: 0.01 + rand() * 0.03,
  };
  petalState.push(s);
  dummy.position.set(s.x, s.y, s.z);
  dummy.rotation.set(s.rx, s.ry, s.rz);
  dummy.updateMatrix();
  petals.setMatrixAt(i, dummy.matrix);
}
scene.add(petals);

/* ——— Post ——— */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.78);
composer.addPass(bloom);

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAmount;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float g = hash(vUv * vec2(1920.,1080.) + uTime) * 2. - 1.;
      c.rgb += g * uAmount;
      // soft vignette
      float d = distance(vUv, vec2(0.5));
      c.rgb *= smoothstep(0.95, 0.35, d);
      gl_FragColor = c;
    }
  `,
};
const filmPass = new ShaderPass(FilmShader);
composer.addPass(filmPass);
composer.addPass(new OutputPass());

/* ——— Mood ——— */
let targetSection = 0;
let mood = "dawn";
const moodState = {
  bloom: 0.5,
  hemi: 0.45,
  shu: 6,
  kin: 3,
  neon: 0,
  cyan: 0,
  moon: 0.15,
  sun: 1.35,
};

function setMood(m, sectionIndex = 0) {
  mood = m;
  targetSection = sectionIndex;
  lanternGroup.visible = m === "neon";
  neonPanels.visible = m === "neon";
  constellation.visible = m === "circuit" || m === "desk";

  if (m === "neon") {
    Object.assign(moodState, { bloom: 0.85, hemi: 0.25, shu: 4, kin: 2, neon: 14, cyan: 8, moon: 0.35, sun: 0.4 });
    skyUniforms.uTop.value.set(0x080510);
    skyUniforms.uHorizon.value.set(0x2a1020);
    skyUniforms.uGlow.value.set(0xff4d6d);
    skyUniforms.uMood.value = 1.2;
    waterUniforms.uColorDeep.value.set(0x0a0610);
    waterUniforms.uColorShallow.value.set(0x2a1528);
    waterUniforms.uSpec.value.set(0xff6b8a);
    petalMat.opacity = 0.35;
    scene.fog.density = 0.035;
  } else if (m === "circuit") {
    Object.assign(moodState, { bloom: 0.65, hemi: 0.4, shu: 3, kin: 5, neon: 1, cyan: 10, moon: 0.4, sun: 0.7 });
    skyUniforms.uTop.value.set(0x060c14);
    skyUniforms.uHorizon.value.set(0x123040);
    skyUniforms.uGlow.value.set(0x5ec8d8);
    skyUniforms.uMood.value = 0.9;
    waterUniforms.uSpec.value.set(0x5ec8d8);
    petalMat.opacity = 0.45;
    scene.fog.density = 0.03;
  } else if (m === "dawn" || m === "mist") {
    Object.assign(moodState, { bloom: 0.48, hemi: 0.55, shu: 5, kin: 4, neon: 0, cyan: 1.5, moon: 0.1, sun: 1.4 });
    skyUniforms.uTop.value.set(0x0b0e18);
    skyUniforms.uHorizon.value.set(0x3a2830);
    skyUniforms.uGlow.value.set(0xc48a5a);
    skyUniforms.uMood.value = 0.5;
    waterUniforms.uColorDeep.value.set(0x0a1018);
    waterUniforms.uColorShallow.value.set(0x1a3048);
    waterUniforms.uSpec.value.set(0xc6a45a);
    petalMat.opacity = 0.85;
    scene.fog.density = 0.026;
  } else if (m === "desk" || m === "ink") {
    Object.assign(moodState, { bloom: 0.52, hemi: 0.4, shu: 4, kin: 6, neon: 0.5, cyan: 3, moon: 0.2, sun: 0.9 });
    skyUniforms.uTop.value.set(0x0a0c12);
    skyUniforms.uHorizon.value.set(0x1e2430);
    skyUniforms.uGlow.value.set(0xc6a45a);
    skyUniforms.uMood.value = 0.6;
    petalMat.opacity = 0.5;
    scene.fog.density = 0.03;
  } else {
    Object.assign(moodState, { bloom: 0.45, hemi: 0.45, shu: 5, kin: 3.5, neon: 0, cyan: 2, moon: 0.15, sun: 1.1 });
    petalMat.opacity = 0.6;
    scene.fog.density = 0.028;
  }
}

/* ——— Interaction ——— */
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

/* ——— Animate ——— */
const t0 = performance.now();
let scrollProg = 0;

function tick() {
  const t = (performance.now() - t0) / 1000;
  const maxScroll = Math.max(1, document.body.scrollHeight - innerHeight);
  scrollProg = lerp(scrollProg, scrollY / maxScroll, 0.06);

  skyUniforms.uTime.value = t;
  waterUniforms.uTime.value = t;
  filmPass.uniforms.uTime.value = t;

  // ease lights toward mood
  bloom.strength = lerp(bloom.strength, moodState.bloom, 0.04);
  hemi.intensity = lerp(hemi.intensity, moodState.hemi, 0.04);
  shuLight.intensity = lerp(shuLight.intensity, moodState.shu, 0.04);
  kinLight.intensity = lerp(kinLight.intensity, moodState.kin, 0.04);
  neonLight.intensity = lerp(neonLight.intensity, moodState.neon, 0.04);
  cyanLight.intensity = lerp(cyanLight.intensity, moodState.cyan, 0.04);
  moon.intensity = lerp(moon.intensity, moodState.moon, 0.04);
  sun.intensity = lerp(sun.intensity, moodState.sun, 0.04);

  // cinematic camera dolly along the ink sea
  const camZ = 18 - scrollProg * 10;
  const camY = 3.2 + Math.sin(scrollProg * Math.PI) * 0.8;
  camera.position.x = lerp(camera.position.x, mouse.x * 1.4, 0.05);
  camera.position.y = lerp(camera.position.y, camY + mouse.y * 0.5, 0.05);
  camera.position.z = lerp(camera.position.z, camZ, 0.05);
  camera.lookAt(mouse.x * 0.6, 1.4 + scrollProg * 0.5, -8 - scrollProg * 6);

  // fuji breathes in mist
  fuji.position.x = 8 + Math.sin(t * 0.08) * 0.4;
  fuji.rotation.y = Math.sin(t * 0.05) * 0.02;

  torii.rotation.y = 0.35 + Math.sin(t * 0.12) * 0.04;
  torii.position.y = 0.2 + Math.sin(t * 0.4) * 0.03;

  mists.forEach((m, i) => {
    m.position.x = m.userData.baseX + Math.sin(t * m.userData.speed + i) * 2.5;
    m.material.opacity = 0.14 + Math.sin(t * 0.3 + i) * 0.04 + (mood === "neon" ? 0.05 : 0);
  });

  // living calligraphy ribbons — transform, don't rebuild geometry each frame
  ribbons.forEach((r, ri) => {
    r.rotation.z = Math.sin(t * 0.25 + ri) * 0.08;
    r.position.y = Math.sin(t * 0.4 + ri * 1.3) * 0.35;
    r.material.emissiveIntensity = 0.25 + Math.sin(t * 0.8 + ri) * 0.15;
  });

  lanterns.forEach((L) => {
    L.rotation.z = Math.sin(t * 1.2 + L.userData.phase) * 0.12;
    L.position.y += Math.sin(t * 0.9 + L.userData.phase) * 0.001;
    const body = L.children[0];
    if (body?.material) body.material.emissiveIntensity = 0.5 + Math.sin(t * 2 + L.userData.phase) * 0.25;
  });

  neonPanels.children.forEach((p) => {
    p.material.emissiveIntensity = 1.0 + Math.sin(t * 3 + p.userData.pulse) * 0.5;
  });

  nodes.forEach((n, i) => {
    n.position.y += Math.sin(t * 0.7 + i) * 0.002;
    n.material.emissiveIntensity = 0.5 + Math.sin(t * 2 + i) * 0.35;
  });
  constellation.rotation.y = t * 0.05;

  // petals
  for (let i = 0; i < PETAL_N; i++) {
    const s = petalState[i];
    s.x += s.vx + Math.sin(t * 0.5 + i) * 0.006;
    s.y += s.vy;
    s.z += s.vz;
    s.rx += s.spin;
    s.ry += s.spin * 0.7;
    if (s.y < -2) {
      s.y = 14 + rand() * 4;
      s.x = (rand() - 0.5) * 40;
      s.z = (rand() - 0.5) * 30 - 5;
    }
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(s.rx, s.ry, s.rz);
    dummy.scale.setScalar(0.7 + (i % 5) * 0.1);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
  }
  petals.instanceMatrix.needsUpdate = true;

  composer.render();
  requestAnimationFrame(tick);
}

setMood("dawn", 0);
tick();
requestAnimationFrame(() => {
  document.getElementById("loader")?.classList.add("done");
  sections[0]?.classList.add("in");
});
