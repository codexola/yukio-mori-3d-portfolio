import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Finished background work — 「墨潮門」Sumi Tide Gate
 * A complete landscape: shore · pines · stone lanterns · twin torii ·
 * Fuji · ink water · moon · sakura · night salon street · light constellation.
 */

/* ===== UI ===== */
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

/* ===== Math ===== */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260831);
const lerp = (a, b, t) => a + (b - a) * t;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
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
  const g = (h, px, py) => (h & 1 ? -px : px) + (h & 2 ? -py : py);
  const aa = perm[perm[X] + Y],
    ab = perm[perm[X] + Y + 1],
    ba = perm[perm[X + 1] + Y],
    bb = perm[perm[X + 1] + Y + 1];
  return lerp(lerp(g(aa, x, y), g(ba, x - 1, y), u), lerp(g(ab, x, y - 1), g(bb, x - 1, y - 1), u), v);
}
function fbm(x, y, o = 4) {
  let a = 0,
    amp = 0.5,
    f = 1;
  for (let i = 0; i < o; i++) {
    a += amp * noise2(x * f, y * f);
    f *= 2;
    amp *= 0.5;
  }
  return a;
}

/* ===== Renderer ===== */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a090c, 0.022);

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 4, 22);

/* ===== Lights ===== */
const hemi = new THREE.HemisphereLight(0xffe6d0, 0x100c18, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd0a8, 1.5);
sun.position.set(-14, 22, 10);
scene.add(sun);
const moonDir = new THREE.DirectionalLight(0x8aa8ff, 0.2);
moonDir.position.set(12, 10, -8);
scene.add(moonDir);
const shuL = new THREE.PointLight(0xc23a2b, 8, 60, 2);
shuL.position.set(-4, 5, 0);
scene.add(shuL);
const kinL = new THREE.PointLight(0xc6a45a, 5, 50, 2);
kinL.position.set(5, 4, 2);
scene.add(kinL);
const neonL = new THREE.PointLight(0xff4d6d, 0, 55, 2);
neonL.position.set(2, 3, 2);
scene.add(neonL);
const cyanL = new THREE.PointLight(0x5ec8d8, 0, 50, 2);
cyanL.position.set(-3, 3, -2);
scene.add(cyanL);

/* ===== Sky ===== */
const skyU = {
  uTime: { value: 0 },
  uTop: { value: new THREE.Color(0x080b14) },
  uMid: { value: new THREE.Color(0x1a1528) },
  uHorizon: { value: new THREE.Color(0x4a3040) },
  uGlow: { value: new THREE.Color(0xd4a070) },
  uMood: { value: 0.4 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(220, 64, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyU,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 uTop,uMid,uHorizon,uGlow; uniform float uTime,uMood; varying vec3 vP;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n2(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        vec2 u=f*f*(3.-2.*f);return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
      void main(){
        vec3 n=normalize(vP); float h=n.y*.5+.5;
        vec3 col=mix(uHorizon,uMid,smoothstep(.12,.55,h));
        col=mix(col,uTop,smoothstep(.45,.95,h));
        float band=exp(-pow((h-.38)*6.,2.));
        col+=uGlow*band*(.4+.3*uMood);
        float cloud=n2(n.xz*2.5+vec2(uTime*.008,0.));
        col=mix(col,col*.5,smoothstep(.5,.8,cloud)*(1.-h)*.5);
        col+= (n2(n.xz*18.)-.5)*.04;
        // stars
        float stars=step(.997,hash(floor(n.xz*280.)));
        col+=stars*(1.-smoothstep(.2,.6,h))*vec3(.9,.92,1.)*(.5+.5*uMood);
        gl_FragColor=vec4(col,1.);
      }`,
  })
);
scene.add(sky);

/* ===== Moon ===== */
const moonGroup = new THREE.Group();
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 48, 48),
  new THREE.MeshStandardMaterial({
    color: 0xf2e8d4,
    emissive: 0xd8c8a8,
    emissiveIntensity: 0.55,
    roughness: 0.85,
    metalness: 0,
  })
);
const moonHalo = new THREE.Mesh(
  new THREE.SphereGeometry(2.6, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe8c0, transparent: true, opacity: 0.08, depthWrite: false })
);
moonGroup.add(moonMesh, moonHalo);
moonGroup.position.set(-16, 14, -50);
scene.add(moonGroup);

/* ===== Water ===== */
const waterU = {
  uTime: { value: 0 },
  uDeep: { value: new THREE.Color(0x071018) },
  uShallow: { value: new THREE.Color(0x1a3a52) },
  uSpec: { value: new THREE.Color(0xc6a45a) },
};
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 100, 200, 120),
  new THREE.ShaderMaterial({
    transparent: true,
    uniforms: waterU,
    vertexShader: `
      uniform float uTime; varying vec2 vUv; varying float vW;
      void main(){
        vUv=uv; vec3 p=position;
        float w=sin(p.x*.28+uTime*.65)*.14+cos(p.y*.22-uTime*.5)*.1+sin((p.x+p.y)*.12+uTime*.35)*.07;
        p.z+=w; vW=w;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      uniform vec3 uDeep,uShallow,uSpec; uniform float uTime; varying vec2 vUv; varying float vW;
      void main(){
        vec3 col=mix(uDeep,uShallow,vUv.y*.45+.3+vW*1.5);
        float stroke=sin(vUv.x*55.+uTime*.9+vW*12.);
        col+=uSpec*smoothstep(.88,1.,stroke)*.12;
        float fres=pow(clamp(1.-abs(vW)*5.,0.,1.),2.);
        col+=uSpec*fres*.22;
        // depth darkening toward horizon
        col*=.85+vUv.y*.2;
        gl_FragColor=vec4(col,.88+.1*fres);
      }`,
  })
);
water.rotation.x = -Math.PI / 2;
water.position.set(0, -1.85, -10);
scene.add(water);

/* ===== Shore / terrain ===== */
function buildShore() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(90, 40, 80, 40);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    // beach rises away from water (negative z is water side → keep low)
    const rise = THREE.MathUtils.smoothstep(z, -5, 18) * 2.8;
    const n = fbm(x * 0.08, z * 0.08, 4) * 0.6;
    pos.setY(i, -1.7 + rise + n);
    const c = new THREE.Color().setHSL(0.08, 0.15, 0.12 + rise * 0.04 + n * 0.05);
    if (z < 2) c.lerp(new THREE.Color(0x3a3830), 0.4); // wet sand/stone
    else c.lerp(new THREE.Color(0x1a2418), 0.5); // moss/earth
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  g.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })
    )
  );
  g.position.set(0, 0, 8);
  return g;
}
scene.add(buildShore());

/* ===== Rocks ===== */
const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.9, flatShading: true });
for (let i = 0; i < 28; i++) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.4 + rand() * 0.9, 0),
    rockMat
  );
  rock.position.set((rand() - 0.5) * 35, -1.5 + rand() * 0.4, 2 + rand() * 14);
  rock.rotation.set(rand() * 2, rand() * 2, rand() * 2);
  rock.scale.set(1, 0.55 + rand() * 0.4, 0.8);
  scene.add(rock);
}

/* ===== Fuji (finished) ===== */
function buildFuji() {
  const root = new THREE.Group();
  const H = 28,
    R = 22;
  const geo = new THREE.ConeGeometry(R, H, 128, 64, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yN = THREE.MathUtils.clamp((v.y + H / 2) / H, 0, 1);
    const profile = Math.pow(1 - yN, 0.68);
    let rr = Math.hypot(v.x, v.z) || 1;
    v.x = (v.x / rr) * R * profile;
    v.z = (v.z / rr) * R * profile;
    const ang = Math.atan2(v.z, v.x);
    const fold = Math.sin(ang * 8) * 0.3 * (1 - yN) + fbm(Math.cos(ang) * 3, Math.sin(ang) * 3, 3) * 0.5 * (1 - yN);
    rr = Math.hypot(v.x, v.z) || 1;
    v.x += (v.x / rr) * fold;
    v.z += (v.z / rr) * fold;
    if (yN > 0.91) v.y -= (yN - 0.91) * 7;
    pos.setXYZ(i, v.x, v.y, v.z);
    const c = new THREE.Color();
    if (yN > 0.74) c.set(0xf0f4fc);
    else if (yN > 0.58) c.set(0x5a6270).lerp(new THREE.Color(0xe4eaf4), (yN - 0.58) / 0.16);
    else if (yN > 0.32) c.set(0x2e3440);
    else c.set(0x152820).lerp(new THREE.Color(0x2a4030), yN / 0.32);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02 })
  );
  m.position.y = H / 2 - 4;
  root.add(m);

  // snow cap dish
  const snow = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.5, emissive: 0xb0c0d8, emissiveIntensity: 0.06 })
  );
  snow.position.y = H - 6.5;
  snow.scale.set(1.2, 0.48, 1.2);
  root.add(snow);

  // forest belt
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.95 });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x1a3a28, roughness: 0.85 });
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rand() * 0.15;
    const rad = 16 + rand() * 7;
    const tree = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.2, 5), trunkM);
    tr.position.y = 0.6;
    const lf = new THREE.Mesh(new THREE.ConeGeometry(0.65 + rand() * 0.35, 2 + rand(), 6), leafM);
    lf.position.y = 2;
    tree.add(tr, lf);
    tree.position.set(Math.cos(a) * rad, -3.2, Math.sin(a) * rad);
    root.add(tree);
  }

  // cloud sea puffs
  const cloudM = new THREE.MeshStandardMaterial({
    color: 0xeef2fa,
    transparent: true,
    opacity: 0.4,
    roughness: 1,
    depthWrite: false,
  });
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(2.5 + rand() * 3.5, 10, 8), cloudM);
    const a = rand() * Math.PI * 2;
    const rad = 12 + rand() * 35;
    p.position.set(Math.cos(a) * rad, -3 + rand() * 2, Math.sin(a) * rad);
    p.scale.set(1.5, 0.32, 1.2);
    p.userData.spin = (rand() - 0.5) * 0.008;
    root.add(p);
  }

  root.position.set(10, 0, -55);
  root.scale.set(1.15, 1.15, 1.15);
  return root;
}
const fuji = buildFuji();
scene.add(fuji);

/* ===== Mist ===== */
function mistCanvas() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(256, 130, 10, 256, 128, 230);
  g.addColorStop(0, "rgba(245,235,225,0.6)");
  g.addColorStop(0.4, "rgba(210,200,195,0.2)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const mistTex = mistCanvas();
const mists = [];
for (let i = 0; i < 7; i++) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(55 + i * 10, 12 + i * 2),
    new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.2 - i * 0.018, depthWrite: false, side: THREE.DoubleSide })
  );
  m.position.set((i - 3) * 5, 0.2 + i * 0.35, -12 - i * 4.5);
  m.userData = { baseX: m.position.x, spd: 0.12 + i * 0.03 };
  scene.add(m);
  mists.push(m);
}

/* ===== Torii (complete architecture) ===== */
function buildTorii(scale = 1, shuTone = 0xb83228) {
  const g = new THREE.Group();
  const shu = new THREE.MeshStandardMaterial({
    color: shuTone,
    roughness: 0.45,
    metalness: 0.1,
    emissive: 0x2a0808,
    emissiveIntensity: 0.25,
  });
  const sumi = new THREE.MeshStandardMaterial({ color: 0x121018, roughness: 0.6 });
  [-2.8, 2.8].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.32 * scale, 8.2 * scale, 28), shu);
    post.position.set(x * scale, 2.4 * scale, 0);
    g.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * scale, 0.5 * scale, 0.4 * scale, 20), sumi);
    base.position.set(x * scale, -1.55 * scale, 0);
    g.add(base);
    // kusabi wedge hint
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.2 * scale, 0.5 * scale), sumi);
    wedge.position.set(x * scale, 3.4 * scale, 0);
    g.add(wedge);
  });
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(8.2 * scale, 0.48 * scale, 0.95 * scale), sumi);
  kasagi.position.set(0, 6.7 * scale, 0);
  kasagi.rotation.z = 0.012;
  // curved ends via small boxes
  [-1, 1].forEach((s) => {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.35 * scale, 0.7 * scale), sumi);
    tip.position.set(s * 4.3 * scale, 6.85 * scale, 0);
    tip.rotation.z = s * -0.25;
    g.add(tip);
  });
  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(7.1 * scale, 0.3 * scale, 0.6 * scale), shu);
  shimaki.position.set(0, 6.05 * scale, 0);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(6.2 * scale, 0.28 * scale, 0.52 * scale), shu);
  nuki.position.set(0, 3.9 * scale, 0);
  const gaku = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 1.85 * scale, 0.38 * scale), shu);
  gaku.position.set(0, 5.0 * scale, 0);
  // secondary pillars (in-no-hashira style props)
  [-1.6, 1.6].forEach((x) => {
    const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.14 * scale, 3.2 * scale, 12), shu);
    prop.position.set(x * scale, 0.2 * scale, 0.55 * scale);
    prop.rotation.z = (x > 0 ? 1 : -1) * 0.35;
    g.add(prop);
  });
  g.add(kasagi, shimaki, nuki, gaku);

  // reflection
  const ghost = g.clone(true);
  ghost.scale.y *= -0.5;
  ghost.position.y = -3.4 * scale;
  ghost.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.16;
      o.material.depthWrite = false;
    }
  });
  g.add(ghost);
  return g;
}
const toriiMain = buildTorii(1.0);
toriiMain.position.set(-6, 0.15, -5);
toriiMain.rotation.y = 0.38;
scene.add(toriiMain);

const toriiFar = buildTorii(0.55, 0x8a2820);
toriiFar.position.set(4, -0.3, -22);
toriiFar.rotation.y = -0.2;
scene.add(toriiFar);

/* ===== Stone lanterns (toro) ===== */
function buildToro() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.35, 8), stone);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.4, 8), stone);
  shaft.position.y = 0.85;
  const firebox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.7, emissive: 0xffaa66, emissiveIntensity: 0.35 })
  );
  firebox.position.y = 1.75;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 4), stone);
  roof.position.y = 2.2;
  roof.rotation.y = Math.PI / 4;
  const glow = new THREE.PointLight(0xffb070, 1.2, 6, 2);
  glow.position.y = 1.75;
  g.add(base, shaft, firebox, roof, glow);
  return g;
}
const toros = [];
for (let i = 0; i < 6; i++) {
  const t = buildToro();
  t.position.set(-10 + i * 1.8, -1.4, 3 + (i % 2) * 1.5);
  t.scale.setScalar(0.85 + rand() * 0.2);
  scene.add(t);
  toros.push(t);
}

/* ===== Pine grove ===== */
function pine(h = 5) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, h * 0.45, 7),
    new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.95 })
  );
  trunk.position.y = h * 0.2;
  g.add(trunk);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x1c3a28, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.18, h * 0.28, 7), leaf);
    cone.position.y = h * 0.35 + i * h * 0.16;
    g.add(cone);
  }
  return g;
}
for (let i = 0; i < 18; i++) {
  const p = pine(4 + rand() * 4);
  p.position.set(-18 + rand() * 8, -1.5, -2 + rand() * 12);
  p.rotation.y = rand() * 3;
  scene.add(p);
}
for (let i = 0; i < 12; i++) {
  const p = pine(3.5 + rand() * 3);
  p.position.set(12 + rand() * 8, -1.5, 0 + rand() * 10);
  scene.add(p);
}

/* ===== Bamboo cluster ===== */
const bambooM = new THREE.MeshStandardMaterial({ color: 0x4a7a38, roughness: 0.7, metalness: 0.05 });
const bambooGroup = new THREE.Group();
for (let i = 0; i < 45; i++) {
  const h = 7 + rand() * 6;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 6), bambooM);
  stalk.position.set(8 + rand() * 6, h / 2 - 1.6, -8 + rand() * 8);
  stalk.rotation.z = (rand() - 0.5) * 0.1;
  bambooGroup.add(stalk);
}
scene.add(bambooGroup);

/* ===== Small shrine roof ===== */
const shrine = new THREE.Group();
const shrineBody = new THREE.Mesh(
  new THREE.BoxGeometry(3.2, 2.2, 2.8),
  new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.85 })
);
shrineBody.position.y = 0.3;
const shrineRoof = new THREE.Mesh(
  new THREE.ConeGeometry(3.2, 1.6, 4),
  new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.75 })
);
shrineRoof.position.y = 2.2;
shrineRoof.rotation.y = Math.PI / 4;
const shrineBase = new THREE.Mesh(
  new THREE.BoxGeometry(4, 0.35, 3.5),
  new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.9 })
);
shrineBase.position.y = -0.9;
shrine.add(shrineBody, shrineRoof, shrineBase);
shrine.position.set(11, -0.5, -12);
shrine.rotation.y = -0.4;
scene.add(shrine);

/* ===== Calligraphy ribbons ===== */
function ribbon(seed, color, w) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    pts.push(
      new THREE.Vector3(
        Math.sin(t * Math.PI * 2.2 + seed) * (5 + seed * 0.8),
        2 + Math.sin(t * Math.PI * 3.5 + seed * 1.5) * 2.4 + t * 2,
        -6 - t * 20 + Math.cos(t * 5 + seed) * 1.8
      )
    );
  }
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, w, 7, false),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.45,
      transparent: true,
      opacity: 0.8,
    })
  );
  mesh.userData.seed = seed;
  return mesh;
}
const ribbons = [ribbon(0.3, 0xc23a2b, 0.055), ribbon(1.2, 0xc6a45a, 0.04), ribbon(2.5, 0x5ec8d8, 0.035)];
ribbons.forEach((r) => scene.add(r));

/* ===== Sakura (instanced) ===== */
function petalMap() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const x = c.getContext("2d");
  x.clearRect(0, 0, 64, 64);
  x.fillStyle = "#ffb7c5";
  x.beginPath();
  x.moveTo(32, 6);
  x.quadraticCurveTo(52, 22, 46, 42);
  x.quadraticCurveTo(32, 54, 18, 42);
  x.quadraticCurveTo(12, 22, 32, 6);
  x.fill();
  x.fillStyle = "rgba(255,255,255,0.4)";
  x.beginPath();
  x.ellipse(32, 28, 5, 9, 0, 0, 7);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const PETAL_N = 560;
const petalMat = new THREE.MeshBasicMaterial({
  map: petalMap(),
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2), petalMat, PETAL_N);
const pState = [];
const dummy = new THREE.Object3D();
for (let i = 0; i < PETAL_N; i++) {
  pState.push({
    x: (rand() - 0.5) * 50,
    y: rand() * 22,
    z: (rand() - 0.5) * 40 - 8,
    rx: rand() * 6,
    ry: rand() * 6,
    rz: rand() * 6,
    vx: (rand() - 0.5) * 0.025,
    vy: -0.012 - rand() * 0.028,
    vz: (rand() - 0.5) * 0.018,
    spin: 0.012 + rand() * 0.03,
  });
}
scene.add(petals);

/* ===== Night salon street (complete block) ===== */
const nightCity = new THREE.Group();
nightCity.visible = false;

// wet street
const street = new THREE.Mesh(
  new THREE.PlaneGeometry(28, 40),
  new THREE.MeshStandardMaterial({ color: 0x0a0c14, roughness: 0.25, metalness: 0.75 })
);
street.rotation.x = -Math.PI / 2;
street.position.set(0, -1.7, 2);
nightCity.add(street);

// buildings + vertical neon signs
for (let i = 0; i < 16; i++) {
  const side = i < 8 ? -1 : 1;
  const idx = i % 8;
  const bh = 5 + rand() * 14;
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(2.8 + rand() * 2, bh, 3 + rand() * 2),
    new THREE.MeshStandardMaterial({ color: 0x12151e, roughness: 0.88, metalness: 0.15 })
  );
  b.position.set(side * (5.5 + rand() * 2), bh / 2 - 1.7, -8 + idx * 3.5);
  nightCity.add(b);

  // windows
  for (let wy = 0; wy < Math.floor(bh / 1.4); wy++) {
    if (rand() > 0.45) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.35, 0.45),
        new THREE.MeshBasicMaterial({
          color: rand() > 0.5 ? 0xffcc88 : 0x88ddff,
          transparent: true,
          opacity: 0.55 + rand() * 0.35,
        })
      );
      win.position.set(b.position.x + side * 1.45, -1.2 + wy * 1.35, b.position.z + (rand() - 0.5));
      win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      nightCity.add(win);
    }
  }

  const ncol = [0xff4d6d, 0x5ec8d8, 0xff8a5c, 0xc6a45a, 0xff66aa][i % 5];
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.8 + rand() * 3.5, 0.7),
    new THREE.MeshStandardMaterial({ color: ncol, emissive: ncol, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 })
  );
  sign.position.set(b.position.x + side * 1.6, 1.5 + rand() * 3, b.position.z);
  sign.userData.pulse = rand() * 8;
  nightCity.add(sign);
}

// paper lanterns row
function chochinTex() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 120);
  g.addColorStop(0, "#fff5e0");
  g.addColorStop(0.35, "#ff9a60");
  g.addColorStop(0.7, "#c23a2b");
  g.addColorStop(1, "#2a0c0c");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(60,15,15,0.4)";
  x.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.moveTo(0, 30 + i * 28);
    x.lineTo(256, 30 + i * 28);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cht = chochinTex();
const nightLanterns = [];
for (let i = 0; i < 12; i++) {
  const L = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 16),
    new THREE.MeshStandardMaterial({
      map: cht,
      emissive: 0xff5533,
      emissiveMap: cht,
      emissiveIntensity: 0.7,
      roughness: 0.5,
      transparent: true,
      opacity: 0.95,
    })
  );
  body.scale.set(1, 1.3, 1);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 5), new THREE.MeshBasicMaterial({ color: 0x1a1010 }));
  cord.position.y = 1.1;
  L.add(body, cord);
  L.position.set((i % 2 ? 1 : -1) * 3.8, 2.4 + Math.sin(i) * 0.3, -6 + i * 1.6);
  L.userData.phase = i * 0.6;
  nightCity.add(L);
  nightLanterns.push(L);
}

// salon facade glow
const salonGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 3),
  new THREE.MeshBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
);
salonGlow.position.set(0, 1.2, 4);
nightCity.add(salonGlow);

const noren = new THREE.Mesh(
  new THREE.PlaneGeometry(3.5, 1.4),
  new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.8, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
);
noren.position.set(0, 0.8, 3.5);
nightCity.add(noren);

scene.add(nightCity);

/* ===== Constellation (AI/chain) ===== */
const constellation = new THREE.Group();
constellation.visible = false;
const nodes = [];
for (let i = 0; i < 32; i++) {
  const n = new THREE.Mesh(
    new THREE.SphereGeometry(0.05 + rand() * 0.06, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0x5ec8d8,
      emissive: 0x5ec8d8,
      emissiveIntensity: 0.9,
      metalness: 0.5,
      roughness: 0.25,
    })
  );
  n.position.set((rand() - 0.5) * 16, 1 + rand() * 6, -4 - rand() * 14);
  constellation.add(n);
  nodes.push(n);
}
const linkM = new THREE.LineBasicMaterial({ color: 0xc6a45a, transparent: true, opacity: 0.4 });
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[i].position.distanceTo(nodes[j].position) < 3.8) {
      constellation.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[i].position.clone(), nodes[j].position.clone()]), linkM)
      );
    }
  }
}
// central ledger crystal
const crystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.7, 0),
  new THREE.MeshStandardMaterial({
    color: 0x5ec8d8,
    emissive: 0x5ec8d8,
    emissiveIntensity: 0.6,
    metalness: 0.8,
    roughness: 0.15,
    transparent: true,
    opacity: 0.85,
  })
);
crystal.position.set(0, 3.5, -8);
constellation.add(crystal);
scene.add(constellation);

/* ===== Post ===== */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.75);
composer.addPass(bloom);
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.028 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uAmount; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      c.rgb+=(hash(vUv*vec2(1600.,900.)+uTime)*2.-1.)*uAmount;
      float d=distance(vUv,vec2(.5));
      c.rgb*=smoothstep(1.05,.4,d);
      gl_FragColor=c;
    }`,
});
composer.addPass(film);
composer.addPass(new OutputPass());

/* ===== Mood ===== */
const moodT = { bloom: 0.55, hemi: 0.5, shu: 8, kin: 5, neon: 0, cyan: 0, moon: 0.2, sun: 1.5 };
let mood = "dawn";

function setMood(m) {
  mood = m;
  nightCity.visible = m === "neon";
  constellation.visible = m === "circuit" || m === "desk";
  bambooGroup.visible = m !== "neon";
  shrine.visible = m !== "neon";

  if (m === "neon") {
    Object.assign(moodT, { bloom: 0.9, hemi: 0.22, shu: 3, kin: 2, neon: 16, cyan: 9, moon: 0.45, sun: 0.25 });
    skyU.uTop.value.set(0x06040c);
    skyU.uMid.value.set(0x1a0c18);
    skyU.uHorizon.value.set(0x3a1528);
    skyU.uGlow.value.set(0xff4d6d);
    skyU.uMood.value = 1.3;
    waterU.uDeep.value.set(0x080610);
    waterU.uShallow.value.set(0x2a1428);
    waterU.uSpec.value.set(0xff6b8a);
    petalMat.opacity = 0.3;
    scene.fog.density = 0.032;
    fuji.visible = false;
  } else if (m === "circuit") {
    Object.assign(moodT, { bloom: 0.7, hemi: 0.38, shu: 3, kin: 6, neon: 1, cyan: 12, moon: 0.4, sun: 0.6 });
    skyU.uTop.value.set(0x050a12);
    skyU.uMid.value.set(0x0e2030);
    skyU.uHorizon.value.set(0x1a4050);
    skyU.uGlow.value.set(0x5ec8d8);
    skyU.uMood.value = 1;
    waterU.uSpec.value.set(0x5ec8d8);
    petalMat.opacity = 0.4;
    scene.fog.density = 0.026;
    fuji.visible = true;
  } else if (m === "dawn" || m === "mist") {
    Object.assign(moodT, { bloom: 0.52, hemi: 0.55, shu: 7, kin: 5, neon: 0, cyan: 1.5, moon: 0.15, sun: 1.55 });
    skyU.uTop.value.set(0x080b14);
    skyU.uMid.value.set(0x1a1528);
    skyU.uHorizon.value.set(0x4a3040);
    skyU.uGlow.value.set(0xd4a070);
    skyU.uMood.value = 0.45;
    waterU.uDeep.value.set(0x071018);
    waterU.uShallow.value.set(0x1a3a52);
    waterU.uSpec.value.set(0xc6a45a);
    petalMat.opacity = 0.88;
    scene.fog.density = 0.02;
    fuji.visible = true;
  } else if (m === "desk" || m === "ink" || m === "gold" || m === "close") {
    Object.assign(moodT, { bloom: 0.55, hemi: 0.42, shu: 5, kin: 7, neon: 0.5, cyan: 4, moon: 0.25, sun: 0.95 });
    skyU.uTop.value.set(0x0a0c12);
    skyU.uMid.value.set(0x161c28);
    skyU.uHorizon.value.set(0x2a3038);
    skyU.uGlow.value.set(0xc6a45a);
    skyU.uMood.value = 0.7;
    petalMat.opacity = 0.55;
    scene.fog.density = 0.024;
    fuji.visible = true;
  } else {
    Object.assign(moodT, { bloom: 0.5, hemi: 0.48, shu: 6, kin: 4, neon: 0, cyan: 2, moon: 0.2, sun: 1.2 });
    fuji.visible = true;
  }
}

/* ===== Input ===== */
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

/* ===== Animate ===== */
const t0 = performance.now();
let scrollProg = 0;

function tick() {
  const t = (performance.now() - t0) / 1000;
  const maxS = Math.max(1, document.body.scrollHeight - innerHeight);
  scrollProg = lerp(scrollProg, scrollY / maxS, 0.05);

  skyU.uTime.value = t;
  waterU.uTime.value = t;
  film.uniforms.uTime.value = t;

  bloom.strength = lerp(bloom.strength, moodT.bloom, 0.04);
  hemi.intensity = lerp(hemi.intensity, moodT.hemi, 0.04);
  shuL.intensity = lerp(shuL.intensity, moodT.shu, 0.04);
  kinL.intensity = lerp(kinL.intensity, moodT.kin, 0.04);
  neonL.intensity = lerp(neonL.intensity, moodT.neon, 0.04);
  cyanL.intensity = lerp(cyanL.intensity, moodT.cyan, 0.04);
  moonDir.intensity = lerp(moonDir.intensity, moodT.moon, 0.04);
  sun.intensity = lerp(sun.intensity, moodT.sun, 0.04);

  // finished camera path through the landscape
  const camZ = 22 - scrollProg * 12;
  const camY = 4 + Math.sin(scrollProg * Math.PI) * 1.1;
  camera.position.x = lerp(camera.position.x, mouse.x * 1.6, 0.04);
  camera.position.y = lerp(camera.position.y, camY + mouse.y * 0.55, 0.04);
  camera.position.z = lerp(camera.position.z, camZ, 0.04);
  camera.lookAt(mouse.x * 0.5, 1.6 + scrollProg * 0.6, -10 - scrollProg * 8);

  moonGroup.position.x = -16 + Math.sin(t * 0.03) * 0.5;
  moonHalo.material.opacity = 0.06 + Math.sin(t * 0.4) * 0.02;

  fuji.rotation.y = Math.sin(t * 0.04) * 0.015;
  fuji.traverse((o) => {
    if (o.userData.spin) o.rotation.y += o.userData.spin;
  });

  toriiMain.rotation.y = 0.38 + Math.sin(t * 0.1) * 0.03;
  toriiMain.position.y = 0.15 + Math.sin(t * 0.35) * 0.04;
  toriiFar.position.y = -0.3 + Math.sin(t * 0.28 + 1) * 0.03;

  mists.forEach((m, i) => {
    m.position.x = m.userData.baseX + Math.sin(t * m.userData.spd + i) * 2.8;
    m.material.opacity = (mood === "neon" ? 0.1 : 0.16) + Math.sin(t * 0.25 + i) * 0.03 - i * 0.012;
  });

  ribbons.forEach((r, i) => {
    r.rotation.z = Math.sin(t * 0.22 + i) * 0.07;
    r.position.y = Math.sin(t * 0.35 + i * 1.2) * 0.4;
    r.material.emissiveIntensity = 0.3 + Math.sin(t * 0.7 + i) * 0.18;
  });

  toros.forEach((tr, i) => {
    const light = tr.children.find((c) => c.isLight);
    if (light) light.intensity = 0.9 + Math.sin(t * 1.5 + i) * 0.35;
  });

  nightCity.children.forEach((c) => {
    if (c.userData.pulse != null && c.material?.emissiveIntensity != null) {
      c.material.emissiveIntensity = 1.2 + Math.sin(t * 2.8 + c.userData.pulse) * 0.55;
    }
  });
  nightLanterns.forEach((L) => {
    L.rotation.z = Math.sin(t * 1.1 + L.userData.phase) * 0.14;
    const body = L.children[0];
    if (body?.material) body.material.emissiveIntensity = 0.55 + Math.sin(t * 2 + L.userData.phase) * 0.3;
  });

  nodes.forEach((n, i) => {
    n.position.y += Math.sin(t * 0.65 + i) * 0.0018;
    n.material.emissiveIntensity = 0.55 + Math.sin(t * 2.2 + i) * 0.4;
  });
  crystal.rotation.y = t * 0.35;
  crystal.rotation.x = Math.sin(t * 0.4) * 0.2;
  constellation.rotation.y = t * 0.04;

  for (let i = 0; i < PETAL_N; i++) {
    const s = pState[i];
    s.x += s.vx + Math.sin(t * 0.45 + i) * 0.007;
    s.y += s.vy;
    s.z += s.vz;
    s.rx += s.spin;
    s.ry += s.spin * 0.65;
    if (s.y < -2.2) {
      s.y = 16 + rand() * 5;
      s.x = (rand() - 0.5) * 50;
      s.z = (rand() - 0.5) * 40 - 8;
    }
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(s.rx, s.ry, s.rz);
    dummy.scale.setScalar(0.65 + (i % 6) * 0.12);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
  }
  petals.instanceMatrix.needsUpdate = true;

  composer.render();
  requestAnimationFrame(tick);
}

setMood("dawn");
tick();
requestAnimationFrame(() => {
  document.getElementById("loader")?.classList.add("done");
  sections[0]?.classList.add("in");
});
