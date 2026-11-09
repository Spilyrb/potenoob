// Voxel cumulus clouds that drift and wrap around the scene, plus a "cloud sea"
// layer far below the islands. Built with the same voxel mesher (AO gives the
// soft, chunky shading).
import * as THREE from 'three';
import { VoxelModel } from '../engine/VoxelModel.js';
import { BLOCK } from '../engine/blocks.js';
import { mulberry32 } from '../engine/rng.js';

function cloudModel(rnd, w, h, d) {
  const m = new VoxelModel();
  const puffs = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < puffs; i++) {
    const t = puffs === 1 ? 0.5 : i / (puffs - 1);
    const cx = (t - 0.5) * w;
    const r = (0.35 + rnd() * 0.35) * Math.min(w * 0.5, d);
    const cz = (rnd() - 0.5) * d * 0.4;
    const cy = r * 0.25 + rnd() * h * 0.3;
    m.sphere(cx, cy, cz, r, BLOCK.CLOUD, { ry: r * (0.55 + rnd() * 0.3), noise: 0.25, seed: i * 13 });
  }
  // flat underside like stylised cumulus
  const kill = [];
  m.forEach((x, y, z) => { if (y < 0) kill.push([x, y, z]); });
  kill.forEach(([x, y, z]) => m.del(x, y, z));
  return m;
}

export function createClouds(ctx, p) {
  const { atlas } = ctx;
  const rnd = mulberry32(p.seed || 77);
  const tint = new THREE.Color(p.cloudColor);
  const mat = new THREE.MeshStandardMaterial({
    name: 'cloud', map: atlas.texture, vertexColors: true, roughness: 1, metalness: 0,
    color: tint, emissive: new THREE.Color(p.cloudEmissive || p.cloudColor), emissiveIntensity: p.cloudGlow ?? 0.28,
    fog: true,
  });
  const mats = { opaque: mat, cutout: mat, emissive: mat };
  const group = new THREE.Group();
  group.name = 'clouds';
  const drifting = [];
  const range = p.cloudRange || 260;

  // a small library of shapes reused by many clouds
  const shapes = [];
  for (let i = 0; i < 7; i++) {
    const w = 10 + rnd() * 16, h = 6 + rnd() * 6, d = 6 + rnd() * 8;
    const g = cloudModel(rnd, w, h, d).build(atlas, mats, [0, 0, 0], 'cloud_shape_' + i);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    shapes.push(g);
  }

  const add = (x, y, z, s, speed) => {
    const c = shapes[Math.floor(rnd() * shapes.length)].clone();
    c.position.set(x, y, z);
    c.scale.setScalar(s);
    c.rotation.y = rnd() < 0.5 ? 0 : Math.PI;
    c.userData.speed = speed;
    group.add(c);
    drifting.push(c);
  };

  // mid-level clouds around the island (keep the central play area clear)
  const nMid = p.midClouds ?? 14;
  for (let i = 0; i < nMid; i++) {
    // behind and beside the island, never between it and the default camera
    const a = Math.PI + (rnd() - 0.5) * Math.PI * 1.25, r = 90 + rnd() * 170;
    add(Math.cos(a + Math.PI / 2) * r, -25 + rnd() * 55, Math.sin(a + Math.PI / 2) * r * 0.9 - 40, 1.2 + rnd() * 1.4, 0.8 + rnd() * 1.6);
  }
  // cloud sea far below
  const nSea = p.seaClouds ?? 34;
  for (let i = 0; i < nSea; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 260;
    add(Math.cos(a) * r, (p.seaY ?? -105) - rnd() * 20, Math.sin(a) * r - 40, 2.4 + rnd() * 2.4, 0.4 + rnd() * 0.6);
  }

  return {
    group,
    update(dt) {
      for (const c of drifting) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > range) c.position.x = -range;
      }
    },
  };
}
