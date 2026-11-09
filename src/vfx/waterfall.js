// Animated voxel waterfalls: a pixel-art streak texture scrolled downward on a
// stepped column, vertex alpha fading into the clouds, plus foam + mist emitters.
import * as THREE from 'three';
import { createEmitter } from './particles.js';
import { mulberry32 } from '../engine/rng.js';

let sharedTex = null;
function waterTexture() {
  if (sharedTex) return sharedTex;
  const W = 16, H = 32;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const r = mulberry32(42);
  const pal = ['#2f8de0', '#3fa4f0', '#56b9ff', '#8fd6ff', '#d9f4ff'];
  for (let x = 0; x < W; x++) {
    // each column has its own streak pattern
    let y = 0;
    while (y < H) {
      const len = 2 + Math.floor(r() * 7);
      const idx = r() < 0.12 ? 4 : r() < 0.3 ? 3 : Math.floor(r() * 3);
      ctx.fillStyle = pal[idx];
      ctx.fillRect(x, y, 1, len);
      y += len;
    }
  }
  sharedTex = new THREE.CanvasTexture(c);
  sharedTex.wrapS = sharedTex.wrapT = THREE.RepeatWrapping;
  sharedTex.magFilter = THREE.NearestFilter;
  sharedTex.minFilter = THREE.NearestMipmapLinearFilter;
  sharedTex.colorSpace = THREE.SRGBColorSpace;
  sharedTex.name = 'waterfall_streaks';
  return sharedTex;
}

/**
 * @param {object} o
 *  x, z      centre of the fall (top)
 *  top       y where water leaves the edge
 *  bottom    y where it ends (fades out)
 *  width     along `axis`
 *  axis      'x' | 'z' (direction the sheet spans)
 *  fadeStart fraction of height where alpha starts to fade (0..1, from top)
 *  splashY   optional y of a pool to spawn splash particles
 */
export function createWaterfall(o) {
  const group = new THREE.Group();
  group.name = o.name || 'waterfall';
  const tex = waterTexture().clone();
  tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    name: 'waterfall', map: tex, emissive: new THREE.Color('#4aaeff'), emissiveMap: tex, emissiveIntensity: 0.55,
    roughness: 0.25, metalness: 0, transparent: true, depthWrite: false, vertexColors: true, side: THREE.DoubleSide,
  });

  const h = o.top - o.bottom;
  const w = o.width, d = o.depth ?? 1.2;
  const segs = Math.max(4, Math.round(h / 2));
  const geo = new THREE.BoxGeometry(o.axis === 'x' ? w : d, h, o.axis === 'x' ? d : w, 1, segs, 1);
  geo.translate(0, -h / 2, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 4);
  const fadeStart = o.fadeStart ?? 0.55;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    uv.setXY(i, (x + z) * 0.5, y / 4);
    const t = -y / h; // 0 at top -> 1 at bottom
    const a = 1 - THREE.MathUtils.smoothstep(t, fadeStart, 1);
    // stepped widening near the bottom (voxel spray) – push vertices out a little
    const spread = 1 + Math.max(0, t - 0.6) * (o.spread ?? 0.6);
    if (o.axis === 'x') pos.setZ(i, z * spread); else pos.setX(i, x * spread);
    colors.set([1, 1, 1, a], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const sheet = new THREE.Mesh(geo, mat);
  sheet.position.set(o.x, o.top, o.z);
  sheet.renderOrder = 2;
  group.add(sheet);

  // foam at the lip
  const lipW = o.axis === 'x' ? [w / 2, 0.6] : [0.6, w / 2];
  group.add(createEmitter({
    name: 'waterfall_foam', seed: Math.floor(o.x * 13 + o.z * 7),
    count: Math.round(w * 10), min: [o.x - lipW[0], o.top - 1, o.z - lipW[1]], max: [o.x + lipW[0], o.top + 0.3, o.z + lipW[1]],
    vel: [0, -6, 0], velJitter: [0.6, 2, 0.6], gravity: -6, life: [0.6, 1.2], size: [0.25, 0.5],
    colors: ['#ffffff', '#dff6ff'], shape: 'square',
  }));
  // falling droplets along the column
  group.add(createEmitter({
    name: 'waterfall_drops', seed: 9 + Math.floor(o.top),
    count: Math.round(w * h * 0.6), min: [o.x - lipW[0] * 1.2, o.bottom + h * 0.2, o.z - lipW[1] * 1.2], max: [o.x + lipW[0] * 1.2, o.top, o.z + lipW[1] * 1.2],
    vel: [0, -9, 0], velJitter: [0.8, 3, 0.8], life: [0.8, 1.8], size: [0.15, 0.35],
    colors: ['#bfe9ff', '#ffffff', '#7fcfff'], shape: 'square', opacity: 0.85,
  }));
  // mist where it dissolves into the clouds / pool
  const my = o.splashY ?? o.bottom + h * 0.25;
  group.add(createEmitter({
    name: 'waterfall_mist', seed: 3 + Math.floor(o.z),
    count: Math.round(w * 14), min: [o.x - lipW[0] * 1.6 - 1, my - 1, o.z - lipW[1] * 1.6 - 1], max: [o.x + lipW[0] * 1.6 + 1, my + 2, o.z + lipW[1] * 1.6 + 1],
    vel: [0, 1.2, 0], velJitter: [1.2, 0.6, 1.2], life: [1.5, 3.2], size: [1.2, 2.6],
    colors: ['#ffffff', '#e8f7ff'], shape: 'soft', opacity: 0.35, sway: 0.8,
  }));

  const speed = o.speed ?? 1.4;
  return {
    group,
    update(dt) { tex.offset.y += dt * speed; },
  };
}

// Calm animated water surface (pond / pool) with scrolling ripples.
export function createWaterSurface(o) {
  const tex = waterTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(o.w / 4, o.d / 4);
  const mat = new THREE.MeshStandardMaterial({
    name: 'pond', map: tex, emissive: new THREE.Color('#3aa0f0'), emissiveMap: tex, emissiveIntensity: 0.35,
    roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(o.x, o.y, o.z);
  m.name = o.name || 'pond';
  m.renderOrder = 1;
  return { mesh: m, update(dt) { tex.offset.x += dt * 0.05; tex.offset.y += dt * 0.12; } };
}
