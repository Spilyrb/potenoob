// FORTE DI VENTO — an arched stone bridge between two floating crags, a central
// keep with a heraldic banner, flag-topped towers, a windmill with spinning
// sails, red-trimmed floating platforms, waterfalls and gusts of wind.
import * as THREE from 'three';
import { VoxelModel } from '../engine/VoxelModel.js';
import { BLOCK } from '../engine/blocks.js';
import { hash3, mulberry32 } from '../engine/rng.js';
import { floatingIsland, satellite, scatter, LightRig, cloth, EMBLEMS, tree } from './common.js';
import { createWaterfall } from '../vfx/waterfall.js';
import { createEmitter } from '../vfx/particles.js';

function squareTower(m, cx, cz, half, y0, h, o = {}) {
  const wall = o.wall ?? BLOCK.BRICK;
  for (let y = y0; y < y0 + h; y++) {
    const band = (y - y0) % 7 === 6;
    for (let x = cx - half; x <= cx + half; x++) for (let z = cz - half; z <= cz + half; z++) {
      const edge = x === cx - half || x === cx + half || z === cz - half || z === cz + half;
      if (!edge && y < y0 + h - 1) { m.set(x, y, z, 0); continue; }
      const corner = (x === cx - half || x === cx + half) && (z === cz - half || z === cz + half);
      let id = band || corner ? BLOCK.BRICK_DARK : wall;
      if (y - y0 < 3 && hash3(x, y, z, 5) < 0.4) id = BLOCK.BRICK_MOSS;
      m.set(x, y, z, id);
    }
  }
  const top = y0 + h;
  // corbelled parapet
  for (let x = cx - half - 1; x <= cx + half + 1; x++) for (let z = cz - half - 1; z <= cz + half + 1; z++) {
    const edge = x === cx - half - 1 || x === cx + half + 1 || z === cz - half - 1 || z === cz + half + 1;
    if (!edge) continue;
    m.set(x, top, z, BLOCK.BRICK_DARK);
    if ((x + z) % 2 === 0) m.set(x, top + 1, z, BLOCK.BRICK);
  }
  m.box(cx - half, top - 1, cz - half, cx + half, top - 1, cz + half, BLOCK.PAVING);
  // arrow slits
  for (let y = y0 + 4; y < y0 + h - 3; y += 5) {
    m.set(cx, y, cz + half, BLOCK.BLACK); m.set(cx, y + 1, cz + half, BLOCK.BLACK);
    m.set(cx + half, y, cz, BLOCK.BLACK); m.set(cx - half, y, cz, BLOCK.BLACK);
  }
  return top;
}

function windmillBody(m, cx, cz, y0) {
  for (let i = 0; i < 12; i++) {
    const r = 3.2 - i * 0.12;
    m.cylinder(cx, y0 + i, cz, r, 1, i % 4 === 3 ? BLOCK.BEAM : BLOCK.PLASTER);
  }
  // cone roof
  for (let i = 0; i < 5; i++) m.cylinder(cx, y0 + 12 + i, cz, 3.4 - i * 0.75, 1, BLOCK.ROOF_RED);
  m.set(cx, y0 + 6, cz + 3, BLOCK.BLACK); m.set(cx, y0 + 7, cz + 3, BLOCK.BLACK);
  m.box(cx - 1, y0, cz + 3, cx + 1, y0 + 2, cz + 3, BLOCK.PLANKS_DARK);
  m.set(cx, y0 + 10, cz + 3, BLOCK.BEAM); m.set(cx, y0 + 10, cz + 4, BLOCK.BEAM);
  return [cx, y0 + 10, cz + 5];
}

export default {
  id: 'fort',
  title: 'Forte di Vento',
  icon: 'tower',
  camera: { pos: [0, 20, 100], target: [0, 4, 0] },
  palette: {
    skyTop: '#2a7fe6', skyHorizon: '#9ed6ff', skyBottom: '#d8f0ff',
    sunDir: [-0.45, 0.8, 0.5], sunColor: '#fff6e0', sunIntensity: 2.3,
    hemiSky: '#c4e4ff', hemiGround: '#6a7660', hemiIntensity: 0.85,
    fog: '#bfe5ff', fogNear: 170, fogFar: 600,
    cloudColor: '#ffffff', cloudShade: '#b9d4ef', cloudEmissive: '#dbeeff', cloudAmount: 0.65,
    bloom: 0.45, exposure: 1.0,
    bg: { seed: 23 },
  },
  build(ctx) {
    const { atlas, mats } = ctx;
    const rnd = mulberry32(77);
    const root = new THREE.Group();
    const m = new VoxelModel();
    const lights = new LightRig(root, 6);

    // --- end crags --------------------------------------------------------------
    const left = floatingIsland(m, { cx: -36, cz: -3, rx: 13, rz: 11, y: 0, depth: 24, seed: 12, top: BLOCK.GRASS, sub: BLOCK.DIRT });
    const right = floatingIsland(m, { cx: 37, cz: -3, rx: 13, rz: 11, y: 0, depth: 24, seed: 13, top: BLOCK.GRASS, sub: BLOCK.DIRT });

    // --- arched bridge -------------------------------------------------------------
    const spans = [-14, 0, 14], hw = 5, spring = -11;
    for (let x = -26; x <= 26; x++) for (let z = -6; z <= 6; z++) {
      for (let y = -26; y <= 0; y++) {
        let carve = false;
        for (const c of spans) {
          const dx = x - c;
          if (Math.abs(dx) <= hw && (y < spring || dx * dx + (y - spring) ** 2 <= hw * hw)) carve = true;
        }
        if (carve) continue;
        // ragged pier bottoms
        if (y < -18 - Math.floor(hash3(x, 0, z, 4) * 8)) continue;
        let id = BLOCK.BRICK;
        if (y === 0) id = hash3(x, y, z, 1) < 0.2 ? BLOCK.GRASS : BLOCK.PAVING;
        else if (y === -1 || y === -2) id = BLOCK.BRICK_DARK;
        else if (hash3(x, y, z, 2) < 0.15) id = BLOCK.BRICK_MOSS;
        else if (hash3(x, y, z, 3) < 0.2) id = BLOCK.BRICK_DARK;
        m.set(x, y, z, id);
      }
    }
    // arch voussoirs (darker ring)
    for (const c of spans) for (let a = 0; a <= 32; a++) {
      const ang = (a / 32) * Math.PI;
      const x = Math.round(c + Math.cos(ang) * (hw + 0.5)), y = Math.round(spring + Math.sin(ang) * (hw + 0.5));
      for (const z of [-6, 6]) m.set(x, y, z, BLOCK.BRICK_DARK);
    }
    // rock blobs under the piers
    for (const px of [-23, -7, 7, 23]) {
      m.sphere(px, -24, 0, 4.5, BLOCK.STONE, { ry: 6, noise: 0.4, seed: px });
      m.sphere(px, -29, 0, 2.5, BLOCK.GREYSTONE, { ry: 4, noise: 0.4, seed: px + 1 });
    }
    // parapets with crenels along both edges
    for (let x = -26; x <= 26; x++) for (const z of [-7, 7]) {
      if (z === 7 && Math.abs(x) <= 2) continue; // gap for the keep stairs
      m.set(x, 0, z, BLOCK.BRICK_DARK);
      m.set(x, 1, z, BLOCK.BRICK);
      if (x % 2 === 0) m.set(x, 2, z, BLOCK.BRICK);
    }
    // vines down the bridge faces
    for (let x = -26; x <= 26; x++) for (const z of [-8, 8]) {
      if (rnd() < 0.22) { const len = 1 + Math.floor(rnd() * 5); for (let i = 0; i < len; i++) m.setIfEmpty(x, -1 - i, z, BLOCK.VINE); }
    }

    // --- central keep -------------------------------------------------------------------
    const keepTop = squareTower(m, 0, -1, 5, 1, 23);
    // keep doorway and front stairs
    m.box(-1, 1, 4, 1, 4, 4, BLOCK.BLACK);
    m.box(-2, 5, 4, 2, 5, 4, BLOCK.BRICK_DARK);
    for (let i = 0; i < 3; i++) m.box(-2, 0, 7 - i, 2, i, 7 - i, BLOCK.PAVING);
    m.box(-3, 1, 5, -3, 3, 5, BLOCK.BRICK_DARK); m.box(3, 1, 5, 3, 3, 5, BLOCK.BRICK_DARK);
    m.set(-3, 4, 5, BLOCK.LANTERN); m.set(3, 4, 5, BLOCK.LANTERN);
    lights.add(-3, 4, 5.8, '#ffbf66', 16, 14); lights.add(3, 4, 5.8, '#ffbf66', 16, 14);
    // mid-level red-trimmed balconies on the keep's sides
    for (const sx of [-1, 1]) {
      const x0 = sx * 6, x1 = sx * 15;
      m.box(Math.min(x0, x1), 12, -3, Math.max(x0, x1), 12, 2, BLOCK.PAVING);
      m.box(Math.min(x0, x1), 11, -3, Math.max(x0, x1), 11, 2, BLOCK.LACQUER_SLAB);
      m.box(sx * 11, 1, 0, sx * 11, 10, 0, BLOCK.BRICK_DARK);
      m.box(sx * 11, 1, -1, sx * 11, 3, 1, BLOCK.BRICK);
    }

    // --- left towers ----------------------------------------------------------------------
    const ltTop = squareTower(m, -36, -6, 4, 1, 21);
    const lt2Top = squareTower(m, -28, 2, 3, 1, 13, { wall: BLOCK.BRICK });
    // little curtain wall between them
    m.box(-34, 1, -1, -31, 6, 0, BLOCK.BRICK);

    // --- right tower + windmill --------------------------------------------------------------
    const rtTop = squareTower(m, 28, -6, 3, 1, 15);
    const hub = windmillBody(m, 40, -2, 1);

    // --- floating platforms (wood with red lacquer trim) on stems --------------------------------
    const platforms = [[-21, 9, 8], [21, 9, 8], [0, 28, 8]];
    for (const [px, py, pz] of platforms.slice(0, 2)) {
      m.box(px - 3, py, pz - 2, px + 3, py, pz + 2, BLOCK.PLANKS);
      m.box(px - 3, py - 1, pz - 2, px + 3, py - 1, pz + 2, BLOCK.LACQUER_SLAB);
      m.box(px, 1, pz, px, py - 2, pz, BLOCK.POST);
    }
    // detached floating slab with grass top (high on the left)
    satellite(m, -19, 23, 16, 3, 71, { depthK: 1.2, vineChance: 0.4 });
    satellite(m, 17, 25, -18, 3, 72, { depthK: 1.2 });

    // --- water: stream on the right crag feeding the waterfall --------------------------------------
    for (let x = 42; x <= 49; x++) for (let z = 3; z <= 5; z++) { if (m.get(x, 0, z)) m.set(x, 0, z, BLOCK.WATER); }
    let edgeX = 42; while (m.get(edgeX + 1, -1, 4)) edgeX++;
    for (let x = 33; x <= 42; x++) m.set(x, 0, 4, BLOCK.WATER);
    m.box(30, 1, 4, 32, 1, 4, BLOCK.PAVING); m.set(32, 0, 4, BLOCK.WATER);
    // small waterfall from the left crag
    for (let x = -49; x <= -40; x++) if (m.get(x, 0, 3)) m.set(x, 0, 3, BLOCK.WATER);
    let edgeXL = -40; while (m.get(edgeXL - 1, -1, 3)) edgeXL--;

    // --- decoration -----------------------------------------------------------------------------
    scatter(m, left, { chance: 0.18, blocks: [BLOCK.TALL_GRASS, BLOCK.FLOWER_W, BLOCK.FLOWER_Y, BLOCK.TALL_GRASS], seed: 2 });
    scatter(m, right, { chance: 0.18, blocks: [BLOCK.TALL_GRASS, BLOCK.FLOWER_P, BLOCK.TALL_GRASS], seed: 4 });
    tree(m, -44, 1, -8, { h: 5, r: 3 });
    tree(m, 46, 1, -9, { h: 4, r: 2.5 });
    satellite(m, -60, 10, -14, 5, 81); tree(m, -60, 11, -14, { h: 4, r: 2.5 });
    satellite(m, 62, -6, 10, 4, 82);

    root.add(m.build(atlas, mats, [0, 0, 0], 'fort_island'));

    // --- cloth: banners, flags ---------------------------------------------------------------------
    const banner = (x, y, z, w, h, rotY = 0) => {
      const b = cloth({ name: 'banner', mode: 'banner', w, h, pos: [x - w / 2, y, z], rotY, px: [12, 20], seed: Math.floor(x * 3),
        color: '#b8312e', trim: '#f2c84b', emblem: EMBLEMS.crest, pointed: true, amp: 0.25, freq: 1.2, speed: 2.2 });
      root.add(b);
    };
    banner(0, 22, 4.56, 4.6, 8.5);
    banner(-23, -0.6, 6.56, 4.2, 9);
    banner(23, -0.6, 6.56, 4.2, 9);
    banner(-36, 18, -1.44, 3.6, 6);
    const flag = (x, y, z, h = 4) => {
      const pole = new VoxelModel();
      for (let i = 0; i < h; i++) pole.set(0, i, 0, BLOCK.IRON_POST);
      pole.set(0, h, 0, BLOCK.GOLD);
      const pm = pole.build(atlas, mats, [0, 0, 0], 'flagpole');
      pm.position.set(x, y, z);
      root.add(pm);
      root.add(cloth({ name: 'flag', mode: 'flag', w: 4.5, h: 2.6, pos: [x + 0.15, y + h - 0.1, z], px: [16, 9], seed: Math.floor(x),
        color: '#c4302b', emblem: EMBLEMS.diamond, pennant: true, amp: 0.55, freq: 1.6, speed: 6 }));
    };
    flag(0, keepTop, -1, 6);
    flag(-36, ltTop, -6, 5);
    flag(-28, lt2Top, 2, 4);
    flag(28, rtTop, -6, 4);
    flag(40, 18, -2, 3);

    // --- windmill sails (rotating) ---------------------------------------------------------------
    const sails = new VoxelModel();
    for (let a = 0; a < 4; a++) {
      const dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][a];
      for (let i = 1; i <= 10; i++) {
        sails.set(dir[0] * i, dir[1] * i, 0, BLOCK.BEAM);
        // lattice blade on one side of each arm
        const side = [[0, -1], [1, 0], [0, 1], [-1, 0]][a];
        if (i >= 3) for (let k = 1; k <= 3; k++) {
          const lattice = (i + k) % 2 === 0 ? BLOCK.PLANKS_LIGHT : BLOCK.PLASTER;
          sails.set(dir[0] * i + side[0] * k, dir[1] * i + side[1] * k, 0, lattice);
        }
      }
    }
    sails.set(0, 0, 0, BLOCK.IRON); sails.set(0, 0, 1, BLOCK.IRON);
    const sailMesh = sails.build(atlas, mats, [0, 0, 0], 'windmill_sails');
    const sailPivot = new THREE.Group();
    sailPivot.name = 'windmill_sails_pivot';
    sailPivot.position.set(...hub);
    sailPivot.add(sailMesh);
    root.add(sailPivot);

    // --- waterfalls -------------------------------------------------------------------------------
    const falls = [
      createWaterfall({ name: 'waterfall_right', x: edgeX + 1.2, z: 4, top: 0.5, bottom: -55, width: 3, axis: 'z', fadeStart: 0.45 }),
      createWaterfall({ name: 'waterfall_left', x: edgeXL - 1.2, z: 3, top: 0.5, bottom: -40, width: 2.2, axis: 'z', fadeStart: 0.4 }),
    ];
    falls.forEach((f) => root.add(f.group));

    // --- wind gusts + blowing leaves -------------------------------------------------------------------
    root.add(createEmitter({
      name: 'wind_streaks', seed: 4, count: 70, min: [-90, -10, -30], max: [-20, 40, 30], vel: [26, 0, 0], velJitter: [6, 0.5, 1],
      life: [3, 5], size: [0.25, 0.4], colors: ['#ffffff'], shape: 'square', opacity: 0.55, sway: 0.6,
    }));
    root.add(createEmitter({
      name: 'blowing_leaves', seed: 9, count: 60, min: [-50, 0, -15], max: [0, 25, 15], vel: [9, -0.6, 0], velJitter: [3, 1, 2],
      life: [5, 9], size: [0.3, 0.5], colors: ['#7ccf4a', '#a6dd5f', '#f2c84b'], shape: 'square', spin: true, sway: 2,
    }));
    lights.finalize();

    return {
      root,
      update(t, dt) {
        lights.update(t);
        sailPivot.rotation.z = -t * 0.8;
        falls.forEach((f) => f.update(dt));
        root.position.y = Math.sin(t * 0.45) * 0.3;
      },
    };
  },
};
