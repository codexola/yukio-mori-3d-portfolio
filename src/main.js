import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a101c, 0.0095);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 3000);
camera.position.set(0, 10, 48);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xc8d6ff, 0x1a1420, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b8, 1.8);
sun.position.set(-40, 55, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(sun);
const moon = new THREE.DirectionalLight(0x6a8cff, 0.15);
moon.position.set(30, 20, -20);
scene.add(moon);
const lamp = new THREE.PointLight(0xffb070, 0, 28, 2);
lamp.position.set(0, 6, 0);
scene.add(lamp);
const neonA = new THREE.PointLight(0xff3355, 0, 35, 2);
const neonB = new THREE.PointLight(0x33ddff, 0, 35, 2);
scene.add(neonA, neonB);

/* ---------- sky ---------- */
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 8;
skyCanvas.height = 512;
const skyCtx = skyCanvas.getContext("2d");
const skyTex = new THREE.CanvasTexture(skyCanvas);
scene.background = skyTex;

function paintSky(dayness) {
  const g = skyCtx.createLinearGradient(0, 0, 0, 512);
  const top = lerpColor("#04060c", "#6eb6ff", dayness);
  const mid = lerpColor("#0c1530", "#b7d4f0", dayness);
  const hor = lerpColor("#1a1028", "#f0c9a0", dayness);
  const ground = lerpColor("#080a12", "#d8b898", dayness);
  g.addColorStop(0, top);
  g.addColorStop(0.45, mid);
  g.addColorStop(0.78, hor);
  g.addColorStop(1, ground);
  skyCtx.fillStyle = g;
  skyCtx.fillRect(0, 0, 8, 512);
  skyTex.needsUpdate = true;
}

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}

paintSky(0.65);

/* ---------- noise ---------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260830);
const perm = Array.from({ length: 256 }, (_, i) => i);
for (let i = 255; i > 0; i--) {
  const j = (rand() * (i + 1)) | 0;
  [perm[i], perm[j]] = [perm[j], perm[i]];
}
const P = new Uint8Array(512);
for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function grad(h, x, y) {
  return (h & 1 ? -x : x) + (h & 2 ? -y : y);
}
function noise2(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x);
  const v = fade(y);
  const aa = P[P[X] + Y];
  const ab = P[P[X] + Y + 1];
  const ba = P[P[X + 1] + Y];
  const bb = P[P[X + 1] + Y + 1];
  return lerp(lerp(grad(aa, x, y), grad(ba, x - 1, y), u), lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u), v);
}
function fbm(x, y, oct = 5) {
  let a = 0,
    amp = 0.5,
    f = 1;
  for (let i = 0; i < oct; i++) {
    a += amp * noise2(x * f, y * f);
    f *= 2;
    amp *= 0.5;
  }
  return a;
}

/* ---------- post ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.4, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- helpers ---------- */
const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  return new Promise((resolve) => {
    texLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function imagePlane(tex, w = 20, h = 11.25) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.05,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.18,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.castShadow = true;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x1a1520, metalness: 0.4, roughness: 0.55 })
  );
  frame.position.z = -0.12;
  const gold = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.28, h + 0.28),
    new THREE.MeshBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0.22 })
  );
  gold.position.z = -0.02;
  g.add(frame, gold, mesh);
  return g;
}

function makeLabel(text, color = "#f3ebe1") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const x = c.getContext("2d");
  x.clearRect(0, 0, 512, 128);
  x.fillStyle = "rgba(10,12,20,0.55)";
  x.beginPath();
  x.moveTo(20, 24);
  x.arcTo(504, 24, 504, 104, 12);
  x.arcTo(504, 104, 8, 104, 12);
  x.arcTo(8, 104, 8, 24, 12);
  x.arcTo(8, 24, 504, 24, 12);
  x.closePath();
  x.fill();
  x.fillStyle = color;
  x.font = "600 42px Syne, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  spr.scale.set(6, 1.5, 1);
  return spr;
}

function nodeBox(label, color, w = 3.2, h = 1.6, d = 1.2) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.28,
    emissive: color,
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  const spr = makeLabel(label);
  spr.position.y = h * 0.9;
  g.add(spr);
  g.userData.pulse = rand() * Math.PI * 2;
  return g;
}

function linkLine(a, b, color = 0xc9a24a) {
  const points = [a.clone(), b.clone()];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
  );
}

const STEP = 70;
const groups = [];
function station(i) {
  const g = new THREE.Group();
  g.position.z = -i * STEP;
  scene.add(g);
  groups[i] = g;
  return g;
}

/* animatable refs */
const rivers = [];
const coins = [];
const neonSigns = [];
const archNodes = [];
const floatingCode = [];
let dice, wheel, ball, deskGroup, monitorGlow, sakura, stars;
let careerCards = [];

function makeStars(count = 1400) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 400;
    pos[i * 3 + 1] = rand() * 120 + 20;
    pos[i * 3 + 2] = (rand() - 0.5) * 800 - 200;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xdde8ff,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
}

function makeSakura(count = 400) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 80;
    pos[i * 3 + 1] = rand() * 40;
    pos[i * 3 + 2] = (rand() - 0.5) * 600;
    vel.push({ x: (rand() - 0.5) * 0.02, y: -0.01 - rand() * 0.03, z: (rand() - 0.5) * 0.01 });
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xffb7c5,
      size: 0.45,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  pts.userData.vel = vel;
  return pts;
}

function makeCodeRain(parent, n = 60) {
  const glyphs = "01<>{}[]/RAGΛΣ¥$#";
  for (let i = 0; i < n; i++) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#7dffb3";
    x.font = "bold 40px monospace";
    x.textAlign = "center";
    x.fillText(glyphs[(rand() * glyphs.length) | 0], 32, 44);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false })
    );
    spr.scale.set(0.9, 0.9, 1);
    spr.position.set((rand() - 0.5) * 28, rand() * 16, (rand() - 0.5) * 20);
    spr.userData.vy = 0.02 + rand() * 0.05;
    spr.userData.baseY = spr.position.y;
    parent.add(spr);
    floatingCode.push(spr);
  }
}

/** 富士山 — 凹カーブ・雪・樹林帯・岩肌（砂丘に見えないよう） */
function buildMountFuji() {
  const root = new THREE.Group();
  const H = 32;
  const R = 24;
  const geo = new THREE.ConeGeometry(R, H, 96, 64, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yN = THREE.MathUtils.clamp((v.y + H / 2) / H, 0, 1);
    // classic Fuji: concave profile (steeper near summit)
    const profile = Math.pow(1 - yN, 0.72);
    const rr = Math.hypot(v.x, v.z) || 1;
    const targetR = R * profile;
    v.x = (v.x / rr) * targetR;
    v.z = (v.z / rr) * targetR;
    // subtle radial ridges (lava folds), not dune waves
    const ang = Math.atan2(v.z, v.x);
    const fold = Math.sin(ang * 8) * 0.35 * (1 - yN) + fbm(Math.cos(ang) * 3, Math.sin(ang) * 3, 3) * 0.55 * (1 - yN);
    v.x += (v.x / (Math.hypot(v.x, v.z) || 1)) * fold;
    v.z += (v.z / (Math.hypot(v.x, v.z) || 1)) * fold;
    // flattened crater lip near tip
    if (yN > 0.92) v.y -= (yN - 0.92) * 8;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const yN = THREE.MathUtils.clamp((pos.getY(i) + H / 2) / H, 0, 1);
    const c = new THREE.Color();
    if (yN > 0.72) {
      // snow cap — pure white/blue ice
      c.set(0xf4f8ff).lerp(new THREE.Color(0xdce8f8), (yN - 0.72) / 0.28);
    } else if (yN > 0.55) {
      // volcanic rock / ash grey
      c.set(0x4a4e58).lerp(new THREE.Color(0xf0f4fc), (yN - 0.55) / 0.17);
    } else if (yN > 0.28) {
      // mid rock brown-grey (not sand gold)
      c.set(0x3a3f4a).lerp(new THREE.Color(0x5a616e), (yN - 0.28) / 0.27);
    } else {
      // forest belt — deep green
      c.set(0x1a3a28).lerp(new THREE.Color(0x2f4a38), yN / 0.28);
    }
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const mountain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: false,
    })
  );
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  mountain.position.y = H / 2 - 6;
  root.add(mountain);

  // snow cap overlay dome for readability
  const snow = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.55, metalness: 0.05, emissive: 0xb0c4e0, emissiveIntensity: 0.08 })
  );
  snow.position.y = H - 8.2;
  snow.scale.set(1.15, 0.55, 1.15);
  root.add(snow);

  // forest ring of simple trees around base
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f4a30, roughness: 0.85 });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + rand() * 0.2;
    const rad = 18 + rand() * 6;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6), trunkMat);
    trunk.position.y = 0.7;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7 + rand() * 0.3, 2.2 + rand(), 7), leafMat);
    leaf.position.y = 2.2;
    tree.add(trunk, leaf);
    tree.position.set(Math.cos(a) * rad, -5.2, Math.sin(a) * rad);
    root.add(tree);
  }

  // soft cloud sea (puffy spheres, not flat sand discs)
  for (let i = 0; i < 36; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(3 + rand() * 4, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xeef3ff,
        transparent: true,
        opacity: 0.45,
        roughness: 1,
        depthWrite: false,
      })
    );
    const a = rand() * Math.PI * 2;
    const rad = 14 + rand() * 40;
    puff.position.set(Math.cos(a) * rad, -4.5 + rand() * 2.5, Math.sin(a) * rad);
    puff.scale.set(1.4 + rand(), 0.35 + rand() * 0.25, 1.1 + rand());
    puff.userData.spin = (rand() - 0.5) * 0.01;
    root.add(puff);
  }

  const tag = makeLabel("山  ·  富士山  FUJI", "#e8f0ff");
  tag.scale.set(10, 2.4, 1);
  tag.position.set(0, 28, 8);
  root.add(tag);
  return root;
}

/** 山脈 — 鋭い稜線・岩・残雪（砂丘ではない） */
function buildAlpineRange() {
  const root = new THREE.Group();
  const W = 48;
  const D = 36;
  const SEG = 90;
  const geo = new THREE.PlaneGeometry(W, D, SEG, Math.floor((SEG * D) / W));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // sharp ridge spine along X
    const ridge = Math.exp(-Math.pow(z / 8, 2)) * 14;
    const peaks = Math.abs(fbm(x * 0.08 + 2, z * 0.08, 5));
    const jagged = Math.pow(peaks, 1.35) * 10;
    let y = ridge + jagged - 4;
    // valleys cut
    y -= Math.abs(Math.sin(x * 0.15)) * 1.5;
    y = Math.max(y, -3);
    pos.setY(i, y);
    const yN = THREE.MathUtils.clamp((y + 3) / 22, 0, 1);
    const c = new THREE.Color();
    if (yN > 0.7) c.set(0xf2f6ff); // snow
    else if (yN > 0.45) c.set(0x6a7080).lerp(new THREE.Color(0xc8d0dc), (yN - 0.45) / 0.25); // rock
    else c.set(0x1c3d2a).lerp(new THREE.Color(0x3d5a40), yN / 0.45); // alpine forest
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);

  // extra conical peaks for silhouette clarity
  for (let i = 0; i < 5; i++) {
    const ph = 8 + rand() * 7;
    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(2.2 + rand(), ph, 7),
      new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 0.9, flatShading: true })
    );
    peak.position.set(-16 + i * 8, ph / 2 - 2, (rand() - 0.5) * 4);
    root.add(peak);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 2.2, 7),
      new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.7 })
    );
    cap.position.set(peak.position.x, peak.position.y + ph / 2 - 0.4, peak.position.z);
    root.add(cap);
  }

  const tag = makeLabel("山  ·  北アルプス", "#dce6f5");
  tag.scale.set(8, 2, 1);
  tag.position.set(0, 16, 10);
  root.add(tag);
  return root;
}

/** 川 — 青い水流・緑の岸・河原石 */
function buildRiverValley() {
  const root = new THREE.Group();
  // valley banks
  const bankGeo = new THREE.PlaneGeometry(40, 70, 40, 60);
  bankGeo.rotateX(-Math.PI / 2);
  const bp = bankGeo.attributes.position;
  const bcols = [];
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const z = bp.getZ(i);
    const valley = Math.min(1, Math.abs(x) / 8);
    const y = valley * valley * 5 + fbm(x * 0.1, z * 0.1, 3) * 0.8 - 1;
    bp.setY(i, y);
    const c = new THREE.Color(0x2a4a30).lerp(new THREE.Color(0x6b7a4a), valley);
    bcols.push(c.r, c.g, c.b);
  }
  bankGeo.setAttribute("color", new THREE.Float32BufferAttribute(bcols, 3));
  bankGeo.computeVertexNormals();
  root.add(
    new THREE.Mesh(bankGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }))
  );

  function riverRibbon(offset, width, tint) {
    const len = 68;
    const seg = 120;
    const geo = new THREE.PlaneGeometry(width, len, 8, seg);
    geo.rotateX(-Math.PI / 2);
    const curve = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.push(Math.sin(t * 5 + offset) * 3.5 + Math.sin(t * 1.7 + offset) * 2);
    }
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const zi = Math.round((pos.getZ(i) / len + 0.5) * seg);
      pos.setX(i, pos.getX(i) + (curve[zi] ?? 0));
      pos.setY(i, 0.15);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: tint,
        roughness: 0.08,
        metalness: 0.65,
        emissive: tint,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.92,
      })
    );
    m.position.y = -0.6;
    m.userData.base = geo.attributes.position.array.slice();
    root.add(m);
    rivers.push(m);
  }
  riverRibbon(0, 5.5, 0x1a7aad);
  riverRibbon(0.4, 3.2, 0x3db4d8);

  // river stones
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a7e88, roughness: 0.7 });
  for (let i = 0; i < 20; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + rand() * 0.4, 6, 5), stoneMat);
    s.position.set((rand() - 0.5) * 8, -0.35, (rand() - 0.5) * 50);
    s.scale.set(1, 0.45, 0.8);
    root.add(s);
  }

  // bank trees
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d6b2e, roughness: 0.85 });
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? 1 : -1;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 6), leafMat);
    cone.position.set(side * (7 + rand() * 4), 1.2, -28 + i * 2.4);
    root.add(cone);
  }

  const tag = makeLabel("川  ·  信濃川・利根川", "#9fe0ff");
  tag.scale.set(9, 2.2, 1);
  tag.position.set(0, 10, 8);
  root.add(tag);
  return root;
}

/** 名所 — 鳥居・竹林・水面（観光名所として明確） */
function buildScenicSpot() {
  const root = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(18, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a4060, roughness: 0.15, metalness: 0.7 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2;
  root.add(water);

  const red = new THREE.MeshStandardMaterial({ color: 0xd0342c, roughness: 0.5, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.65 });
  const torii = new THREE.Group();
  for (const sx of [-3.2, 3.2]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 11, 20), red);
    pillar.position.set(sx, 3.5, 0);
    pillar.castShadow = true;
    torii.add(pillar);
  }
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 1.8), black);
  kasagi.position.y = 9.2;
  const shimagi = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 1.3), red);
  shimagi.position.y = 7.6;
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(9, 0.55, 1.1), red);
  nuki.position.y = 5.4;
  torii.add(kasagi, shimagi, nuki);
  torii.position.set(0, -2, 2);
  root.add(torii);

  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.7 });
  for (let i = 0; i < 40; i++) {
    const hh = 10 + rand() * 8;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, hh, 8), bambooMat);
    stalk.position.set(6 + rand() * 10, hh / 2 - 2, (rand() - 0.5) * 16);
    stalk.rotation.z = (rand() - 0.5) * 0.08;
    root.add(stalk);
  }

  // small shrine roof hint
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 2.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.8 })
  );
  roof.position.set(-8, 2, -4);
  roof.rotation.y = Math.PI / 4;
  root.add(roof);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.5, 4),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.85 })
  );
  base.position.set(-8, 0, -4);
  root.add(base);

  const tag = makeLabel("名所  ·  厳島・嵐山", "#ffd0c0");
  tag.scale.set(9, 2.2, 1);
  tag.position.set(0, 12, 10);
  root.add(tag);
  return root;
}

async function build() {
  const imgs = await Promise.all(
    [
      "/images/mt-fuji-dawn.png",
      "/images/japan-river-autumn.png",
      "/images/kyoto-scenic.png",
      "/images/itsukushima-torii.png",
      "/images/neon-district-night.png",
      "/images/district-figures.png",
      "/images/crypto-japan.png",
      "/images/betting-blockchain.png",
    ].map(loadTex)
  );
  const [fujiTex, riverTex, kyotoTex, toriiTex, neonTex, figuresTex, cryptoTex, bettingTex] = imgs;

  stars = makeStars();
  scene.add(stars);
  sakura = makeSakura();
  scene.add(sakura);

  /* ===== 0 Hero — 明確な富士山 ===== */
  {
    const g = station(0);
    const fuji = buildMountFuji();
    fuji.position.set(4, 0, -6);
    g.add(fuji);

    if (fujiTex) {
      const p = imagePlane(fujiTex, 16, 9);
      p.position.set(-20, 8, 4);
      p.rotation.y = 0.55;
      g.add(p);
    }

    const title = makeLabel("森 幸夫  ·  MORI YUKIO", "#ffd7a0");
    title.scale.set(12, 3, 1);
    title.position.set(-16, 16, 10);
    g.add(title);
  }

  /* ===== 1 Profile pillars ===== */
  {
    const g = station(1);
    const labels = ["課題起点", "0→1〜運用", "グローバル"];
    const colors = [0xc43b2c, 0xc9a24a, 0x4a7dff];
    labels.forEach((lb, i) => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.8, 10 + i * 2, 24),
        new THREE.MeshStandardMaterial({
          color: colors[i],
          metalness: 0.45,
          roughness: 0.35,
          emissive: colors[i],
          emissiveIntensity: 0.25,
        })
      );
      pillar.position.set(-10 + i * 10, 2, -4);
      pillar.castShadow = true;
      g.add(pillar);
      const spr = makeLabel(lb);
      spr.position.set(pillar.position.x, 9 + i, -4);
      g.add(spr);
      careerCards.push(pillar);
    });
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(28, 64),
      new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.85, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    floor.receiveShadow = true;
    g.add(floor);
  }

  /* ===== 2 Day / Night desk ===== */
  {
    const g = station(2);
    deskGroup = new THREE.Group();
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.65, metalness: 0.1 })
    );
    desk.position.y = 0;
    desk.castShadow = true;
    desk.receiveShadow = true;
    deskGroup.add(desk);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.7 });
    for (const [x, z] of [
      [-6.5, -3],
      [6.5, -3],
      [-6.5, 3],
      [6.5, 3],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4, 0.35), legMat);
      leg.position.set(x, -2.2, z);
      deskGroup.add(leg);
    }

    // dual monitors
    for (const ox of [-3.2, 3.2]) {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, 2.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x222830, metalness: 0.6, roughness: 0.35 })
      );
      stand.position.set(ox, 1.3, -1.5);
      deskGroup.add(stand);
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 3.2, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x0c0e14, metalness: 0.5, roughness: 0.4 })
      );
      bezel.position.set(ox, 3.4, -1.5);
      deskGroup.add(bezel);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(4.7, 2.7),
        new THREE.MeshStandardMaterial({
          color: 0x102818,
          emissive: 0x3dff9a,
          emissiveIntensity: 0.55,
          roughness: 0.2,
        })
      );
      screen.position.set(ox, 3.4, -1.36);
      deskGroup.add(screen);
      if (ox > 0) monitorGlow = screen;
    }

    // keyboard + mug
    const kb = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.2, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.5 })
    );
    kb.position.set(0, 0.35, 1.5);
    deskGroup.add(kb);
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.4, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0xc43b2c, roughness: 0.4 })
    );
    mug.position.set(5.5, 0.7, 1.2);
    deskGroup.add(mug);

    // desk lamp
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.3 })
    );
    lampBase.position.set(-6, 0.35, 2);
    deskGroup.add(lampBase);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x888890, metalness: 0.8, roughness: 0.25 })
    );
    arm.position.set(-6, 2, 1.2);
    arm.rotation.z = 0.4;
    deskGroup.add(arm);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.2, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffd2a0,
        emissive: 0xffb070,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide,
        roughness: 0.6,
      })
    );
    shade.position.set(-4.6, 3.4, 0.6);
    shade.rotation.z = Math.PI;
    deskGroup.add(shade);

    const deskLamp = new THREE.PointLight(0xffc090, 12, 18, 2);
    deskLamp.position.set(-4.6, 3.1, 0.6);
    deskGroup.add(deskLamp);
    deskGroup.userData.deskLamp = deskLamp;

    // window light plane (day)
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10),
      new THREE.MeshBasicMaterial({ color: 0x9ec8ff, transparent: true, opacity: 0.35 })
    );
    win.position.set(0, 8, -12);
    deskGroup.add(win);
    deskGroup.userData.window = win;

    deskGroup.position.set(0, 0, 0);
    g.add(deskGroup);
    makeCodeRain(g, 48);

    const nightLabel = makeLabel("NIGHT SHIFT  ·  深夜デプロイ", "#7dffb3");
    nightLabel.position.set(0, 12, 4);
    g.add(nightLabel);
  }

  /* ===== 3 Skills constellation ===== */
  {
    const g = station(3);
    const skills = [
      ["AI / RAG", 0xc43b2c, [-10, 4, 0]],
      ["Backend", 0x4a7dff, [0, 7, -4]],
      ["AWS", 0xc9a24a, [10, 4, 0]],
      ["DB / Ledger", 0x2ec4a0, [-6, -1, -6]],
      ["Bridge / PM", 0xff6b9d, [6, -1, -6]],
    ];
    const nodes = [];
    skills.forEach(([lb, col, pos]) => {
      const n = nodeBox(lb, col, 4.2, 1.8, 1.4);
      n.position.set(...pos);
      g.add(n);
      nodes.push(n);
      archNodes.push(n);
    });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const line = linkLine(nodes[i].position, nodes[j].position, 0x6a7a9a);
        g.add(line);
      }
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(14, 0.08, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0.35 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2;
    g.add(ring);
  }

  /* ===== 4 Career timeline ===== */
  {
    const g = station(4);
    const jobs = [
      ["2019", "RedSquare", 0xc43b2c],
      ["2022", "Scoville", 0x4a7dff],
      ["2024", "CMC Japan", 0xc9a24a],
      ["2025", "Freelance", 0x2ec4a0],
    ];
    jobs.forEach(([yr, name, col], i) => {
      const card = nodeBox(`${yr}  ${name}`, col, 5.5, 2.2, 1.5);
      card.position.set(-15 + i * 10, Math.sin(i * 1.2) * 2, -2);
      g.add(card);
      careerCards.push(card);
      if (i > 0) {
        const prev = new THREE.Vector3(-15 + (i - 1) * 10, Math.sin((i - 1) * 1.2) * 2, -2);
        g.add(linkLine(prev, card.position, col));
      }
    });
    // ascending path
    const pathPts = jobs.map((_, i) => new THREE.Vector3(-15 + i * 10, Math.sin(i * 1.2) * 2 - 2, -2));
    const curve = new THREE.CatmullRomCurve3(pathPts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.12, 8, false),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc9a24a, emissiveIntensity: 0.6 })
    );
    g.add(tube);
  }

  /* ===== 5 Case study medals ===== */
  {
    const g = station(5);
    const metrics = [
      ["+35%", "E-Wallet"],
      ["99.9%", "GovTech"],
      ["−70%", "Shift AI"],
      ["−60%", "Agent"],
      ["×1.7", "CVR"],
      ["−40%", "QA"],
    ];
    metrics.forEach(([m, lb], i) => {
      const ang = (i / metrics.length) * Math.PI * 2;
      const medal = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 0.4, 48),
        new THREE.MeshStandardMaterial({
          color: 0xc9a24a,
          metalness: 0.85,
          roughness: 0.22,
          emissive: 0x5a3a10,
          emissiveIntensity: 0.4,
        })
      );
      medal.rotation.x = Math.PI / 2;
      medal.position.set(Math.cos(ang) * 12, Math.sin(ang * 2) * 1.5 + 2, Math.sin(ang) * 12);
      medal.userData = { ang, r: 12, spin: 0.4 + rand() };
      g.add(medal);
      coins.push(medal);
      const spr = makeLabel(`${m}  ${lb}`, "#fff6e8");
      spr.position.copy(medal.position);
      spr.position.y += 2.2;
      spr.userData.follow = medal;
      g.add(spr);
      careerCards.push(spr);
    });
  }

  /* ===== 6 Japan — 山 / 川 / 名所（意味が分かる3体） ===== */
  {
    const g = station(6);

    const mountains = buildAlpineRange();
    mountains.position.set(-28, 0, -4);
    mountains.scale.set(0.85, 0.85, 0.85);
    g.add(mountains);

    const river = buildRiverValley();
    river.position.set(0, 0, 0);
    g.add(river);

    const scenic = buildScenicSpot();
    scenic.position.set(28, 0, -2);
    g.add(scenic);

    // photo plates as reference (small, behind labels)
    if (riverTex) {
      const p = imagePlane(riverTex, 10, 5.6);
      p.position.set(0, 14, -16);
      g.add(p);
    }
    if (toriiTex) {
      const p = imagePlane(toriiTex, 10, 5.6);
      p.position.set(28, 14, -14);
      g.add(p);
    }
    if (kyotoTex) {
      const p = imagePlane(kyotoTex, 9, 5.1);
      p.position.set(34, 8, 8);
      p.rotation.y = -0.4;
      g.add(p);
    }
  }

  /* ===== 7 Architecture RAG / Ledger / AWS ===== */
  {
    const g = station(7);
    // RAG pipeline
    const rag = [
      ["Docs", 0x8899aa, [-16, 4, 0]],
      ["Chunk", 0x4a7dff, [-8, 4, 0]],
      ["Embed", 0xc9a24a, [0, 4, 0]],
      ["pgvector", 0x2ec4a0, [8, 4, 0]],
      ["Agent", 0xc43b2c, [16, 4, 0]],
    ];
    const ragNodes = [];
    rag.forEach(([lb, col, pos]) => {
      const n = nodeBox(lb, col);
      n.position.set(...pos);
      g.add(n);
      ragNodes.push(n);
      archNodes.push(n);
    });
    for (let i = 0; i < ragNodes.length - 1; i++) {
      g.add(linkLine(ragNodes[i].position, ragNodes[i + 1].position, 0xffe0a0));
    }

    // Ledger stack
    for (let i = 0; i < 6; i++) {
      const blk = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.1, 3.2),
        new THREE.MeshStandardMaterial({
          color: 0x1b2740,
          metalness: 0.55,
          roughness: 0.35,
          emissive: 0x142850,
          emissiveIntensity: 0.5,
        })
      );
      blk.position.set(-10 + i * 0.15, -2 + i * 1.25, -10);
      blk.rotation.y = i * 0.08;
      g.add(blk);
    }
    const ledgerLbl = makeLabel("Ledger · 冪等キー", "#9ec8ff");
    ledgerLbl.position.set(-8, 6, -10);
    g.add(ledgerLbl);

    // AWS cloud spheres
    const aws = ["ECS", "RDS", "S3", "Lambda"];
    aws.forEach((lb, i) => {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 24, 24),
        new THREE.MeshStandardMaterial({
          color: 0xc9a24a,
          metalness: 0.3,
          roughness: 0.4,
          emissive: 0xc9a24a,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.85,
        })
      );
      cloud.position.set(4 + i * 4, -1 + Math.sin(i) * 1.5, -12);
      g.add(cloud);
      archNodes.push(cloud);
      const spr = makeLabel(lb, "#ffe6b0");
      spr.position.copy(cloud.position);
      spr.position.y += 2.4;
      g.add(spr);
    });

    if (cryptoTex) {
      const p = imagePlane(cryptoTex, 14, 7.9);
      p.position.set(0, 12, -8);
      g.add(p);
    }
  }

  /* ===== 8 Provably fair games ===== */
  {
    const g = station(8);
    function pip(n) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const x = c.getContext("2d");
      x.fillStyle = "#f4f4f6";
      x.fillRect(0, 0, 128, 128);
      x.fillStyle = "#15161c";
      const pts = {
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
          [36, 30],
          [36, 64],
          [36, 98],
          [92, 30],
          [92, 64],
          [92, 98],
        ],
      }[n];
      pts.forEach(([px, py]) => {
        x.beginPath();
        x.arc(px, py, 12, 0, 7);
        x.fill();
      });
      return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.45 });
    }
    dice = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 4.2), [pip(1), pip(6), pip(2), pip(5), pip(3), pip(4)]);
    dice.position.set(-10, 3, 0);
    dice.castShadow = true;
    g.add(dice);

    wheel = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(6.5, 0.65, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b, metalness: 0.55, roughness: 0.35 })
    );
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);
    for (let i = 0; i < 18; i++) {
      const seg = new THREE.Mesh(
        new THREE.CircleGeometry(6.1, 8, (i / 18) * Math.PI * 2, (Math.PI * 2) / 18),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? 0xb0392f : 0x15161c,
          side: THREE.DoubleSide,
          roughness: 0.65,
        })
      );
      seg.rotation.x = -Math.PI / 2;
      wheel.add(seg);
    }
    ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.35, roughness: 0.2 })
    );
    wheel.add(ball);
    wheel.position.set(10, 1, -2);
    g.add(wheel);

    if (bettingTex) {
      const p = imagePlane(bettingTex, 15, 8.4);
      p.position.set(0, 10, -10);
      g.add(p);
    }
  }

  /* ===== 9 Contact ring ===== */
  {
    const g = station(9);
    const ring = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc9a24a,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x3a2810,
      emissiveIntensity: 0.55,
    });
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.28, 24), mat);
      d.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0);
      d.rotation.x = Math.PI / 2;
      d.userData.a = a;
      ring.add(d);
    }
    g.add(ring);
    g.userData.ring = ring;
    const spr = makeLabel("ka6994388@gmail.com  ·  @famouspig", "#ffe6b0");
    spr.scale.set(14, 3.2, 1);
    spr.position.set(0, 0, 4);
    g.add(spr);
  }

  document.getElementById("loader").classList.add("done");
  startLoop();
}

/* ---------- UI ---------- */
const sections = [...document.querySelectorAll(".section")];
const dotsWrap = document.getElementById("progress");
sections.forEach((_, i) => {
  const d = document.createElement("button");
  d.type = "button";
  d.className = "dot";
  d.setAttribute("aria-label", `Section ${i + 1}`);
  d.addEventListener("click", () => sections[i].scrollIntoView({ behavior: "smooth" }));
  dotsWrap.appendChild(d);
});
const dots = [...dotsWrap.children];

const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
  { threshold: 0.28 }
);
sections.forEach((s) => io.observe(s));

let scrollT = 0;
function updateScroll() {
  const max = Math.max(1, document.body.scrollHeight - innerHeight);
  scrollT = (scrollY / max) * (sections.length - 1);
  const near = Math.round(scrollT);
  dots.forEach((d, i) => d.classList.toggle("on", i === near));
  document.getElementById("hint").style.opacity = scrollY > 50 ? "0" : "1";
}
addEventListener("scroll", updateScroll, { passive: true });

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
function startLoop() {
  updateScroll();
  function tick() {
    const t = (performance.now() - t0) / 1000;
    const zi = Math.floor(scrollT);
    const f = scrollT - zi;
    const ease = f * f * (3 - 2 * f);
    const z = -(zi + ease) * STEP;

    // dayness: high at start & Japan scenic, low at desk night / neon / games
    const dayCurve = Math.cos((scrollT / (sections.length - 1)) * Math.PI * 2) * 0.5 + 0.5;
    const nearDesk = 1 - Math.min(1, Math.abs(scrollT - 2) * 1.2);
    const dayness = THREE.MathUtils.clamp(dayCurve * 0.7 + 0.15 - nearDesk * 0.45, 0.05, 0.95);
    paintSky(dayness);
    hemi.intensity = 0.35 + dayness * 0.55;
    sun.intensity = 0.35 + dayness * 1.7;
    moon.intensity = 0.05 + (1 - dayness) * 0.55;
    lamp.intensity = (1 - dayness) * 14;
    lamp.position.set(0, 8, z);
    bloom.strength = 0.35 + (1 - dayness) * 0.55;
    if (stars) stars.material.opacity = 0.15 + (1 - dayness) * 0.8;

    camera.position.x = Math.sin(t * 0.12) * 2.5 + mouse.x * 1.8;
    camera.position.y = 9 + Math.sin(t * 0.18) * 0.5 + mouse.y * 1.2;
    camera.position.z = z + 48;
    camera.lookAt(mouse.x * 2, 4 + mouse.y, z - 8);

    if (groups[0]) {
      groups[0].traverse((c) => {
        if (c.userData.spin) c.rotation.y += c.userData.spin;
      });
    }

    if (deskGroup) {
      const night = 1 - dayness;
      deskGroup.userData.deskLamp.intensity = 4 + night * 16;
      deskGroup.userData.window.material.opacity = 0.08 + dayness * 0.4;
      deskGroup.userData.window.material.color.set(dayness > 0.45 ? 0x9ec8ff : 0x1a2040);
      if (monitorGlow) {
        monitorGlow.material.emissiveIntensity = 0.35 + night * 0.7 + Math.sin(t * 8) * 0.05;
      }
      neonA.intensity = night * 10;
      neonB.intensity = night * 8;
      neonA.position.set(-8, 4, groups[2].position.z);
      neonB.position.set(8, 3, groups[2].position.z - 5);
    }

    floatingCode.forEach((s) => {
      s.position.y -= s.userData.vy;
      if (s.position.y < -2) s.position.y = 14 + rand() * 4;
      s.material.opacity = 0.25 + (1 - dayness) * 0.5;
    });

    if (sakura) {
      const pos = sakura.geometry.attributes.position;
      const vel = sakura.userData.vel;
      for (let i = 0; i < vel.length; i++) {
        pos.setX(i, pos.getX(i) + vel[i].x + Math.sin(t + i) * 0.01);
        pos.setY(i, pos.getY(i) + vel[i].y);
        pos.setZ(i, pos.getZ(i) + vel[i].z);
        if (pos.getY(i) < -5) {
          pos.setY(i, 35);
          pos.setX(i, (rand() - 0.5) * 80);
        }
      }
      pos.needsUpdate = true;
    }

    rivers.forEach((m, k) => {
      const p = m.geometry.attributes.position;
      const base = m.userData.base;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        const zc = base[i * 3 + 2];
        p.setY(i, Math.sin(zc * 0.28 + t * 2.2 + k) * 0.28 + Math.cos(x * 0.45 + t) * 0.12);
      }
      p.needsUpdate = true;
    });

    neonSigns.forEach((s) => {
      s.material.emissiveIntensity = 0.9 + Math.sin(t * 3.5 + s.userData.pulse) * 0.55;
    });

    archNodes.forEach((n, i) => {
      n.position.y += Math.sin(t * 1.4 + i) * 0.003;
      n.rotation.y += 0.004;
      if (n.children[0]?.material?.emissiveIntensity != null) {
        n.children[0].material.emissiveIntensity = 0.25 + Math.sin(t * 2 + i) * 0.15;
      }
    });

    coins.forEach((c) => {
      c.userData.ang += 0.008;
      c.position.x = Math.cos(c.userData.ang) * c.userData.r;
      c.position.z = Math.sin(c.userData.ang) * c.userData.r;
      c.rotation.z += c.userData.spin * 0.02;
    });
    careerCards.forEach((c) => {
      if (c.userData?.follow) {
        c.position.x = c.userData.follow.position.x;
        c.position.z = c.userData.follow.position.z;
        c.position.y = c.userData.follow.position.y + 2.2;
      }
    });

    if (dice && wheel && ball) {
      dice.rotation.x += 0.018;
      dice.rotation.y += 0.028;
      dice.position.y = 3 + Math.abs(Math.sin(t * 2.8)) * 1.8;
      wheel.rotation.y += 0.028;
      const ba = -t * 1.7;
      ball.position.set(Math.cos(ba) * 5.6, 0.45, Math.sin(ba) * 5.6);
    }

    if (groups[9]?.userData.ring) {
      groups[9].userData.ring.children.forEach((d, i) => {
        d.userData.a += 0.012;
        const a = d.userData.a;
        d.position.set(Math.cos(a) * 14, Math.sin(a) * 14, Math.sin(t + i) * 2.2);
        d.rotation.z += 0.04;
      });
    }

    composer.render();
    requestAnimationFrame(tick);
  }
  tick();
}

build().catch((err) => {
  console.error(err);
  document.getElementById("loader").querySelector(".loader-label").textContent = "Load failed";
});
