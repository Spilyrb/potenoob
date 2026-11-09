// MINIERE SOSPESE — floating rock island with a mine entrance carved in a
// mossy mound, wooden scaffolds, a crane with a swinging crate, glowing blue
// crystals, minecart rails on a trestle, plank bridges to satellite islands.
import * as THREE from 'three';
import { VoxelModel } from '../engine/VoxelModel.js';
import { BLOCK } from '../engine/blocks.js';
import { hash3, mulberry32 } from '../engine/rng.js';
import { floatingIsland, satellite, scatter, deck, stairs, LightRig, tree } from './common.js';
import { createEmitter } from '../vfx/particles.js';

export function grassifyTops(m, x0, x1, z0, z1, from, to, minY = -999) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    for (let y = 60; y >= minY; y--) {
      const id = m.get(x, y, z);
      if (!id) continue;
      if (from.includes(id)) m.set(x, y, z, to);
      break;
    }
  }
}

function crystalCluster(m, x, y, z, rnd, big = false) {
  // a solid core with thin shards of different heights around it
  const core = big ? 3 : 2;
  for (let k = 0; k < core; k++) m.set(x, y + k, z, BLOCK.CRYSTAL);
  m.set(x, y + core, z, BLOCK.CRYSTAL_SHARD);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    if (rnd() < 0.35) continue;
    const h = 1 + Math.floor(rnd() * (big ? 3 : 2));
    for (let k = 0; k < h; k++) m.setIfEmpty(x + dx, y + k, z + dz, BLOCK.CRYSTAL_SHARD);
  }
}

function plankBridge(m, x0, z0, x1, z1, y, sag = 1.5) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  const along = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t), z = Math.round(z0 + (z1 - z0) * t);
    const yy = Math.round(y - Math.sin(t * Math.PI) * sag);
    for (let w = -1; w <= 1; w++) {
      const bx = along === 'x' ? x : x + w, bz = along === 'x' ? z + w : z;
      m.set(bx, yy, bz, (i % 3 === 0 && w !== 0) ? BLOCK.PLANK_SLAB : BLOCK.PLANK_SLAB_LIGHT);
    }
    if (i % 4 === 0) {
      const sx = along === 'x' ? 0 : 2, sz = along === 'x' ? 2 : 0;
      m.set(x + sx, yy + 1, z + sz, BLOCK.POST); m.set(x - sx, yy + 1, z - sz, BLOCK.POST);
    }
  }
}

export default {
  id: 'mines',
  title: 'Miniere Sospese',
  icon: 'pickaxe',
  camera: { pos: [4, 24, 80], target: [0, 3, 0] },
  palette: {
    skyTop: '#2f86e8', skyHorizon: '#a9dcff', skyBottom: '#d8f0ff',
    sunDir: [0.5, 0.75, 0.45], sunColor: '#fff3d6', sunIntensity: 2.6,
    hemiSky: '#bfe3ff', hemiGround: '#6b7c55', hemiIntensity: 1.0,
    fog: '#bfe5ff', fogNear: 160, fogFar: 560,
    cloudColor: '#ffffff', cloudShade: '#bcd6f0', cloudEmissive: '#dbeeff', cloudAmount: 0.6,
    bloom: 0.55, exposure: 1.05,
    bg: { seed: 11 },
  },
  build(ctx) {
    const { atlas, mats } = ctx;
    const rnd = mulberry32(2024);
    const root = new THREE.Group();
    const m = new VoxelModel();

    // --- main island ----------------------------------------------------
    const main = floatingIsland(m, {
      cx: 0, cz: 0, rx: 27, rz: 19, y: 0, depth: 26, seed: 7,
      top: BLOCK.GRASS, sub: BLOCK.STONE_DIRT, subDepth: 1,
      rock: [BLOCK.STONE, BLOCK.GREYSTONE, BLOCK.STONE, BLOCK.STONE_DIRT, BLOCK.DIRT],
      ores: [BLOCK.ORE_CRYSTAL, BLOCK.ORE_COAL, BLOCK.ORE_GOLD], oreChance: 0.04, rough: 0.35,
    });

    // --- the mound (mine hill) ----------------------------------------------
    m.sphere(0, 0, -12, 15, BLOCK.STONE, { ry: 21, noise: 0.25, seed: 4 });
    m.sphere(-10, 0, -9, 8, BLOCK.GREYSTONE, { ry: 13, noise: 0.3, seed: 5 });
    m.sphere(10, 0, -8, 8, BLOCK.STONE, { ry: 12, noise: 0.3, seed: 6 });
    // stone variety
    m.forEach((x, y, z, id) => {
      if (y > 0 && id === BLOCK.STONE && hash3(x, y, z, 2) < 0.25) m.set(x, y, z, BLOCK.GREYSTONE);
      if (y > 0 && id === BLOCK.STONE && hash3(x, y, z, 3) < 0.04) m.set(x, y, z, BLOCK.ORE_CRYSTAL);
    });
    grassifyTops(m, -26, 26, -26, 4, [BLOCK.STONE, BLOCK.GREYSTONE, BLOCK.ORE_CRYSTAL], BLOCK.ROCK_MOSS, 2);
    // bushes on top of the mound
    for (let i = 0; i < 9; i++) {
      const x = Math.round((rnd() - 0.5) * 24), z = Math.round(-12 + (rnd() - 0.5) * 14);
      let y = 25; while (y > 0 && !m.get(x, y, z)) y--;
      if (y > 6) m.sphere(x, y + 1, z, 1.6 + rnd() * 1.5, BLOCK.LEAVES, { ry: 1.2, noise: 0.4, ifEmpty: true, seed: i });
    }

    // --- plaza in front ------------------------------------------------------
    for (let x = -12; x <= 12; x++) for (let z = 0; z <= 13; z++) {
      if (main.top(x, z) === null) continue;
      if (m.get(x, 1, z)) continue;
      const edge = Math.abs(x) > 10 || z > 11;
      m.set(x, 0, z, edge ? BLOCK.PLANKS_DARK : (hash3(x, 0, z, 9) < 0.5 ? BLOCK.PLANKS : BLOCK.PLANKS_LIGHT));
    }

    // --- mine entrance -------------------------------------------------------
    // raised threshold + stairs
    m.box(-6, 1, 0, 6, 3, 4, BLOCK.COBBLE);
    stairs(m, -3, 1, 7, 3, [0, -1], 7, BLOCK.COBBLE);
    // carve tunnel
    m.box(-5, 4, -14, 5, 12, 3, BLOCK.MINE_DARK);
    m.box(-4, 4, -13, 4, 11, 9, 0);
    m.box(-4, 4, -14, 4, 11, -14, BLOCK.MINE_DARK);
    m.box(-5, 3, -14, 5, 3, 4, BLOCK.PLANKS_DARK);
    // a few rails disappearing into the dark
    for (let z = -13; z <= 4; z++) m.set(0, 4, z, BLOCK.RAIL);
    // timber frame (two portals)
    for (const zf of [4, -4]) {
      m.box(-5, 4, zf, -5, 12, zf, BLOCK.BEAM);
      m.box(5, 4, zf, 5, 12, zf, BLOCK.BEAM);
      m.box(-6, 12, zf, 6, 12, zf, BLOCK.BEAM);
    }
    m.box(-7, 13, 4, 7, 13, 4, BLOCK.PLANKS_DARK);
    m.box(-4, 11, 4, 4, 11, 4, BLOCK.PLANK_SLAB);
    // lanterns on the portal
    const lights = new LightRig(root, 7);
    for (const lx of [-6, 6]) {
      m.set(lx, 10, 5, BLOCK.LANTERN);
      m.set(lx, 11, 5, BLOCK.IRON_POST);
      lights.add(lx, 10, 5.6, '#ffb54d', 22, 16);
    }

    // --- scaffold decks left / right of the mine --------------------------
    deck(m, -22, -1, -11, 5, 6, { legH: 6, rim: BLOCK.BEAM });
    deck(m, 11, -1, 22, 5, 6, { legH: 6, rim: BLOCK.BEAM });
    // little railing posts
    for (let x = -22; x <= -11; x += 3) m.set(x, 7, 5, BLOCK.POST);
    for (let x = 11; x <= 22; x += 3) m.set(x, 7, 5, BLOCK.POST);
    // crates & barrels on decks
    m.box(-20, 7, 0, -19, 8, 1, BLOCK.PLANKS_DARK);
    m.box(17, 7, 1, 18, 7, 2, BLOCK.PLANKS_DARK);
    m.set(14, 7, 0, BLOCK.LOG);
    // lanterns on deck posts
    m.set(-11, 8, 5, BLOCK.POST); m.set(-11, 9, 5, BLOCK.LANTERN); lights.add(-11, 9, 5.5);
    m.set(11, 8, 5, BLOCK.POST); m.set(11, 9, 5, BLOCK.LANTERN); lights.add(11, 9, 5.5);

    // lower plank platforms at the plaza edge (front-left / front-right)
    deck(m, -24, 6, -15, 12, 3, { legH: 3, floor: BLOCK.PLANKS_LIGHT, rim: BLOCK.BEAM });
    deck(m, 15, 6, 24, 12, 3, { legH: 3, floor: BLOCK.PLANKS_LIGHT, rim: BLOCK.BEAM });

    // --- crane (upper-left) ----------------------------------------------------
    const craneX = -17, craneZ = -7;
    let craneBase = 0; while (m.get(craneX, craneBase + 1, craneZ)) craneBase++;
    m.box(craneX, craneBase + 1, craneZ, craneX, 22, craneZ, BLOCK.BEAM);
    m.box(craneX + 1, craneBase + 1, craneZ, craneX + 1, 18, craneZ, BLOCK.POST);
    m.box(craneX - 12, 22, craneZ, craneX + 3, 22, craneZ, BLOCK.BEAM);
    m.line(craneX, 17, craneZ, craneX - 6, 21, craneZ, BLOCK.BEAM);
    m.line(craneX, 17, craneZ, craneX + 3, 21, craneZ, BLOCK.POST);
    m.box(craneX + 2, 20, craneZ, craneX + 3, 21, craneZ, BLOCK.PLANKS_DARK); // counterweight
    m.set(craneX - 12, 21, craneZ, BLOCK.IRON);

    // --- crystals ---------------------------------------------------------------
    const crystalSpots = [];
    const spots = [[-9, 1, 9], [9, 1, 10], [-16, 1, 1], [20, 1, -3], [-3, 1, 13], [13, 1, 13], [7, 14, -4], [-12, 9, -5]];
    for (const [x, y0, z] of spots) {
      let y = y0; while (m.get(x, y, z) && y < 40) y++;
      crystalCluster(m, x, y, z, rnd, rnd() < 0.5);
      crystalSpots.push([x, y + 1, z]);
    }
    // crystals hanging under the island
    for (let i = 0; i < 6; i++) {
      const x = Math.round((rnd() - 0.5) * 30), z = Math.round((rnd() - 0.5) * 20);
      let y = -2; while (m.get(x, y, z) && y > -40) y--;
      if (y <= -38) continue;
      for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) m.set(x, y - k, z, k ? BLOCK.CRYSTAL_SHARD : BLOCK.CRYSTAL);
      crystalSpots.push([x, y - 1, z]);
    }

    // --- satellites + bridges ------------------------------------------------------
    satellite(m, -42, -3, 6, 7, 31, { top: BLOCK.GRASS, rock: [BLOCK.STONE, BLOCK.STONE_DIRT, BLOCK.DIRT] });
    tree(m, -44, -2, 4, { h: 5, r: 3 });
    plankBridge(m, -26, 6, -36, 6, 0, 1.2);
    satellite(m, 41, 4, -2, 7, 41, { top: BLOCK.GRASS });
    m.sphere(42, 5, -3, 4, BLOCK.STONE, { ry: 5, noise: 0.3 });
    grassifyTops(m, 36, 48, -9, 5, [BLOCK.STONE], BLOCK.ROCK_MOSS, 5);
    plankBridge(m, 26, 4, 35, 1, 0, 1.4);
    // trestle with rails leaving to the lower-left island
    satellite(m, -36, -14, 34, 6, 51, { top: BLOCK.GRASS });
    const r0 = [-14, 0, 13], r1 = [-33, -13, 31];
    const steps = 26;
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(r0[0] + (r1[0] - r0[0]) * t), y = Math.round(r0[1] + (r1[1] - r0[1]) * t), z = Math.round(r0[2] + (r1[2] - r0[2]) * t);
      for (const w of [-1, 0, 1]) m.set(x + w, y, z, BLOCK.PLANKS_DARK);
      m.set(x, y + 1, z, BLOCK.RAIL);
      if (i % 5 === 2) { m.box(x - 1, y - 7, z, x - 1, y - 1, z, BLOCK.POST); m.box(x + 1, y - 7, z, x + 1, y - 1, z, BLOCK.POST); }
      prev = [x, y, z];
    }
    // plaza rails to the trestle
    for (let x = -14; x <= -4; x++) m.set(x, 1, 13, BLOCK.RAIL);

    // --- decoration ---------------------------------------------------------------
    scatter(m, main, { chance: 0.16, blocks: [BLOCK.TALL_GRASS, BLOCK.TALL_GRASS, BLOCK.FLOWER_W, BLOCK.FLOWER_Y, BLOCK.MUSHROOM], seed: 3 });
    // lanterns hanging under the island rim
    for (const [x, z] of [[-14, 14], [16, 13], [0, 18]]) {
      let y = -1; while (m.get(x, y, z) && y > -10) y--;
      const top = y + 1;
      m.set(x, top - 1, z, BLOCK.IRON_POST);
      m.set(x, top - 2, z, BLOCK.LANTERN);
      lights.add(x, top - 2, z + 0.6, '#ffb54d', 14, 12);
    }

    const island = m.build(atlas, mats, [0, 0, 0], 'mines_island');
    root.add(island);

    // --- animated: crane hook with crate (swing) ---------------------------------
    const hook = new VoxelModel();
    for (let y = -1; y >= -9; y--) hook.set(0, y, 0, BLOCK.ROPE);
    hook.box(-1, -12, -1, 1, -10, 1, BLOCK.PLANKS_DARK);
    hook.box(-1, -10, -1, 1, -10, 1, BLOCK.PLANKS);
    const hookMesh = hook.build(atlas, mats, [0, 0, 0], 'crane_crate');
    const hookPivot = new THREE.Group();
    hookPivot.name = 'crane_crate_pivot';
    hookPivot.position.set(craneX - 12, 21, craneZ);
    hookPivot.add(hookMesh);
    root.add(hookPivot);

    // --- animated: minecart on the trestle -------------------------------------------
    const cart = new VoxelModel();
    cart.box(-1, 0, -1, 1, 1, 1, BLOCK.IRON, { hollow: 'walls' });
    cart.box(-1, 0, -1, 1, 0, 1, BLOCK.IRON);
    cart.set(0, 1, 0, BLOCK.ORE_CRYSTAL);
    cart.set(0, 2, 0, BLOCK.CRYSTAL);
    const cartMesh = cart.build(atlas, mats, [0, -0.6, 0], 'minecart');
    cartMesh.scale.setScalar(0.7);
    const cartPivot = new THREE.Group();
    cartPivot.name = 'minecart_pivot';
    cartPivot.add(cartMesh);
    root.add(cartPivot);
    const cartPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, 1.5, 13), new THREE.Vector3(-14, 1.5, 13),
      new THREE.Vector3(r1[0] * 0.5 + r0[0] * 0.5, -5.0, (r0[2] + r1[2]) / 2), new THREE.Vector3(r1[0], r1[1] + 1.5, r1[2]),
    ]);

    // --- VFX ------------------------------------------------------------------------------
    for (const [x, y, z] of crystalSpots) {
      root.add(createEmitter({
        name: 'crystal_sparkles', seed: x * 7 + z, count: 14, min: [x - 2, y - 1, z - 2], max: [x + 2, y + 3, z + 2],
        vel: [0, 0.6, 0], velJitter: [0.3, 0.3, 0.3], life: [1.2, 2.5], size: [0.25, 0.5],
        colors: ['#8ff3ff', '#ffffff', '#4fd8ff'], shape: 'glow', additive: true, twinkle: 0.8, intensity: 2.0,
      }));
    }
    for (const [x, y, z] of crystalSpots) lights.add(x, y, z, '#52d6ff', 0, 0); // halos only (no extra lights)
    // dust drifting out of the mine
    root.add(createEmitter({
      name: 'mine_dust', seed: 5, count: 60, min: [-4, 4, -8], max: [4, 11, 4], vel: [0, 0.2, 1.2], velJitter: [0.3, 0.2, 0.4],
      life: [4, 7], size: [0.2, 0.4], colors: ['#ffe2a8', '#d9c7a3'], shape: 'square', opacity: 0.7, sway: 0.5,
    }));
    // fireflies / pollen over the grass
    root.add(createEmitter({
      name: 'pollen', seed: 8, count: 120, min: [-26, 1, -10], max: [26, 10, 18], vel: [0.2, 0.1, 0], velJitter: [0.3, 0.2, 0.3],
      life: [5, 9], size: [0.15, 0.3], colors: ['#fff6b0', '#ffffff'], shape: 'glow', additive: true, twinkle: 0.6, sway: 1.5,
    }));
    lights.finalize();

    // satellites gently bob – they're part of the main mesh, so bob the whole root instead
    return {
      root,
      update(t, dt) {
        lights.update(t);
        hookPivot.rotation.z = Math.sin(t * 0.9) * 0.16;
        hookPivot.rotation.x = Math.sin(t * 0.63 + 1) * 0.07;
        const u = (Math.sin(t * 0.25) * 0.5 + 0.5);
        const p = cartPath.getPointAt(u), tan = cartPath.getTangentAt(u);
        cartPivot.position.copy(p);
        cartPivot.rotation.y = Math.atan2(tan.x, tan.z);
        cartPivot.rotation.x = -Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1)) * 0.0;
        root.position.y = Math.sin(t * 0.5) * 0.35;
      },
    };
  },
};
