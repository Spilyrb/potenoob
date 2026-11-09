// Browser preview of the generated Roblox stages (reads public/stages/<id>.json,
// i.e. exactly the parts written into the .rbxmx files) with a "studs" surface
// texture and the same animations performed by StageFX.client.luau.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSky } from '../vfx/sky.js';
import { createEmitter } from '../vfx/particles.js';
import { globalUniforms } from '../engine/materials.js';
import { ICONS } from '../icons.js';

const STAGES = [
  { id: 'mines', icon: 'pickaxe' }, { id: 'fort', icon: 'tower' },
  { id: 'wreck', icon: 'wheel' }, { id: 'zen', icon: 'lotus' },
];
const PRESETS = {
  day: {
    skyTop: '#16a9ff', skyHorizon: '#bdf4ff', skyBottom: '#e9fbff', skyCurve: 0.6,
    sunDir: [0.35, 0.8, 0.5], sunColor: '#fff8e6', cloudColor: '#ffffff', cloudShade: '#cfe9ff', cloudAmount: 0.75,
    hemiSky: '#d7f3ff', hemiGround: '#88b060', fog: '#c9f3ff', sun: 2.4, hemi: 1.05,
  },
  sunset: {
    skyTop: '#3b2f8a', skyHorizon: '#ff9a7a', skyBottom: '#e79bc4', skyCurve: 0.3, sunGlow: 0.5,
    skySunDir: [0.75, 0.12, -1], sunDir: [-0.5, 0.45, 0.75], sunColor: '#ffd29a', cloudColor: '#ffd3e2', cloudShade: '#8f6bb5', cloudAmount: 0.3,
    hemiSky: '#d6b3ff', hemiGround: '#a06070', fog: '#e3a6c4', sun: 2.2, hemi: 1.0,
  },
};

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
if (capture) document.body.classList.add('capture');

// --- renderer -----------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: capture });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotateSpeed = 0.4;
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
composer.addPass(renderPass);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.92));
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  globalUniforms.uPointScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
addEventListener('resize', resize);
resize();

// --- studs texture: one tile = one Roblox stud ------------------------------------
function studTexture() {
  const S = 32, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f3f3'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#d6d6d6'; g.fillRect(0, S - 2, S, 2); g.fillRect(S - 2, 0, 2, S);
  const i = 7, w = S - 2 * i;
  g.fillStyle = '#c4c4c4'; g.fillRect(i + 2, i + 2, w, w);          // shadow
  g.fillStyle = '#ffffff'; g.fillRect(i - 1, i - 1, w, w);          // highlight
  g.fillStyle = '#fafafa'; g.fillRect(i, i, w, w);                  // stud top
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const STUD = studTexture();
const MATS = {
  studs: new THREE.MeshStandardMaterial({ map: STUD, vertexColors: true, roughness: 0.65 }),
  smooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
  neon: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.2, 2.2, 2.2) }),
};
const transparentMats = new Map();
function matFor(p) {
  if (p.mat === 'Neon') return MATS.neon;
  if (p.t > 0) {
    const key = `${p.t}_${p.st}`;
    if (!transparentMats.has(key)) transparentMats.set(key, new THREE.MeshStandardMaterial({ map: p.st ? STUD : null, vertexColors: true, roughness: 0.2, transparent: true, opacity: 1 - p.t, depthWrite: false }));
    return transparentMats.get(key);
  }
  return p.st ? MATS.studs : MATS.smooth;
}

// --- geometry ------------------------------------------------------------------------------
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  box(p, offset) {
    const col = new THREE.Color(p.c);
    const h = p.s.map((v) => v / 2);
    const ctr = [p.p[0] - offset[0], p.p[1] - offset[1], p.p[2] - offset[2]];
    for (const f of FACES) {
      const base = this.p.length / 3;
      const ua = f.u.findIndex((v) => v !== 0), va = f.v.findIndex((v) => v !== 0);
      for (const [du, dv] of CORN) {
        for (let a = 0; a < 3; a++) this.p.push(ctr[a] + (f.n[a] + f.u[a] * du + f.v[a] * dv) * h[a]);
        this.n.push(...f.n);
        this.uv.push((du + 1) / 2 * p.s[ua], (dv + 1) / 2 * p.s[va]);
        const shade = f.n[1] > 0 ? 1 : f.n[1] < 0 ? 0.72 : 0.9;
        this.c.push(col.r * shade, col.g * shade, col.b * shade);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  mesh(mat, name) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.castShadow = mat !== MATS.neon && !mat.transparent;
    m.receiveShadow = true;
    return m;
  }
}
function mergedGroup(parts, offset, name) {
  const byMat = new Map();
  for (const p of parts) {
    if (p.t >= 1) continue;
    const m = matFor(p);
    if (!byMat.has(m)) byMat.set(m, new Builder());
    byMat.get(m).box(p, offset);
  }
  const g = new THREE.Group();
  g.name = name;
  for (const [m, b] of byMat) g.add(b.mesh(m, name));
  return g;
}

// --- emitters approximating the Roblox ones --------------------------------------------------
function emitterFrom(p, kind) {
  const min = p.p.map((v, i) => v - p.s[i] / 2), max = p.p.map((v, i) => v + p.s[i] / 2);
  const base = { name: kind, seed: Math.floor(p.p[0] * 13 + p.p[2]), min, max };
  switch (kind) {
    case 'Sparkles': return createEmitter({ ...base, count: 50, vel: [0, 1, 0], velJitter: [0.6, 0.5, 0.6], life: [1.2, 2.4], size: [0.6, 1.0], colors: ['#8cf5ff', '#ffffff'], shape: 'glow', additive: true, twinkle: 0.8, intensity: 2 });
    case 'Mist': return createEmitter({ ...base, count: 40, vel: [0, 2, 0], velJitter: [1.5, 0.8, 1.5], life: [2, 3.5], size: [5, 9], colors: ['#ffffff'], shape: 'soft', opacity: 0.35 });
    case 'Splash': return createEmitter({ ...base, count: 30, vel: [0, -4, 0], velJitter: [2, 2, 2], gravity: -20, life: [0.5, 1], size: [0.6, 1.2], colors: ['#e6faff'], shape: 'square' });
    case 'Petals': return createEmitter({ ...base, count: 160, vel: [2.5, -3, 1], velJitter: [0.8, 0.6, 0.8], life: [7, 11], size: [0.7, 1.1], colors: ['#ffaacd', '#ffcde1', '#ff8cbe'], shape: 'square', spin: true, sway: 3 });
    case 'Wind': return createEmitter({ ...base, count: 90, vel: [28, 0, 0], velJitter: [5, 0.5, 1], life: [5, 7], size: [0.5, 0.8], colors: ['#ffffff', '#a0e65a'], shape: 'square', spin: true, sway: 1.5 });
    case 'Dust': return createEmitter({ ...base, count: 40, vel: [0, 0.6, 1.5], velJitter: [0.3, 0.3, 0.3], life: [5, 8], size: [0.4, 0.7], colors: ['#ffe1aa'], shape: 'square', sway: 1 });
    case 'Embers': return createEmitter({ ...base, count: 140, vel: [1, 1.6, 0], velJitter: [0.6, 0.6, 0.6], life: [6, 9], size: [0.5, 0.9], colors: ['#ffc86e', '#ff965a', '#fff0be'], shape: 'glow', additive: true, twinkle: 0.6, sway: 2, intensity: 1.6 });
    default: return null;
  }
}

// --- stage scene -------------------------------------------------------------------------------
const cache = new Map();
async function loadStage(id) {
  const data = await (await fetch(`${import.meta.env.BASE_URL}stages/${id}.json`)).json();
  const L = PRESETS[data.lighting] || PRESETS.day;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(L.fog, 260, 900);
  const sky = createSky({ ...L, sunDir: L.sunDir });
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi));
  const sun = new THREE.DirectionalLight(L.sunColor, L.sun);
  sun.position.set(...L.sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 800 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // group parts by container
  const containers = new Map();
  const markers = [];
  for (const p of data.parts) {
    if (!p.m) { markers.push(p); continue; }
    const key = p.f + '|' + p.m;
    if (!containers.has(key)) containers.set(key, { folder: p.f, model: p.m, parts: [] });
    containers.get(key).parts.push(p);
  }
  const anim = [];
  const staticParts = [];
  for (const c of containers.values()) {
    const kind = c.folder === 'FX' ? c.model.split('_')[0] : null;
    const pivotP = c.parts.find((p) => p.n === 'Pivot');
    const pivot = pivotP ? pivotP.p : c.parts[0].p;
    const ph = (c.model.length * 1.37) % (Math.PI * 2);
    if (!kind) { staticParts.push(...c.parts); continue; }
    if (['Spin', 'Swing', 'Bob', 'Cloud'].includes(kind)) {
      const holder = new THREE.Group();
      holder.position.set(...pivot);
      holder.add(mergedGroup(c.parts, pivot, c.model));
      scene.add(holder);
      anim.push({ kind, obj: holder, base: holder.position.clone(), ph });
    } else {
      // per-part animation: one mesh per part (cloth / waterfall)
      const meshes = [];
      for (const p of c.parts) {
        if (p.n === 'Pivot' || p.t >= 1) continue;
        const m = mergedGroup([p], p.p, c.model);
        m.position.set(...p.p);
        scene.add(m);
        meshes.push({ m, p0: new THREE.Vector3(...p.p), rel: new THREE.Vector3(p.p[0] - pivot[0], p.p[1] - pivot[1], p.p[2] - pivot[2]), h: p.s[1] });
      }
      const maxD = Math.max(0.001, ...meshes.map((o) => (kind === 'Flag' ? o.rel.x : -o.rel.y)));
      const maxX = Math.max(0.001, ...meshes.map((o) => Math.abs(o.rel.x)));
      const minY = Math.min(...meshes.map((o) => o.p0.y - o.h / 2));
      anim.push({ kind, meshes, maxD, maxX, topY: pivot[1], height: Math.max(4, pivot[1] - minY), ph });
    }
  }
  scene.add(mergedGroup(staticParts, [0, 0, 0], 'static'));
  for (const p of markers) {
    const [kind, sub] = [p.n.split('_')[0], p.n.split('_').slice(1).join('_')];
    if (kind === 'Emit' || kind === 'Drift') { const e = emitterFrom(p, sub); if (e) scene.add(e); }
  }
  // lantern lights (the Luau script adds PointLights the same way)
  let nl = 0;
  for (const p of data.parts) {
    if (p.n !== 'Lantern' || nl >= 10) continue;
    const l = new THREE.PointLight('#ffbe6e', 160, 40, 1.8);
    l.position.set(...p.p);
    l.userData.ph = nl * 1.7;
    scene.add(l);
    anim.push({ kind: 'Light', obj: l });
    nl++;
  }
  const count = data.parts.length;
  return { data, scene, sky, anim, count };
}

function update(st, t) {
  for (const a of st.anim) {
    switch (a.kind) {
      case 'Spin': a.obj.rotation.z = -t * 0.9; break;
      case 'Swing': a.obj.rotation.set(Math.sin(t * 1.1 + a.ph) * 0.1, 0, Math.sin(t * 0.9 + a.ph) * 0.22); break;
      case 'Bob': a.obj.position.y = a.base.y + Math.sin(t * 0.6 + a.ph) * 1.6; a.obj.rotation.z = Math.sin(t * 0.4 + a.ph) * 0.03; break;
      case 'Cloud': a.obj.position.x = a.base.x + (((t * (1.5 + (a.ph % 1.5)) + a.ph * 60) % 480) - 240); break;
      case 'Light': a.obj.intensity = 160 * (0.85 + 0.1 * Math.sin(t * 9 + a.obj.userData.ph)); break;
      case 'Waterfall':
        for (const o of a.meshes) {
          const phase = a.topY - o.p0.y;
          const drop = (phase + t * 14) % a.height;
          o.m.position.y = o.p0.y + phase - drop;
        }
        break;
      default: // Flag / Banner / Sail
        for (const o of a.meshes) {
          const d = a.kind === 'Flag' ? o.rel.x : -o.rel.y;
          const k = d / a.maxD;
          let dz;
          if (a.kind === 'Flag') dz = Math.sin(t * 6 - d * 0.35 + a.ph) * 1.1 * k;
          else if (a.kind === 'Banner') dz = Math.sin(t * 2.4 - d * 0.25 + a.ph) * 0.7 * k;
          else { const u = Math.abs(o.rel.x) / a.maxX; dz = -Math.sin(Math.PI * k) * (1 - u * u * 0.6) * (2.2 + Math.sin(t * 0.8 + a.ph) * 0.5) + Math.sin(t * 3 - o.rel.x * 0.3) * 0.25 * k; }
          o.m.position.z = o.p0.z + dz;
        }
    }
  }
}

// --- UI + loop ---------------------------------------------------------------------------------------
let current = null;
const GAME_VIEW = { pos: [0, 36, 235], target: [0, 20, 0] };
function gameView() { camera.position.set(...GAME_VIEW.pos); controls.target.set(...GAME_VIEW.target); controls.update(); }

async function setStage(id) {
  if (!cache.has(id)) cache.set(id, await loadStage(id));
  current = cache.get(id);
  renderPass.scene = current.scene;
  const def = STAGES.find((s) => s.id === id);
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
  document.querySelector('#title .icon').innerHTML = ICONS[def.icon];
  document.querySelector('#title .name').textContent = current.data.title;
  if (!capture) history.replaceState(null, '', `?stage=${id}`);
}

const tabs = document.getElementById('tabs');
for (const s of STAGES) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.id = s.id; b.setAttribute('role', 'tab');
  b.innerHTML = `${ICONS[s.icon]}<span class="lbl">${s.id}</span>`;
  b.addEventListener('click', () => setStage(s.id).then(() => { b.querySelector('.lbl').textContent = current.data.title; }));
  tabs.appendChild(b);
}
const rot = document.getElementById('btn-rotate');
rot.addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; rot.setAttribute('aria-pressed', String(controls.autoRotate)); });
document.getElementById('btn-side').addEventListener('click', gameView);

const timer = new THREE.Timer();
timer.connect(document);
let fixedTime = params.has('t') ? parseFloat(params.get('t')) : null;
function frame() {
  timer.update();
  const t = fixedTime ?? timer.getElapsed();
  globalUniforms.uTime.value = t;
  controls.update();
  update(current, t);
  current.sky.position.copy(camera.position);
  composer.render();
}

(async () => {
  // fill tab labels with the stage titles
  await Promise.all(STAGES.map(async (s) => { await setStage(s.id); tabs.querySelector(`[data-id="${s.id}"] .lbl`).textContent = current.data.title; }));
  await setStage(params.get('stage') || 'mines');
  if (params.has('cam')) {
    const v = params.get('cam').split(',').map(Number);
    camera.position.set(v[0], v[1], v[2]); controls.target.set(v[3], v[4], v[5]); controls.update();
  } else gameView();
  document.getElementById('loading').classList.add('hidden');
  renderer.setAnimationLoop(frame);
  window.__stage = { setStage, camera, controls, stats: () => ({ parts: current.count, calls: renderer.info.render.calls }) };
  window.__stageReady = true;
})().catch((e) => { console.error(e); document.getElementById('loading').textContent = 'Errore: ' + e.message; });
