// GIARDINO ZEN — a serene island: giant cherry blossom tree on a mossy crag,
// swaying bamboo grove, koi pond with lily pads under a red arched bridge,
// waterfall pouring off the island, torii gate, glowing stone lanterns,
// floating stepping platforms and drifting petals.
import * as THREE from 'three';
import { VoxelModel } from '../engine/VoxelModel.js';
import { BLOCK } from '../engine/blocks.js';
import { hash3, mulberry32 } from '../engine/rng.js';
import { floatingIsland, scatter, LightRig, satellite } from './common.js';
import { grassifyTops } from './mines.js';
import { createWaterfall, createWaterSurface } from '../vfx/waterfall.js';
import { createEmitter } from '../vfx/particles.js';

function toro(m, x, y, z) {
  m.box(x - 1, y, z - 1, x + 1, y, z + 1, BLOCK.STONE_LANTERN);
  m.set(x, y + 1, z, BLOCK.STONE_LANTERN);
  m.set(x, y + 2, z, BLOCK.STONE_LANTERN);
  m.box(x - 1, y + 3, z - 1, x + 1, y + 3, z + 1, BLOCK.BRICK_SLAB);
  m.set(x, y + 4, z, BLOCK.PAPER_LANTERN);
  m.box(x - 1, y + 5, z - 1, x + 1, y + 5, z + 1, BLOCK.ROOF);
  m.set(x, y + 6, z, BLOCK.STONE_LANTERN);
  return [x, y + 4, z];
}

export default {
  id: 'zen',
  title: 'Giardino Zen',
  icon: 'lotus',
  camera: { pos: [4, 26, 88], target: [2, 5, 0] },
  palette: {
    skyTop: '#3a8cf0', skyHorizon: '#b3e0ff', skyBottom: '#e3f4ff',
    sunDir: [0.4, 0.8, 0.55], sunColor: '#fff4dc', sunIntensity: 2.4,
    hemiSky: '#cfe8ff', hemiGround: '#6f8a58', hemiIntensity: 0.9,
    fog: '#c6e8ff', fogNear: 160, fogFar: 560,
    cloudColor: '#ffffff', cloudShade: '#c3d9f2', cloudEmissive: '#e3f1ff', cloudAmount: 0.55,
    bloom: 0.5, exposure: 1.02,
    bg: { seed: 51, leaves: [BLOCK.CHERRY, BLOCK.LEAVES, BLOCK.CHERRY_DARK] },
  },
  build(ctx) {
    const { atlas, mats } = ctx;
    const rnd = mulberry32(888);
    const root = new THREE.Group();
    const m = new VoxelModel();
    const lights = new LightRig(root, 6);

    const isl = floatingIsland(m, {
      cx: 0, cz: 0, rx: 29, rz: 19, y: 0, depth: 24, seed: 21,
      top: BLOCK.GRASS, sub: BLOCK.DIRT, rock: [BLOCK.STONE, BLOCK.GREYSTONE, BLOCK.STONE_DIRT, BLOCK.STONE], vineChance: 0.25,
    });

    // --- mossy crag behind, with the cherry tree on top -------------------------------
    m.sphere(4, 0, -11, 11, BLOCK.STONE, { ry: 11, noise: 0.3, seed: 8 });
    m.sphere(-6, 0, -12, 7, BLOCK.GREYSTONE, { ry: 8, noise: 0.35, seed: 9 });
    m.sphere(14, 0, -9, 6, BLOCK.STONE, { ry: 6, noise: 0.35, seed: 10 });
    grassifyTops(m, -20, 24, -26, 2, [BLOCK.STONE, BLOCK.GREYSTONE], BLOCK.ROCK_MOSS, 1);
    // stone steps up the crag (left side)
    for (let i = 0; i < 7; i++) m.box(-9 + i, 1, -2 - i, -9 + i, i + 1, -1 - i, BLOCK.COBBLE);

    // cherry tree
    let base = 12; while (!m.get(5, base, -11) && base > 0) base--;
    base += 1;
    const trunkPts = [[5, base, -11], [4, base + 5, -10], [6, base + 9, -11], [7, base + 12, -10]];
    for (let i = 0; i < trunkPts.length - 1; i++) {
      const [a, b] = [trunkPts[i], trunkPts[i + 1]];
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m.line(a[0] + ox, a[1], a[2] + oz, b[0] + ox, b[1], b[2] + oz, BLOCK.LOG);
    }
    // roots
    m.line(5, base, -11, 1, base - 2, -9, BLOCK.LOG);
    m.line(6, base, -10, 10, base - 2, -7, BLOCK.LOG);
    // branches
    const top = trunkPts[3];
    const branches = [[-6, 3, 2], [8, 2, 1], [1, 4, 5], [2, 3, -6], [-3, 1, -4]];
    for (const [bx, by, bz] of branches) m.line(top[0], top[1] - 2, top[2], top[0] + bx, top[1] + by, top[2] + bz, BLOCK.LOG);
    // canopy
    const blobs = [[0, 4, 0, 8], [-7, 3, 2, 6], [8, 2, 1, 6.5], [2, 5, 5, 6], [2, 4, -6, 6], [-4, 2, -4, 5], [5, 7, -1, 5]];
    for (const [bx, by, bz, r] of blobs) {
      m.sphere(top[0] + bx, top[1] + by, top[2] + bz, r, BLOCK.CHERRY, { ry: r * 0.62, noise: 0.35, seed: bx * 5 + bz, ifEmpty: true });
    }
    m.forEach((x, y, z, id) => { if (id === BLOCK.CHERRY && hash3(x, y, z, 4) < 0.3) m.set(x, y, z, BLOCK.CHERRY_DARK); });
    const canopy = { x: top[0], y: top[1] + 3, z: top[2] };

    // --- bamboo grove (built separately so it can sway) ---------------------------------
    const bambooGroups = [];
    for (let g = 0; g < 3; g++) {
      const bm = new VoxelModel();
      for (let i = 0; i < 6; i++) {
        const x = Math.round((rnd() - 0.5) * 5), z = Math.round((rnd() - 0.5) * 4);
        const h = 12 + Math.floor(rnd() * 9);
        for (let y = 0; y < h; y++) bm.set(x, y, z, BLOCK.BAMBOO);
        for (let k = 0; k < 4; k++) {
          const ly = h - 1 - Math.floor(rnd() * 5);
          bm.setIfEmpty(x + (rnd() < 0.5 ? 1 : -1), ly, z, BLOCK.LEAVES);
          bm.setIfEmpty(x, ly + 1, z + (rnd() < 0.5 ? 1 : -1), BLOCK.LEAVES);
        }
        bm.setIfEmpty(x, h, z, BLOCK.LEAVES);
      }
      const gx = -20 + g * 4, gz = -6 + (g % 2) * 4;
      let gy = 0; while (m.get(gx, gy + 1, gz)) gy++;
      const mesh = bm.build(atlas, mats, [0, 0, 0], 'bamboo_' + g);
      const pivot = new THREE.Group();
      pivot.name = 'bamboo_pivot_' + g;
      pivot.position.set(gx, gy + 0.5, gz);
      mesh.position.y = 0.5;
      pivot.add(mesh);
      pivot.userData.phase = g * 1.7;
      bambooGroups.push(pivot);
      root.add(pivot);
    }

    // --- pond, outflow channel ---------------------------------------------------------
    const pond = { cx: 2, cz: 7, rx: 9, rz: 5 };
    const inPond = (x, z) => ((x - pond.cx) / pond.rx) ** 2 + ((z - pond.cz) / pond.rz) ** 2 <= 1;
    let frontEdge = 12;
    for (let x = pond.cx - pond.rx - 1; x <= pond.cx + pond.rx + 1; x++) for (let z = pond.cz - pond.rz - 1; z <= pond.cz + pond.rz + 1; z++) {
      if (inPond(x, z)) {
        m.set(x, 0, z, 0); m.set(x, -1, z, 0);
        m.set(x, -2, z, hash3(x, 0, z, 2) < 0.5 ? BLOCK.SAND : BLOCK.GRAVEL);
      } else if (((x - pond.cx) / (pond.rx + 1.3)) ** 2 + ((z - pond.cz) / (pond.rz + 1.3)) ** 2 <= 1 && m.get(x, 0, z)) {
        m.set(x, 0, z, hash3(x, 1, z, 3) < 0.6 ? BLOCK.COBBLE : BLOCK.GRAVEL); // pebble rim
      }
    }
    // channel to the island's front edge
    while (m.get(2, -1, frontEdge + 1)) frontEdge++;
    for (let z = pond.cz + pond.rz - 1; z <= frontEdge; z++) for (let x = 1; x <= 3; x++) {
      m.set(x, 0, z, 0); m.set(x, -1, z, 0); m.set(x, -2, z, BLOCK.GRAVEL);
      m.set(0, 0, z, BLOCK.COBBLE); m.set(4, 0, z, BLOCK.COBBLE);
    }
    // lily pads
    for (let i = 0; i < 12; i++) {
      const x = Math.round(pond.cx + (rnd() - 0.5) * pond.rx * 1.6), z = Math.round(pond.cz + (rnd() - 0.5) * pond.rz * 1.4);
      if (inPond(x, z) && Math.abs(z - 7) > 1) m.set(x, 0, z, rnd() < 0.3 ? BLOCK.LILY_FLOWER : BLOCK.LILY);
    }

    // --- red arched bridge -----------------------------------------------------------------
    const bx0 = pond.cx - pond.rx - 2, bx1 = pond.cx + pond.rx + 2;
    for (let x = bx0; x <= bx1; x++) {
      const t = (x - bx0) / (bx1 - bx0);
      const y = Math.round(Math.sin(t * Math.PI) * 3.6);
      for (let z = 6; z <= 8; z++) m.set(x, y, z, BLOCK.PLANKS_DARK);
      m.set(x, y - 1, 6, BLOCK.LACQUER); m.set(x, y - 1, 8, BLOCK.LACQUER);
      for (const z of [5, 9]) {
        m.set(x, y + 2, z, BLOCK.LACQUER_SLAB);
        if ((x - bx0) % 3 === 0) { m.set(x, y, z, BLOCK.LACQUER_POST); m.set(x, y + 1, z, BLOCK.LACQUER_POST); }
        else m.set(x, y + 1, z, 0);
      }
    }
    // supporting legs into the pond
    for (const lx of [bx0 + 4, bx1 - 4]) for (const z of [6, 8]) {
      const t = (lx - bx0) / (bx1 - bx0), y = Math.round(Math.sin(t * Math.PI) * 3.6);
      m.box(lx, -2, z, lx, y - 1, z, BLOCK.LACQUER_POST);
    }

    // --- torii gate --------------------------------------------------------------------------
    const tx = 22, tz = 3;
    for (const px of [tx - 4, tx + 4]) {
      m.box(px, 1, tz, px, 10, tz, BLOCK.LACQUER);
      m.set(px, 1, tz, BLOCK.BLACK);
    }
    m.box(tx - 5, 8, tz, tx + 5, 8, tz, BLOCK.LACQUER);
    m.box(tx - 6, 10, tz, tx + 6, 10, tz, BLOCK.LACQUER);
    m.box(tx - 7, 11, tz, tx + 7, 11, tz, BLOCK.BLACK);
    m.set(tx - 8, 12, tz, BLOCK.BLACK); m.set(tx + 8, 12, tz, BLOCK.BLACK);
    m.box(tx, 9, tz, tx, 9, tz, BLOCK.BLACK);
    // gravel path through the torii
    for (let z = tz - 6; z <= tz + 10; z++) for (let x = tx - 1; x <= tx + 1; x++) if (isl.top(x, z) === 0 && m.get(x, 0, z) === BLOCK.GRASS) m.set(x, 0, z, BLOCK.GRAVEL);

    // --- stone lanterns ------------------------------------------------------------------------
    for (const [x, z] of [[-11, 6], [14, 9], [12, -1], [-4, 15], [27, 10]]) {
      let y = 0; while (m.get(x, y + 1, z)) y++;
      const [lx, ly, lz] = toro(m, x, y + 1, z);
      lights.add(lx, ly, lz + 1.2, '#ffcf73', 12, 11);
    }

    // --- decoration -----------------------------------------------------------------------------------
    scatter(m, isl, { chance: 0.2, blocks: [BLOCK.TALL_GRASS, BLOCK.FLOWER_P, BLOCK.FLOWER_W, BLOCK.TALL_GRASS, BLOCK.PETALS], seed: 7, avoid: (x, z) => inPond(x, z) });
    // fallen petals under the tree
    for (let i = 0; i < 70; i++) {
      const x = Math.round(canopy.x + (rnd() - 0.5) * 26), z = Math.round(canopy.z + 6 + (rnd() - 0.5) * 18);
      let y = 20; while (y > -2 && !m.get(x, y, z)) y--;
      const id = m.get(x, y, z);
      if (id === BLOCK.GRASS || id === BLOCK.ROCK_MOSS || id === BLOCK.GRAVEL) m.setIfEmpty(x, y + 1, z, BLOCK.PETALS);
    }
    // rocks
    for (const [x, z, r] of [[-15, 10, 2], [18, -6, 2.5], [-24, 2, 1.8]]) m.sphere(x, 1, z, r, BLOCK.GREYSTONE, { ry: r * 0.8, noise: 0.4, ifEmpty: true });
    grassifyTops(m, -26, -20, 0, 4, [BLOCK.GREYSTONE], BLOCK.ROCK_MOSS, 1);
    // little satellite with a pink tree
    satellite(m, -40, 6, -6, 5, 61);
    m.sphere(-40, 11, -6, 3.2, BLOCK.CHERRY, { ry: 2.4, noise: 0.3, ifEmpty: true });
    m.box(-40, 7, -6, -40, 9, -6, BLOCK.LOG);
    satellite(m, 40, -4, 6, 4, 62);

    // spring gushing out of the left cliff
    let springX = -20; while (m.get(springX - 1, -3, 2)) springX--;
    m.set(springX, -3, 2, BLOCK.WATER); m.set(springX, -3, 1, BLOCK.WATER);

    root.add(m.build(atlas, mats, [0, 0, 0], 'zen_island'));

    // --- water ------------------------------------------------------------------------------------
    const pondSurf = createWaterSurface({ name: 'pond', x: pond.cx, y: -0.65, z: pond.cz, w: pond.rx * 2 + 1, d: pond.rz * 2 + 1 });
    // clip the rectangle to the ellipse with an alpha map
    {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 32, 32, 32, 0, 0, Math.PI * 2); g.fill();
      const am = new THREE.CanvasTexture(c);
      pondSurf.mesh.material.alphaMap = am;
    }
    root.add(pondSurf.mesh);
    const chan = createWaterSurface({ name: 'channel', x: 2, y: -0.65, z: (pond.cz + pond.rz - 1 + frontEdge) / 2 + 0.5, w: 3, d: frontEdge - (pond.cz + pond.rz - 1) + 2 });
    root.add(chan.mesh);
    const fall = createWaterfall({ name: 'waterfall', x: 2, z: frontEdge + 1.1, top: -0.4, bottom: -52, width: 3.2, axis: 'x', fadeStart: 0.45 });
    root.add(fall.group);
    const fall2 = createWaterfall({ name: 'waterfall_side', x: springX - 1.0, z: 1.5, top: -2.6, bottom: -36, width: 1.6, axis: 'z', fadeStart: 0.35 });
    root.add(fall2.group);

    // --- floating stepping platforms (bobbing) ---------------------------------------------------------
    const bobbers = [];
    const addFloat = (x, y, z, w, d, kind) => {
      const v = new VoxelModel();
      if (kind === 'wood') {
        v.box(-w, 0, -d, w, 0, d, BLOCK.PLANKS);
        v.box(-w, -1, -d, w, -1, d, BLOCK.LACQUER_SLAB);
      } else {
        v.box(-w, 0, -d, w, 0, d, BLOCK.GRASS);
        v.box(-w + 1, -1, -d + 1, w - 1, -2, d - 1, BLOCK.STONE);
        v.set(0, -3, 0, BLOCK.STONE);
        v.setIfEmpty(w - 1, 1, 0, BLOCK.TALL_GRASS);
      }
      const g = v.build(atlas, mats, [0, 0, 0], 'float_' + kind);
      g.position.set(x, y, z);
      g.userData = { baseY: y, phase: rnd() * 6 };
      root.add(g);
      bobbers.push(g);
    };
    addFloat(-13, 10, 6, 3, 2, 'wood');
    addFloat(-2, 15, 0, 4, 2, 'wood');
    addFloat(16, 9, 8, 3, 2, 'wood');
    addFloat(-26, 6, 12, 2, 2, 'grass');

    // --- VFX ---------------------------------------------------------------------------------------------
    root.add(createEmitter({
      name: 'cherry_petals', seed: 4, count: 260, min: [canopy.x - 14, canopy.y - 4, canopy.z - 8], max: [canopy.x + 14, canopy.y + 4, canopy.z + 10],
      vel: [1.1, -1.2, 0.8], velJitter: [0.5, 0.4, 0.5], life: [7, 12], size: [0.3, 0.55],
      colors: ['#ffb6d5', '#ffd3e6', '#ff93c1', '#ffffff'], shape: 'square', spin: true, sway: 2.2,
    }));
    root.add(createEmitter({
      name: 'drifting_petals', seed: 6, count: 120, min: [-40, -5, -20], max: [40, 25, 25],
      vel: [1.6, -0.5, 0.3], velJitter: [0.5, 0.3, 0.5], life: [8, 14], size: [0.25, 0.45],
      colors: ['#ffb6d5', '#ffd3e6'], shape: 'square', spin: true, sway: 3,
    }));
    root.add(createEmitter({
      name: 'pond_sparkles', seed: 2, count: 40, min: [pond.cx - pond.rx + 1, -0.4, pond.cz - pond.rz + 1], max: [pond.cx + pond.rx - 1, -0.2, pond.cz + pond.rz - 1],
      vel: [0, 0.05, 0], life: [1, 2.2], size: [0.2, 0.35], colors: ['#ffffff', '#c9f0ff'], shape: 'glow', additive: true, twinkle: 1,
    }));
    root.add(createEmitter({
      name: 'butterflies', seed: 13, count: 14, min: [-20, 2, -2], max: [20, 6, 14], vel: [0.3, 0.1, 0.2], velJitter: [0.6, 0.3, 0.6],
      life: [6, 10], size: [0.4, 0.55], colors: ['#ffffff', '#ffe066', '#a8d8ff'], shape: 'square', spin: true, sway: 3,
    }));
    lights.finalize();

    return {
      root,
      update(t, dt) {
        lights.update(t);
        pondSurf.update(dt); chan.update(dt);
        fall.update(dt); fall2.update(dt);
        for (const g of bambooGroups) {
          g.rotation.z = Math.sin(t * 0.9 + g.userData.phase) * 0.025;
          g.rotation.x = Math.sin(t * 0.7 + g.userData.phase * 1.3) * 0.015;
        }
        for (const b of bobbers) b.position.y = b.userData.baseY + Math.sin(t * 0.7 + b.userData.phase) * 0.5;
        root.position.y = Math.sin(t * 0.42) * 0.3;
      },
    };
  },
};
