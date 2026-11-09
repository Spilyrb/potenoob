import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { buildAtlas } from './engine/atlas.js';
import { createVoxelMaterials, globalUniforms } from './engine/materials.js';
import { createSky } from './vfx/sky.js';
import { createClouds } from './vfx/clouds.js';
import { backgroundIslands } from './maps/common.js';
import { ICONS } from './icons.js';

import mines from './maps/mines.js';
import fort from './maps/fort.js';
import wreck from './maps/wreck.js';
import zen from './maps/zen.js';

const MAPS = [mines, fort, wreck, zen];
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
if (capture) document.body.classList.add('capture');

// --- renderer ---------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: capture });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps the saturated toy-like palette
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = !capture;
controls.autoRotateSpeed = 0.35;
controls.minDistance = 20;
controls.maxDistance = 260;
controls.maxPolarAngle = Math.PI * 0.62;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.92);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  globalUniforms.uPointScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
window.addEventListener('resize', resize);
resize();

// --- scene assembly -----------------------------------------------------------
let ctx = null;
const cache = new Map();
let current = null;

function buildMapScene(def) {
  const p = def.palette;
  const scene = new THREE.Scene();
  scene.name = def.id;
  scene.fog = new THREE.Fog(p.fog, p.fogNear ?? 140, p.fogFar ?? 520);
  scene.background = new THREE.Color(p.skyHorizon);

  const sky = createSky(p);
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity ?? 0.8));
  scene.add(new THREE.AmbientLight(p.ambient ?? '#ffffff', p.ambientIntensity ?? 0.15));
  const sun = new THREE.DirectionalLight(p.sunLight ?? p.sunColor, p.sunIntensity ?? 2.2);
  const sd = new THREE.Vector3(...p.sunDir).normalize();
  sun.position.copy(sd).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const clouds = createClouds(ctx, p);
  scene.add(clouds.group);
  const bg = backgroundIslands(ctx, p.bg || {});
  scene.add(bg.group);

  const map = def.build(ctx);
  map.root.name = def.id;
  scene.add(map.root);

  return {
    def, scene, sky,
    update(t, dt) {
      clouds.update(dt);
      bg.update(t);
      map.update(t, dt);
      sky.position.copy(camera.position);
    },
    root: map.root,
  };
}

function setMap(id) {
  const def = MAPS.find((m) => m.id === id) || MAPS[0];
  if (!cache.has(def.id)) cache.set(def.id, buildMapScene(def));
  current = cache.get(def.id);
  renderPass.scene = current.scene;
  camera.position.set(...def.camera.pos);
  controls.target.set(...def.camera.target);
  controls.update();
  bloom.strength = def.palette.bloom ?? 0.5;
  renderer.toneMappingExposure = def.palette.exposure ?? 1.05;
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === def.id)));
  const title = document.getElementById('title');
  title.querySelector('.icon').innerHTML = ICONS[def.icon];
  title.querySelector('.name').textContent = def.title;
  if (!capture) history.replaceState(null, '', `?map=${def.id}`);
}

// --- export -----------------------------------------------------------------
async function exportGLB(id) {
  const def = MAPS.find((m) => m.id === id) || current.def;
  if (!cache.has(def.id)) cache.set(def.id, buildMapScene(def));
  const root = cache.get(def.id).root;
  // export a clean copy without GPU-only particle systems
  const hidden = [];
  root.traverse((o) => { if (o.userData.noExport || o.isPoints || o.isLight) { if (o.visible) { hidden.push(o); o.visible = false; } } });
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 4096 });
  hidden.forEach((o) => { o.visible = true; });
  return result;
}

function download(buf, name, type) {
  const url = URL.createObjectURL(new Blob([buf], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// --- UI ---------------------------------------------------------------------
function buildUI() {
  const tabs = document.getElementById('tabs');
  for (const m of MAPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.id = m.id;
    b.innerHTML = `${ICONS[m.icon]}<span class="lbl">${m.title}</span>`;
    b.addEventListener('click', () => setMap(m.id));
    tabs.appendChild(b);
  }
  const rot = document.getElementById('btn-rotate');
  rot.setAttribute('aria-pressed', String(controls.autoRotate));
  rot.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    rot.setAttribute('aria-pressed', String(controls.autoRotate));
  });
  document.getElementById('btn-export').addEventListener('click', async () => {
    const buf = await exportGLB(current.def.id);
    download(buf, `${current.def.id}.glb`, 'model/gltf-binary');
  });
  document.getElementById('btn-shot').addEventListener('click', () => {
    composer.render();
    canvas.toBlob((b) => download(b, `${current.def.id}.png`, 'image/png'));
  });
}

// --- loop -------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
let fixedTime = params.has('t') ? parseFloat(params.get('t')) : null;
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = fixedTime ?? timer.getElapsed();
  globalUniforms.uTime.value = t;
  controls.update();
  current.update(t, fixedTime !== null ? 0 : dt);
  composer.render();
}

async function init() {
  const atlas = await buildAtlas();
  const mats = createVoxelMaterials(atlas.texture);
  ctx = { atlas, mats };
  buildUI();
  setMap(params.get('map') || MAPS[0].id);
  document.getElementById('loading').classList.add('hidden');
  renderer.setAnimationLoop(frame);
  // hooks for automation (screenshots / glb export scripts)
  window.__voxel = {
    maps: MAPS.map((m) => m.id),
    setMap,
    setTime(t) { fixedTime = t; },
    renderOnce() { frame(); },
    async exportGLB(id) {
      const buf = await exportGLB(id);
      let s = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    stats() {
      let tris = 0, voxMeshes = 0;
      current.scene.traverse((o) => { if (o.isMesh && o.geometry.index) { tris += o.geometry.index.count / 3; voxMeshes++; } });
      return { tris, meshes: voxMeshes, calls: renderer.info.render.calls };
    },
    camera, controls,
  };
  window.__voxelReady = true;
}
init().catch((e) => {
  console.error(e);
  document.getElementById('loading').textContent = 'Errore: ' + e.message;
});
