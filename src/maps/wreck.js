// RELITTO CELESTE — a broken flying ship adrift at sunset: plank hull with
// jagged splintered keel, tattered billowing sail, lantern gallows, a swinging
// platform on ropes, bobbing debris and warm embers.
import * as THREE from 'three';
import { VoxelModel } from '../engine/VoxelModel.js';
import { BLOCK } from '../engine/blocks.js';
import { hash3, mulberry32 } from '../engine/rng.js';
import { floatingIsland, LightRig, cloth, EMBLEMS } from './common.js';
import { createEmitter } from '../vfx/particles.js';

// half-width of the hull at position x (bow on the left, square-ish stern on the right)
function hullHalfWidth(x) {
  const L0 = -30, L1 = 27;
  const t = (x - L0) / (L1 - L0);
  if (t < 0 || t > 1) return -1;
  const bow = Math.sin(Math.min(1, t / 0.42) * Math.PI / 2);
  const stern = t > 0.9 ? 1 - (t - 0.9) * 2.5 : 1;
  return 9 * bow * stern;
}

export default {
  id: 'wreck',
  title: 'Relitto Celeste',
  icon: 'wheel',
  camera: { pos: [6, 22, 92], target: [0, 5, 0] },
  palette: {
    skyTop: '#3b2f8a', skyHorizon: '#ff9a7a', skyBottom: '#e79bc4', skyCurve: 0.26, sunGlow: 0.5,
    skySunDir: [0.05, 0.1, -1], sunDir: [-0.55, 0.45, 0.7], sunColor: '#ffd29a', sunLight: '#ffc58f', sunIntensity: 2.3,
    hemiSky: '#c9a4ff', hemiGround: '#7a4a5a', hemiIntensity: 0.95,
    fog: '#d99ab8', fogNear: 150, fogFar: 520,
    cloudColor: '#ffd3e2', cloudShade: '#8f6bb5', cloudEmissive: '#ff9ec2', cloudGlow: 0.4, cloudAmount: 0.28,
    bloom: 0.6, exposure: 1.0,
    bg: { seed: 37, top: BLOCK.GRASS },
  },
  build(ctx) {
    const { atlas, mats } = ctx;
    const rnd = mulberry32(5150);
    const root = new THREE.Group();
    const m = new VoxelModel();
    const lights = new LightRig(root, 7);

    // --- hull -----------------------------------------------------------------------
    for (let x = -30; x <= 27; x++) {
      const hw = hullHalfWidth(x);
      if (hw < 0.5) continue;
      const depth = Math.round(4 + hw * 0.75);
      for (let y = -depth; y <= 0; y++) {
        const k = (-y) / depth;
        const w = hw * (1 - k * k * 0.75);
        for (let z = -Math.round(w); z <= Math.round(w); z++) {
          const shell = Math.abs(z) >= Math.round(w) - 0 || y === -depth || y === 0;
          if (!shell && y > -depth + 1) { m.set(x, y, z, 0); continue; }
          let id = y === 0 ? (hash3(x, 0, z, 3) < 0.5 ? BLOCK.PLANKS : BLOCK.PLANKS_LIGHT) : BLOCK.SHIP;
          if (y !== 0 && (y === -2 || y === -1) && Math.abs(z) >= Math.round(w)) id = BLOCK.PLANKS_DARK; // wale stripe
          m.set(x, y, z, id);
        }
      }
      // splintered keel: ragged plank stalactites
      const spikes = 1 + Math.floor(hash3(x, 9, 0, 1) * 6);
      for (let i = 0; i < spikes; i++) {
        const z = Math.round((hash3(x, i, 4, 2) - 0.5) * hw);
        const len = 1 + Math.floor(hash3(x, i, 5, 3) * 5);
        for (let k = 1; k <= len; k++) m.set(x, -depth - k, z, hash3(x, k, z, 6) < 0.6 ? BLOCK.SHIP : BLOCK.PLANKS_DARK);
      }
      // gunwale / railing
      for (const s of [-1, 1]) {
        const z = s * Math.round(hw);
        if (hash3(x, 1, s, 8) < 0.12) continue; // broken bits
        m.set(x, 1, z, BLOCK.SHIP);
        if (x % 3 === 0) { m.set(x, 2, z, BLOCK.POST); m.set(x, 3, z, BLOCK.PLANK_SLAB); }
      }
    }
    // holes punched in the side
    for (const [hx, hy, hz] of [[-12, -3, 8], [10, -4, 9], [3, -6, -8]]) m.sphere(hx, hy, hz, 1.7, 0, { noise: 0.5 });

    // forecastle (bow, raised) and sterncastle
    for (let x = -30; x <= -19; x++) {
      const hw = Math.round(hullHalfWidth(x)) - 1;
      if (hw < 1) continue;
      m.box(x, 1, -hw, x, 2, hw, BLOCK.SHIP);
      m.box(x, 3, -hw, x, 3, hw, BLOCK.PLANKS);
      if (x % 2 === 0) { m.set(x, 4, -hw, BLOCK.POST); m.set(x, 4, hw, BLOCK.POST); }
    }
    m.box(17, 1, -7, 26, 4, 7, BLOCK.SHIP);
    m.box(17, 5, -7, 26, 5, 7, BLOCK.PLANKS);
    m.box(18, 1, -5, 18, 3, 5, BLOCK.PLANKS_DARK);
    m.box(18, 1, -1, 18, 3, 1, BLOCK.BLACK); // cabin door
    for (let z = -7; z <= 7; z += 2) { m.set(26, 6, z, BLOCK.POST); m.set(17, 6, z, BLOCK.POST); }
    m.box(17, 7, -7, 26, 7, -7, BLOCK.PLANK_SLAB); m.box(17, 7, 7, 26, 7, 7, BLOCK.PLANK_SLAB);
    // stern windows glowing
    for (const z of [-4, 0, 4]) { m.set(27, 2, z, BLOCK.LANTERN); }
    lights.add(28, 2.5, 0, '#ffb060', 18, 14);
    // ship's wheel on the sterncastle
    m.box(20, 6, 0, 20, 7, 0, BLOCK.POST);
    m.box(20, 8, -1, 20, 8, 1, BLOCK.PLANKS_DARK); m.box(20, 7, -1, 20, 9, -1, BLOCK.PLANKS_DARK);

    // bowsprit
    m.line(-29, 4, 0, -40, 9, 0, BLOCK.BEAM);
    m.line(-29, 3, 0, -38, 8, 0, BLOCK.BEAM);

    // deck grates + crates + barrels
    m.box(-9, 0, -2, -5, 0, 1, BLOCK.GRATE);
    m.box(3, 0, -2, 7, 0, 1, BLOCK.GRATE);
    m.box(-15, 1, 4, -14, 2, 5, BLOCK.PLANKS_DARK);
    m.box(10, 1, -6, 11, 1, -5, BLOCK.PLANKS_DARK);
    m.set(12, 1, 5, BLOCK.LOG); m.set(12, 2, 5, BLOCK.LOG); m.set(13, 1, 5, BLOCK.LOG);
    // broken plank pile / debris on deck
    m.line(-2, 1, 5, 3, 2, 6, BLOCK.PLANKS_DARK);

    // --- main mast + yard -----------------------------------------------------------------
    m.box(-2, 1, 0, -2, 30, 0, BLOCK.LOG);
    m.box(-14, 27, 0, 11, 27, 0, BLOCK.BEAM);
    m.box(-12, 13, 0, 9, 13, 0, BLOCK.BEAM);
    m.box(-4, 22, -1, 0, 22, 1, BLOCK.PLANKS_DARK); // crow's nest base
    m.box(-4, 23, -2, 0, 23, 2, BLOCK.PLANK_SLAB, { hollow: 'walls' });
    // broken foremast stub
    m.box(-21, 4, 0, -21, 10, 0, BLOCK.LOG);
    m.line(-21, 10, 0, -26, 13, 3, BLOCK.LOG);
    // rigging ropes from mast to gunwales
    m.line(-2, 26, 0, -14, 2, -8, BLOCK.ROPE, { ifEmpty: true });
    m.line(-2, 26, 0, 10, 2, -8, BLOCK.ROPE, { ifEmpty: true });

    // --- lantern gallows (left) -------------------------------------------------------------------
    m.box(-17, 1, 6, -17, 12, 6, BLOCK.BEAM);
    m.box(-21, 12, 6, -13, 12, 6, BLOCK.BEAM);
    for (const lx of [-20, -14]) {
      m.box(lx, 10, 6, lx, 11, 6, BLOCK.IRON_POST);
      m.set(lx, 9, 6, BLOCK.LANTERN);
      lights.add(lx, 9, 6.6, '#ffb15c', 18, 14);
    }
    // lanterns hanging off the hull side
    for (const lx of [-8, 9]) { m.set(lx, -3, 9, BLOCK.LANTERN); lights.add(lx, -3, 10, '#ffa04a', 14, 12); }
    // frame for the swinging platform (stern, right)
    m.box(23, 6, -4, 23, 22, -4, BLOCK.BEAM);
    m.box(23, 22, -4, 36, 22, -4, BLOCK.BEAM);
    m.line(23, 17, -4, 28, 22, -4, BLOCK.POST);

    // --- debris rock under the wreck ----------------------------------------------------------------
    floatingIsland(m, {
      cx: -4, cz: 0, rx: 15, rz: 8, y: -11, depth: 14, seed: 91,
      top: BLOCK.GRASS, sub: BLOCK.DIRT, rock: [BLOCK.ROCK_PURPLE, BLOCK.STONE, BLOCK.ROCK_PURPLE], vineChance: 0.3,
    });

    root.add(m.build(atlas, mats, [0, 0, 0], 'wreck_hull'));

    // --- sail (tattered, billowing) -------------------------------------------------------------------
    const sail = cloth({
      name: 'sail', mode: 'sail', w: 22, h: 13.5, pos: [-13.5, 26.4, 0.8], px: [44, 27], segX: 24, segY: 16, seed: 12,
      color: '#d4423f', emblem: EMBLEMS.egg, tatter: 1.0, amp: 2.2, speed: 1.6,
    });
    root.add(sail);
    // pennant on the mast top
    root.add(cloth({ name: 'pennant', mode: 'flag', w: 5, h: 1.4, pos: [-1.8, 30.8, 0], px: [20, 5], color: '#b8333a', pennant: true, amp: 0.6, speed: 7 }));

    // --- swinging platform on ropes ------------------------------------------------------------------
    const swing = new VoxelModel();
    for (const rx of [-3, 3]) for (let y = -1; y >= -9; y--) swing.set(rx, y, 0, BLOCK.ROPE);
    swing.box(-4, -10, -2, 4, -10, 2, BLOCK.PLANK_SLAB_LIGHT);
    swing.box(-4, -11, -2, 4, -11, -2, BLOCK.BEAM);
    swing.box(-4, -11, 2, 4, -11, 2, BLOCK.BEAM);
    const swingPivot = new THREE.Group();
    swingPivot.name = 'swing_platform_pivot';
    swingPivot.position.set(31, 21.5, -4);
    swingPivot.add(swing.build(atlas, mats, [0, 0, 0], 'swing_platform'));
    root.add(swingPivot);

    // --- floating plank platforms + debris, all bobbing --------------------------------------------------
    const bobbers = [];
    const addFloat = (vm, x, y, z, name, amp = 0.6) => {
      const g = vm.build(atlas, mats, [0, 0, 0], name);
      g.position.set(x, y, z);
      g.userData = { baseY: y, phase: rnd() * 6, amp, rot: (rnd() - 0.5) * 0.08 };
      root.add(g);
      bobbers.push(g);
    };
    const plat = (w, d, mast) => {
      const v = new VoxelModel();
      v.box(-w, 0, -d, w, 0, d, BLOCK.PLANK_SLAB);
      v.box(-w, -1, -d, w, -1, -d, BLOCK.BEAM); v.box(-w, -1, d, w, -1, d, BLOCK.BEAM);
      for (let i = 0; i < w; i++) if (rnd() < 0.5) v.set(-w + Math.floor(rnd() * 2 * w), -2, 0, BLOCK.PLANKS_DARK);
      if (mast) { v.box(0, 1, 0, 0, 4, 0, BLOCK.POST); v.set(0, 5, 0, BLOCK.LANTERN); }
      return v;
    };
    addFloat(plat(4, 2, false), -7, 16, 12, 'float_platform_a');
    addFloat(plat(3, 2, true), 7, 9, 15, 'float_platform_b');
    addFloat(plat(5, 2, false), -26, 13, 14, 'float_platform_c');
    lights.add(7, 14.5, 15, '#ffb15c', 0);
    for (let i = 0; i < 7; i++) {
      const v = new VoxelModel();
      const s = rnd() < 0.5;
      if (s) v.box(0, 0, 0, 1, 1, 1, BLOCK.PLANKS_DARK);
      else v.line(0, 0, 0, 3, 1, 0, BLOCK.SHIP);
      const a = rnd() * Math.PI * 2, r = 30 + rnd() * 18;
      addFloat(v, Math.cos(a) * r, -8 + rnd() * 26, Math.sin(a) * r * 0.6, 'debris_' + i, 0.9);
    }

    // --- VFX ------------------------------------------------------------------------------------------
    root.add(createEmitter({
      name: 'embers', seed: 7, count: 140, min: [-34, -6, -14], max: [30, 22, 16], vel: [0.4, 0.5, 0], velJitter: [0.4, 0.4, 0.4],
      life: [4, 8], size: [0.18, 0.35], colors: ['#ffcf7a', '#ff9a5c', '#fff1c4'], shape: 'glow', additive: true, twinkle: 0.7, sway: 1.2, intensity: 1.5,
    }));
    root.add(createEmitter({
      name: 'falling_splinters', seed: 3, count: 40, min: [-26, -14, -6], max: [22, -8, 6], vel: [0, -2.5, 0], velJitter: [0.4, 0.8, 0.4],
      life: [3, 5], size: [0.2, 0.35], colors: ['#7a4a2a', '#9a5f34'], shape: 'square', spin: true, sway: 0.6,
    }));
    lights.finalize();

    return {
      root,
      update(t, dt) {
        lights.update(t);
        swingPivot.rotation.x = Math.sin(t * 1.1) * 0.22;
        swingPivot.rotation.z = Math.sin(t * 0.7) * 0.05;
        for (const b of bobbers) {
          b.position.y = b.userData.baseY + Math.sin(t * 0.8 + b.userData.phase) * b.userData.amp;
          b.rotation.z = Math.sin(t * 0.5 + b.userData.phase) * b.userData.rot * 2;
        }
        // the whole wreck drifts and rolls a little
        root.position.y = Math.sin(t * 0.4) * 0.6;
        root.rotation.z = Math.sin(t * 0.33) * 0.012;
        root.rotation.x = Math.sin(t * 0.27) * 0.008;
      },
    };
  },
};
