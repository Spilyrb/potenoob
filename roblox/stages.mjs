// The four themed fighting stages (Brawlhalla-like layout) in the Roblox "studs" style.
// Layout rules shared by every stage (voxel units, 1 voxel = 4 studs):
//   main platform  x -12..12, z -3..3, top surface at Y = 0  -> 100 x 28 studs
//   soft platforms y = 6 (24 studs up) left/right, y = 11 (44 studs up) centre
//   fighters move on the plane Z = 0; scenery lives behind (z <= -4) and below
import { Stage, V } from './lib/stage.mjs';
import { VOXEL } from './lib/grid.mjs';
import { stagePlatform, cubeTree, pineTree, mushroom, lanternPost, stoneLantern, crystalCluster, clothGroup, waterfall, bgIsland, cloudsAround } from './lib/props.mjs';
import { hash3, mulberry32 } from '../src/engine/rng.js';

const MAIN = { x0: -12, x1: 12, z0: -3, z1: 3, y: 0 };

function common(stage, o = {}) {
  // spawn points on the main platform (+ one per soft platform side)
  [-8, -3, 3, 8].forEach((x, i) => stage.marker('Stage/Spawns', `Spawn_${i + 1}`, [x * VOXEL, 3, 0], [4, 1, 4]));
  stage.marker('Stage', 'CameraFocus', [0, 16, 0], [2, 2, 2]);
  // blast-zone guide (invisible, for the game script)
  stage.marker('Stage', 'BlastZone', [0, 20, 0], [260, 200, 40]);
  cloudsAround(stage, o.cloudSeed ?? 3, { color: o.cloudColor, count: o.clouds ?? 11 });
  const r = mulberry32(o.bgSeed ?? 9);
  const spots = [[-34, 6, -16, 3], [30, 10, -18, 3], [-22, 16, -28, 2], [27, -6, -22, 2], [-44, -4, -24, 3], [44, 14, -30, 2], [0, 22, -34, 2]];
  spots.forEach(([x, y, z, rr], i) => bgIsland(stage, `Island${i}`, x, y, z, rr, { pine: r() < 0.35, leaves: o.bgLeaves?.[i % o.bgLeaves.length], leaves2: o.bgLeaves2 }));
}

function softPlatform(stage, name, x0, x1, y, style) {
  const g = stage.group('Stage/SoftPlatforms', name, { collide: true });
  const deco = stage.group('Background', `${name}_Under`, {});
  if (style === 'wood') {
    g.grid.box(x0, y, -1, x1, y, 1, 'plank');
    deco.grid.box(x0, y - 1, -1, x0, y - 1, 1, 'woodDark'); deco.grid.box(x1, y - 1, -1, x1, y - 1, 1, 'woodDark');
    deco.grid.box(x0 + 1, y - 1, 0, x1 - 1, y - 1, 0, 'woodDark');
  } else if (style === 'woodRed') {
    g.grid.box(x0, y, -1, x1, y, 1, 'plank');
    deco.grid.box(x0, y - 1, -1, x1, y - 1, 1, 'red');
  } else if (style === 'stone') {
    g.grid.box(x0, y, -1, x1, y, 1, 'castle');
    deco.grid.box(x0 + 1, y - 1, -1, x1 - 1, y - 1, 1, 'castleDark');
    deco.grid.box(x0, y - 1, -1, x0, y - 1, 1, 'red'); deco.grid.box(x1, y - 1, -1, x1, y - 1, 1, 'red');
  } else { // floating grass islet
    g.grid.box(x0, y, -1, x1, y, 1, 'grass');
    deco.grid.box(x0, y - 1, -1, x1, y - 1, 1, 'grassSide');
    deco.grid.box(x0 + 1, y - 2, -1, x1 - 1, y - 2, 1, style === 'grassStone' ? 'stone' : 'dirt');
    deco.grid.box(x0 + 2, y - 3, 0, x1 - 2, y - 3, 0, style === 'grassStone' ? 'stoneDark' : 'dirt');
    deco.grid.set(Math.round((x0 + x1) / 2), y - 4, 0, style === 'grassStone' ? 'stoneDark' : 'dirt');
  }
  return { g, deco };
}

// ---------------------------------------------------------------------------
export function mines() {
  const S = new Stage('mines', 'Miniere Sospese', { lighting: 'day' });
  const main = S.group('Stage', 'MainPlatform', { collide: true });
  stagePlatform(main.grid, { ...MAIN, depth: 8, seed: 4, body: 'dirt', stripe: 4, stripeColor: 'stone' });
  // plank plaza in the middle of the stage
  main.grid.box(-5, 0, -3, 5, 0, 3, 'plank');
  main.grid.box(-5, 0, -3, -5, 0, 3, 'woodDark'); main.grid.box(5, 0, -3, 5, 0, 3, 'woodDark');
  // ore veins in the body
  for (const [x, y, z, c] of main.grid.entries()) if (y < -3 && (z === 3 || z === -3) && hash3(x, y, z, 5) < 0.08) main.grid.set(x, y, z, 'crystal');

  const bg = S.group('Background', 'MineHill', {});
  const h = bg.grid;
  h.sphere(0, 0, -10, 11, 'stone', { ry: 13, rz: 6, noise: 0.15, seed: 3 });
  h.sphere(-9, -1, -9, 6, 'stone', { ry: 8, rz: 4, noise: 0.2, seed: 4 });
  h.sphere(10, -1, -9, 6, 'stoneDark', { ry: 9, rz: 4, noise: 0.2, seed: 5 });
  for (const [x, y, z] of h.entries()) if (y < 0) h.del(x, y, z); // keep the hill above the deck
  h.box(-20, -1, -16, 20, -1, -4, 'grassSide');
  h.box(-19, -2, -15, 19, -4, -5, 'dirt');
  h.box(-16, -5, -13, 16, -6, -7, 'dirt');
  h.topCover(-22, 22, -18, -3, ['stone', 'stoneDark'], 'grass', 1);
  // mine entrance
  h.box(-2, 0, -12, 2, 5, -3, null);
  h.box(-3, 0, -12, 3, 6, -12, 'mineDark');
  h.box(-2, 0, -11, 2, 5, -11, 'mineDark');
  h.box(-3, 0, -4, -3, 6, -4, 'wood'); h.box(3, 0, -4, 3, 6, -4, 'wood');
  h.box(-4, 6, -4, 4, 6, -4, 'woodDark');
  h.box(-3, 0, -8, -3, 6, -8, 'wood'); h.box(3, 0, -8, 3, 6, -8, 'wood'); h.box(-3, 6, -8, 3, 6, -8, 'woodDark');
  // rails into the mine
  for (let z = -11; z <= -4; z++) { bg.extras.push({ c: 'iron', pos: [-1.2, 0.25, z * VOXEL], size: [0.5, 0.5, 4] }, { c: 'iron', pos: [1.2, 0.25, z * VOXEL], size: [0.5, 0.5, 4] }, { c: 'woodDark', pos: [0, 0.15, z * VOXEL], size: [4, 0.3, 1] }); }
  lanternPost(bg, -4, 0, -3, { h: 5 }); lanternPost(bg, 4, 0, -3, { h: 5 });
  // crystals on the hill and stage corners
  for (const [x, z, big] of [[-8, -6, true], [7, -6, false], [-12, -8, false], [11, -10, true], [-2, -14, false]]) {
    let y = 14; while (y > 0 && !h.get(x, y - 1, z)) y--;
    crystalCluster(bg, x, y, z, big);
  }
  const deck = S.group('Background', 'StageDecor', {});
  crystalCluster(deck, -11, 1, -3, false);
  crystalCluster(deck, 11, 1, -3, true);
  mushroom(deck, -8, 1, -3); mushroom(deck, 9, 1, -2);
  cubeTree(h, -16, 0, -8, { h: 4 }); cubeTree(h, 16, 0, -7, { h: 3 });

  // crane on the left with a swinging crate
  const crane = S.group('Background', 'Crane', {});
  crane.grid.box(-18, -1, -6, -18, 14, -6, 'wood');
  crane.grid.box(-18, 14, -6, -9, 14, -6, 'woodDark');
  crane.grid.line(-18, 10, -6, -14, 14, -6, 'wood');
  crane.grid.box(-20, 13, -6, -19, 14, -6, 'woodDark');
  const crate = S.group('FX', 'Swing_Crate', { pivot: [-9 * VOXEL, 14 * VOXEL - 4, -6 * VOXEL] });
  crate.extras.push({ c: 'woodDark', name: 'Rope', pos: [-9 * VOXEL, 14 * VOXEL - 4 - 12, -6 * VOXEL], size: [0.5, 24, 0.5] });
  crate.grid.box(-9, 7, -6, -9, 7, -6, 'plank');
  crate.extras.push({ c: 'woodDark', pos: [-9 * VOXEL, 7 * VOXEL - 2, -6 * VOXEL], size: [4.4, 0.6, 4.4] });

  // soft platforms: wooden scaffolds + a floating crag at the top
  softPlatform(S, 'Soft_Left', -10, -5, 6, 'wood');
  softPlatform(S, 'Soft_Right', 5, 10, 6, 'wood');
  softPlatform(S, 'Soft_Top', -3, 3, 11, 'grassStone');
  // scaffold legs behind the soft platforms (no collision)
  const legs = S.group('Background', 'ScaffoldLegs', {});
  for (const x of [-10, -5, 5, 10]) legs.extras.push({ c: 'woodDark', pos: [x * VOXEL, 12, -1 * VOXEL - 1], size: [1, 24, 1] });

  S.marker('FX', 'Emit_Sparkles', V(0, 6, -8), [70, 24, 20]);
  S.marker('FX', 'Drift_Dust', V(0, 3, -3), [16, 12, 8]);
  common(S, { cloudSeed: 3, bgSeed: 9 });
  return S;
}

// ---------------------------------------------------------------------------
function squareTower(g, cx, cz, half, y0, h, o = {}) {
  for (let y = y0; y < y0 + h; y++) for (let x = cx - half; x <= cx + half; x++) for (let z = cz - half; z <= cz + half; z++) {
    const corner = (x === cx - half || x === cx + half) && (z === cz - half || z === cz + half);
    g.set(x, y, z, corner || (y - y0) % 5 === 4 ? 'castleDark' : 'castle');
  }
  const top = y0 + h;
  for (let x = cx - half - 1; x <= cx + half + 1; x++) for (let z = cz - half - 1; z <= cz + half + 1; z++) {
    if (x > cx - half - 1 && x < cx + half + 1 && z > cz - half - 1 && z < cz + half + 1) continue;
    g.set(x, top, z, 'castleDark');
    if ((x + z) % 2 === 0) g.set(x, top + 1, z, 'castle');
  }
  if (o.roof) for (let i = 0; i <= half + 1; i++) g.box(cx - half - 1 + i, top + 1 + i, cz - half - 1 + i, cx + half + 1 - i, top + 1 + i, cz + half + 1 - i, 'roof');
  for (let y = y0 + 3; y < top - 1; y += 4) g.set(cx, y, cz + half, 'black');
  return top;
}

const crest = (w, h) => (x, y) => {
  // red banner, gold trim, gold diamond crest, pointed bottom
  const mid = (w - 1) / 2;
  if (y >= h - 2 && Math.abs(x - mid) > (h - 1 - y) * 1.5 + 0.5) return null;
  if (x === 0 || x === w - 1 || y === 0) return 'clothTrim';
  const cy = Math.round(h * 0.42);
  if (Math.abs(x - mid) + Math.abs(y - cy) <= 1.6) return 'gold';
  return 'cloth';
};
const pennant = (w, h) => (x, y) => {
  const mid = (h - 1) / 2;
  if (x > w - 3 && Math.abs(y - mid) < 0.6) return null; // swallow tail
  if (x === Math.floor(w / 2) && Math.abs(y - mid) < 0.6) return 'gold';
  return 'cloth';
};

function flagOn(stage, name, x, y, z, w = 6, h = 3) {
  // pole (voxel x,z on a tower top at height y) + waving flag
  const pole = stage.group('Background', `Pole_${name}`, {});
  const [px, , pz] = V(x, y, z);
  pole.extras.push({ c: 'iron', pos: [px, y * VOXEL + 7, pz], size: [0.8, 14, 0.8] }, { c: 'gold', pos: [px, y * VOXEL + 14.5, pz], size: [1.4, 1.4, 1.4] });
  clothGroup(stage, 'Flag', name, [px + 0.4, y * VOXEL + 13.5, pz], w, h, pennant(w, h));
}

export function fort() {
  const S = new Stage('fort', 'Forte di Vento', { lighting: 'day' });
  const main = S.group('Stage', 'MainPlatform', { collide: true });
  const g = main.grid;
  // bridge deck + arched body
  const arches = [-6, 6], R = 3.6, spring = -6;
  for (let x = -12; x <= 12; x++) for (let z = -3; z <= 3; z++) for (let y = -14; y <= 0; y++) {
    let carve = false;
    for (const c of arches) { const dx = x - c; if (Math.abs(dx) <= R && (y < spring || dx * dx + (y - spring) ** 2 <= R * R)) carve = true; }
    if (carve) continue;
    if (y < -10 - Math.floor(hash3(x, 0, z, 2) * 4)) continue;
    let c = (y === -1) ? 'castleDark' : 'castle';
    if (y === 0) c = hash3(x, 0, z, 4) < 0.22 ? 'grass' : 'castle';
    if (y < -1 && hash3(x, y, z, 6) < 0.15) c = 'castleDark';
    g.set(x, y, z, c);
  }
  // rock + grass lumps under the piers
  const under = S.group('Background', 'PierRocks', {});
  for (const px of [-11, 0, 11]) {
    under.grid.sphere(px, -14, 0, 3, 'stone', { ry: 4, noise: 0.3, seed: px + 20 });
    under.grid.sphere(px, -17, 0, 1.6, 'stoneDark', { ry: 3, noise: 0.3, seed: px + 21 });
  }
  // back parapet with crenels
  const back = S.group('Background', 'Parapet', {});
  for (let x = -12; x <= 12; x++) { back.grid.set(x, 1, -3, 'castleDark'); if (x % 2 === 0) back.grid.set(x, 2, -3, 'castle'); }

  // keep + towers behind
  const towers = S.group('Background', 'Towers', {});
  const keepTop = squareTower(towers.grid, 0, -10, 3, -3, 19);
  towers.grid.box(-1, 1, -7, 1, 3, -7, 'black');
  const ltTop = squareTower(towers.grid, -13, -9, 2, -6, 17);
  const rtTop = squareTower(towers.grid, 13, -9, 2, -6, 13);
  towers.grid.box(-11, 1, -9, -4, 5, -9, 'castle');
  towers.grid.box(4, 1, -9, 11, 5, -9, 'castle');
  for (let x = -11; x <= 11; x++) if (x % 2 === 0) towers.grid.set(x, 6, -9, 'castleDark');
  // windmill (right, further back)
  const wm = S.group('Background', 'Windmill', {});
  for (let i = 0; i < 9; i++) wm.grid.sphere(22, -2 + i, -12, 2.4 - i * 0.08, i % 3 === 2 ? 'woodDark' : 'plaster', { ry: 0.5 });
  for (let i = 0; i < 4; i++) wm.grid.box(22 - 3 + i, 7 + i, -15 + i, 22 + 3 - i, 7 + i, -9 - i, 'roof');
  wm.grid.set(22, 2, -10, 'black');
  wm.grid.sphere(22, -5, -12, 5, 'stone', { ry: 4, noise: 0.3 });
  wm.grid.topCover(16, 28, -18, -6, ['stone'], 'grass', -6);
  const sails = S.group('FX', 'Spin_Windmill', { pivot: V(22, 5, -9) });
  for (const [dx, dy, sx, sy] of [[1, 0, 0, -1], [0, 1, 1, 0], [-1, 0, 0, 1], [0, -1, -1, 0]]) {
    for (let i = 1; i <= 6; i++) {
      sails.grid.set(22 + dx * i, 5 + dy * i, -9, 'woodDark');
      if (i >= 2) sails.grid.set(22 + dx * i + sx, 5 + dy * i + sy, -9, (i % 2) ? 'plaster' : 'plank');
    }
  }
  sails.grid.set(22, 5, -9, 'iron');

  // ends of the bridge: grassy crags with waterfalls
  const crags = S.group('Background', 'Crags', {});
  for (const sx of [-1, 1]) {
    crags.grid.sphere(sx * 18, -3, -3, 5, 'stone', { ry: 7, rz: 4, noise: 0.3, seed: 40 + sx });
    for (const [x, y, z] of [...crags.grid.entries()]) if (y > -1) crags.grid.del(x, y, z);
    crags.grid.topCover(sx * 18 - 6, sx * 18 + 6, -8, 2, ['stone'], 'grass', -10);
    // stream on top feeding the fall
    for (let z = -3; z <= 1; z++) { let y = 0; while (y > -12 && !crags.grid.get(sx * 18, y, z)) y--; if (y > -12) crags.grid.set(sx * 18, y, z, 'water'); }
  }
  {
    let zl = 1; while (crags.grid.get(-18, -2, zl + 1)) zl++;
    let zr = 1; while (crags.grid.get(18, -2, zr + 1)) zr++;
    waterfall(S, 'Left', [-18 * VOXEL, -3, zl * VOXEL + 2.5], 4, 70);
    waterfall(S, 'Right', [18 * VOXEL, -3, zr * VOXEL + 2.5], 4, 80);
  }

  // banners & flags
  clothGroup(S, 'Banner', 'BridgeLeft', [-11 * VOXEL - 4, -1, 3 * VOXEL + 2.4], 4, 9, crest(4, 9));
  clothGroup(S, 'Banner', 'BridgeRight', [11 * VOXEL - 4, -1, 3 * VOXEL + 2.4], 4, 9, crest(4, 9));
  clothGroup(S, 'Banner', 'Keep', [-5, 14 * VOXEL, -7 * VOXEL + 2.4], 5, 10, crest(5, 10));
  flagOn(S, 'Keep', 0, keepTop + 1, -10, 7, 3);
  flagOn(S, 'TowerL', -13, ltTop + 1, -9);
  flagOn(S, 'TowerR', 13, rtTop + 1, -9);

  softPlatform(S, 'Soft_Left', -10, -5, 6, 'woodRed');
  softPlatform(S, 'Soft_Right', 5, 10, 6, 'woodRed');
  softPlatform(S, 'Soft_Top', -3, 3, 11, 'grass');
  const deco = S.group('Background', 'StageDecor', {});
  lanternPost(deco, -12, 1, -2, { post: 'castleDark' }); lanternPost(deco, 12, 1, -2, { post: 'castleDark' });

  S.marker('FX', 'Drift_Wind', [-40, 20, -8], [20, 50, 30]);
  common(S, { cloudSeed: 5, bgSeed: 11 });
  return S;
}

// ---------------------------------------------------------------------------
export function wreck() {
  const S = new Stage('wreck', 'Relitto Celeste', { lighting: 'sunset' });
  const main = S.group('Stage', 'MainPlatform', { collide: true });
  const g = main.grid;
  // deck + hull (bow on the left)
  for (let d = 0; d <= 8; d++) {
    const insL = d === 0 ? 0 : Math.round(d * 1.3), insR = d === 0 ? 0 : Math.round(d * 0.55), insZ = Math.floor(d * 0.32);
    for (let x = -12 + insL; x <= 12 - insR; x++) for (let z = -3 + insZ; z <= 3 - insZ; z++) {
      let c = d === 0 ? (hash3(x, 0, z, 2) < 0.5 ? 'plank' : 'wood') : 'hull';
      if (d === 2) c = 'woodDark';
      g.set(x, -d, z, c);
    }
  }
  // splintered keel
  const r = mulberry32(55);
  for (let x = -6; x <= 10; x++) { if (r() < 0.55) { let y = -1; while (g.get(x, y, 0)) y--; for (let k = 0; k < 1 + Math.floor(r() * 3); k++) g.set(x, y - k, 0, r() < 0.5 ? 'hull' : 'woodDark'); } }
  // grates on deck
  g.box(-6, 0, -1, -4, 0, 1, 'iron'); g.box(4, 0, -1, 6, 0, 1, 'iron');
  // portholes
  for (const x of [-5, 0, 5]) g.set(x, -3, 3, 'window');

  const ship = S.group('Background', 'Ship', {});
  const s = ship.grid;
  // back railing
  for (let x = -12; x <= 12; x++) { if (x % 2 === 0) s.set(x, 1, -3, 'woodDark'); }
  s.box(-12, 2, -3, 12, 2, -3, 'wood');
  // bowsprit + raised bow (left)
  s.line(-12, 1, -1, -19, 5, -1, 'woodDark');
  s.box(-13, -1, -2, -13, 1, 2, 'hull');
  // stern cabin (right, behind)
  s.box(9, 1, -9, 14, 5, -4, 'hull');
  s.box(8, 6, -10, 15, 6, -3, 'woodDark');
  for (const z of [-8, -6]) s.set(14, 3, z, 'window');
  s.set(9, 3, -6, 'window');
  for (let x = 8; x <= 15; x += 2) { s.set(x, 7, -10, 'woodDark'); s.set(x, 7, -3, 'woodDark'); }
  // mast + yard + crow's nest supports
  s.box(0, 1, -2, 0, 22, -2, 'trunk');
  s.box(-9, 20, -2, 9, 20, -2, 'woodDark');
  // gallows with lanterns (left back)
  s.box(-9, 1, -6, -9, 10, -6, 'woodDark');
  s.box(-12, 10, -6, -6, 10, -6, 'woodDark');
  ship.extras.push({ c: 'iron', pos: [-11 * VOXEL, 10 * VOXEL - 5, -6 * VOXEL], size: [0.4, 6, 0.4] }, { c: 'lantern', name: 'Lantern', pos: [-11 * VOXEL, 10 * VOXEL - 9, -6 * VOXEL], size: [2, 2.4, 2] });
  ship.extras.push({ c: 'iron', pos: [-7 * VOXEL, 10 * VOXEL - 5, -6 * VOXEL], size: [0.4, 6, 0.4] }, { c: 'lantern', name: 'Lantern', pos: [-7 * VOXEL, 10 * VOXEL - 9, -6 * VOXEL], size: [2, 2.4, 2] });
  // debris rock under the hull
  const rock = S.group('Background', 'DebrisRock', {});
  rock.grid.sphere(0, -12, 0, 6, 'stoneDark', { ry: 4, rz: 4, noise: 0.35, seed: 8 });
  rock.grid.sphere(1, -15, 0, 3, 'stone', { ry: 4, rz: 3, noise: 0.35, seed: 9 });
  rock.grid.topCover(-7, 7, -5, 5, ['stoneDark'], 'grass', -14);

  // tattered red sail with a white egg sigil, hanging from the yard
  const W = 46, H = 30;
  clothGroup(S, 'Sail', 'Main', [-W / 2, 20 * VOXEL - 2, -3 * VOXEL - 1], W, H, (x, y) => {
    const tear = hash3(x, 0, 0, 3) * 4 + (x % 7 === 3 ? 2 : 0);
    if (y > H - 1 - tear) return null;
    if (hash3(x, y, 0, 8) < 0.025 && y > 4) return null; // holes
    const cx = (W - 1) / 2, cy = H * 0.42;
    const ex = (x - cx) / 4.5, ey = (y - cy) / 5.5;
    if (ex * ex + ey * ey <= 1) return (Math.abs(x - cx) < 1 && Math.abs(y - cy - 1) < 1) ? 'cloth' : 'sail';
    if (Math.abs(y - cy + 1) < 0.6 && Math.abs(x - cx) > 4 && Math.abs(x - cx) < 9) return 'sail'; // wings
    return 'cloth';
  }, { unit: 1, depth: 0.5 });
  flagOn(S, 'Mast', 0, 22, -2, 7, 3);

  // soft platforms: floating plank rafts + crow's nest at the top
  softPlatform(S, 'Soft_Left', -10, -6, 6, 'wood');
  softPlatform(S, 'Soft_Right', 6, 10, 6, 'wood');
  const nest = softPlatform(S, 'Soft_Top', -3, 3, 12, 'wood');
  nest.deco.grid.box(-3, 13, -1, 3, 13, -1, 'woodDark');
  // swinging platform hanging from a beam (decor, right background)
  const beam = S.group('Background', 'SwingBeam', {});
  beam.grid.box(17, -2, -7, 17, 14, -7, 'woodDark');
  beam.grid.box(17, 14, -7, 26, 14, -7, 'woodDark');
  const sw = S.group('FX', 'Swing_Platform', { pivot: [22 * VOXEL, 14 * VOXEL - 4, -7 * VOXEL] });
  for (const dx of [-6, 6]) sw.extras.push({ c: 'woodDark', name: 'Rope', pos: [22 * VOXEL + dx, 14 * VOXEL - 4 - 12, -7 * VOXEL], size: [0.5, 24, 0.5] });
  sw.grid.box(20, 8, -8, 24, 8, -6, 'plank');
  // floating debris
  for (let i = 0; i < 5; i++) {
    const d = S.group('FX', `Bob_Debris${i}`, {});
    const x = Math.round((r() - 0.5) * 70), y = Math.round(-4 + r() * 22), z = Math.round(-6 - r() * 10);
    if (Math.abs(x) < 16 && y > -2 && y < 14) continue;
    if (r() < 0.5) d.grid.box(x, y, z, x + 1, y, z, 'woodDark'); else d.grid.set(x, y, z, 'hull');
    d.pivot = V(x, y, z);
  }
  S.marker('FX', 'Drift_Embers', [0, 20, -4], [120, 50, 30]);
  common(S, { cloudSeed: 7, bgSeed: 13, cloudColor: 'cloudPink', clouds: 12 });
  return S;
}

// ---------------------------------------------------------------------------
export function zen() {
  const S = new Stage('zen', 'Giardino Zen', { lighting: 'day' });
  const main = S.group('Stage', 'MainPlatform', { collide: true });
  stagePlatform(main.grid, { ...MAIN, depth: 8, seed: 12 });
  // winding cream path across the stage (like the reference)
  for (let x = -12; x <= 12; x++) {
    const zc = Math.round(Math.sin(x * 0.35) * 1.2);
    for (let z = zc - 1; z <= zc; z++) if (z >= -3 && z <= 3) main.grid.set(x, 0, z, 'path');
  }
  // koi pond behind the fighting lane
  for (let x = -7; x <= -1; x++) for (const z of [-3, -2]) main.grid.set(x, 0, z, 'water');

  const bg = S.group('Background', 'Garden', {});
  const h = bg.grid;
  // mossy crag behind the right side, cherry tree on top
  h.sphere(7, 0, -9, 7, 'stone', { ry: 8, rz: 5, noise: 0.2, seed: 21 });
  h.sphere(13, -1, -8, 4, 'stoneDark', { ry: 5, rz: 3, noise: 0.25, seed: 22 });
  for (const [x, y, z] of [...h.entries()]) if (y < 0) h.del(x, y, z);
  h.box(-20, -1, -14, 20, -1, -4, 'grassSide');
  h.box(-20, -2, -13, 20, -4, -5, 'dirt');
  h.topCover(-20, 20, -16, -3, ['stone', 'stoneDark'], 'grass', 0);
  h.box(-20, 0, -14, 20, 0, -4, 'grass', { ifEmpty: true });
  let ty = 12; while (ty > 0 && !h.get(7, ty - 1, -9)) ty--;
  // big cherry tree (pink cuboid canopy)
  cubeTree(h, 7, ty, -9, { h: 6, big: true, trunk: 'trunk', leaves: 'cherry', leaves2: 'cherryDark', blobs: 11 });
  h.line(7, ty + 4, -9, 2, ty + 7, -8, 'trunk');
  h.box(-2, ty + 7, -11, 4, ty + 8, -6, 'cherry', { ifEmpty: true });
  // bamboo grove (left)
  const r = mulberry32(31);
  for (let i = 0; i < 9; i++) {
    const x = -19 + Math.floor(r() * 5), z = -6 - Math.floor(r() * 6), hh = 8 + Math.floor(r() * 7);
    bg.extras.push({ c: 'bamboo', pos: [x * VOXEL, hh * VOXEL / 2, z * VOXEL], size: [1.6, hh * VOXEL, 1.6] });
    for (let k = 0; k < 3; k++) bg.extras.push({ c: k % 2 ? 'leaves' : 'leavesDark', pos: [x * VOXEL + (r() - 0.5) * 4, (hh - k * 1.5) * VOXEL, z * VOXEL + (r() - 0.5) * 3], size: [3 + r() * 2, 1.2, 2 + r() * 2] });
  }
  // torii gate (centre-left, behind)
  const tg = S.group('Background', 'Torii', {});
  const TX = -9, TZ = -11;
  tg.grid.box(TX - 3, 1, TZ, TX - 3, 7, TZ, 'red'); tg.grid.box(TX + 3, 1, TZ, TX + 3, 7, TZ, 'red');
  tg.grid.set(TX - 3, 1, TZ, 'black'); tg.grid.set(TX + 3, 1, TZ, 'black');
  tg.grid.box(TX - 4, 6, TZ, TX + 4, 6, TZ, 'red');
  tg.grid.box(TX - 5, 8, TZ, TX + 5, 8, TZ, 'red');
  tg.grid.box(TX - 6, 9, TZ, TX + 6, 9, TZ, 'black');
  tg.grid.set(TX - 7, 10, TZ, 'black'); tg.grid.set(TX + 7, 10, TZ, 'black');
  tg.grid.set(TX, 7, TZ, 'black');
  // red arched bridge over the pond
  for (let x = -8; x <= 0; x++) {
    const y = Math.round(Math.sin(((x + 8) / 8) * Math.PI) * 1.4);
    tg.grid.set(x, y + 1, -4, 'red');
    if ((x + 8) % 2 === 0) tg.grid.set(x, y + 2, -4, 'red');
  }
  // stone lanterns + mushrooms + fallen petals
  const deco = S.group('Background', 'StageDecor', {});
  stoneLantern(deco, -12, 1, -2); stoneLantern(deco, 12, 1, -2); stoneLantern(deco, -5, 1, -9); stoneLantern(deco, 15, 1, -5);
  mushroom(deco, -10, 1, -3); mushroom(deco, 10, 1, 2); mushroom(deco, 3, 1, -7);
  for (let i = 0; i < 26; i++) {
    const x = 7 + (r() - 0.5) * 30, z = -5 + (r() - 0.5) * 6;
    deco.extras.push({ c: 'cherry', pos: [x * VOXEL, 0.2, z * VOXEL], size: [1.2, 0.4, 1.2] });
  }
  // log pile (reference detail)
  for (const [dx, dy] of [[0, 0], [1.4, 0], [0.7, 1.2]]) deco.extras.push({ c: 'trunk', pos: [-14 * VOXEL + dx, 0.7 + dy, -6 * VOXEL], size: [1.3, 1.3, 4] });

  // waterfalls gushing out of both cliff ends
  let xr = 12; while (!main.grid.get(xr, -2, 1)) xr--;
  let xl = -12; while (!main.grid.get(xl, -3, -1)) xl++;
  main.grid.set(xr, -2, 1, 'water'); main.grid.set(xl, -3, -1, 'water');
  waterfall(S, 'Right', [xr * VOXEL + 2.5, -2 * VOXEL - 2 + 1, 1 * VOXEL], 4, 80, { axis: 'z' });
  waterfall(S, 'Left', [xl * VOXEL - 2.5, -3 * VOXEL - 2 + 1, -1 * VOXEL], 3, 60, { axis: 'z' });

  softPlatform(S, 'Soft_Left', -10, -5, 6, 'woodRed');
  softPlatform(S, 'Soft_Right', 5, 10, 6, 'woodRed');
  softPlatform(S, 'Soft_Top', -3, 3, 11, 'grass');

  S.marker('FX', 'Drift_Petals', [28, 40, -8], [70, 20, 30]);
  S.marker('FX', 'Emit_Sparkles', [-16, 1, -10], [28, 2, 8]);
  common(S, { cloudSeed: 11, bgSeed: 17, bgLeaves: ['cherry', 'leaves', 'leaves'], bgLeaves2: 'cherryDark' });
  return S;
}

export const STAGES = [mines, fort, wreck, zen];
