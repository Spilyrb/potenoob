// Reusable props in the studs style (trees, clouds, lanterns, flags, waterfalls...)
import { VOXEL } from './grid.mjs';
import { V } from './stage.mjs';
import { hash3, mulberry32 } from '../../src/engine/rng.js';

/**
 * Flat-topped fighting platform: clean rectangular top (good ledges), body that
 * steps inward going down, a few hanging pillars. Used for the main stage.
 */
export function stagePlatform(g, o) {
  const { x0, x1, z0, z1, y } = o;
  const depth = o.depth ?? 7, seed = o.seed ?? 1;
  for (let d = 0; d <= depth; d++) {
    const insL = d === 0 ? 0 : Math.floor(d * (o.taperL ?? 0.9) + hash3(d, 1, 0, seed) * 1.2);
    const insR = d === 0 ? 0 : Math.floor(d * (o.taperR ?? 0.9) + hash3(d, 2, 0, seed) * 1.2);
    const insZ = d === 0 ? 0 : Math.floor(d * (o.taperZ ?? 0.35));
    for (let x = x0 + insL; x <= x1 - insR; x++) for (let z = z0 + insZ; z <= z1 - insZ; z++) {
      let c = o.body ?? 'dirt';
      if (d === 0) c = o.top ?? 'grass';
      else if (d === 1 && (o.top ?? 'grass') === 'grass') c = 'grassSide';
      else if (o.stripe && d === o.stripe) c = o.stripeColor ?? 'dirtDark';
      g.set(x, y - d, z, c);
    }
  }
  // hanging pillars under the body
  const r = mulberry32(seed);
  for (let i = 0; i < (o.pillars ?? 7); i++) {
    const x = Math.round(x0 + 3 + r() * (x1 - x0 - 6)), z = Math.round(z0 + 1 + r() * (z1 - z0 - 2));
    let yy = y - 1; while (g.get(x, yy, z)) yy--;
    const len = 1 + Math.floor(r() * 3);
    for (let k = 0; k < len; k++) g.set(x, yy - k, z, o.body ?? 'dirt');
  }
}

/** Reference-style tree: chunky trunk, canopy built from overlapping cuboids. */
export function cubeTree(g, x, y, z, o = {}) {
  const h = o.h ?? 4, big = o.big ?? false;
  const trunk = o.trunk ?? 'trunk', leaves = o.leaves ?? 'leaves';
  for (let i = 0; i < h; i++) {
    g.set(x, y + i, z, trunk);
    if (big) { g.set(x + 1, y + i, z, trunk); g.set(x, y + i, z + 1, trunk); g.set(x + 1, y + i, z + 1, trunk); }
  }
  const r = mulberry32((x * 31 + z * 17 + y) | 0);
  const s = big ? 1 : 0;
  const top = y + h;
  const blobs = o.blobs ?? (big ? 7 : 4);
  for (let i = 0; i < blobs; i++) {
    const bx = x + Math.round((r() - 0.5) * (3 + s * 3)), bz = z + Math.round((r() - 0.5) * (3 + s * 3));
    const by = top - 1 + Math.round(r() * (2 + s * 2));
    const w = 1 + Math.floor(r() * 2), d = 1 + Math.floor(r() * 2), hh = 1 + Math.floor(r() * (1 + s));
    g.box(bx - w, by, bz - d, bx + w, by + hh, bz + d, i % 3 === 2 && o.leaves2 ? o.leaves2 : leaves, { ifEmpty: true });
  }
}

/** Stacked pine (image 1 of the reference). */
export function pineTree(g, x, y, z, h = 6) {
  g.box(x, y, z, x, y + 1, z, 'trunk');
  let w = 2;
  for (let yy = y + 2; yy < y + h; yy += 2) {
    g.box(x - w, yy, z - w, x + w, yy, z + w, 'leaves', { ifEmpty: true });
    g.box(x - Math.max(0, w - 1), yy + 1, z - Math.max(0, w - 1), x + Math.max(0, w - 1), yy + 1, z + Math.max(0, w - 1), 'leavesDark', { ifEmpty: true });
    w = Math.max(0, w - 1);
  }
  g.set(x, y + h, z, 'leaves');
}

/** Small studs-sized details (mushroom, posts...) are explicit parts in studs. */
export function mushroom(g, x, y, z) {
  const [px, , pz] = V(x, y, z);
  const base = y * VOXEL; // standing on top surface of voxel layer y-1
  g.extras.push({ c: 'white', pos: [px, base + 0.75, pz], size: [0.8, 1.5, 0.8] });
  g.extras.push({ c: 'mushroom', pos: [px, base + 1.9, pz], size: [2.2, 0.9, 2.2] });
  g.extras.push({ c: 'white', pos: [px + 0.5, base + 2.4, pz + 0.3], size: [0.5, 0.2, 0.5] });
}

export function lanternPost(g, x, y, z, o = {}) {
  const [px, , pz] = V(x, y, z);
  const base = y * VOXEL;
  const h = o.h ?? 6;
  g.extras.push({ c: o.post ?? 'woodDark', pos: [px, base + h / 2, pz], size: [1, h, 1] });
  g.extras.push({ c: 'woodDark', pos: [px, base + h + 0.25, pz], size: [2.4, 0.5, 2.4] });
  g.extras.push({ c: 'lantern', name: 'Lantern', pos: [px, base + h + 1.5, pz], size: [1.8, 2, 1.8] });
  g.extras.push({ c: 'woodDark', pos: [px, base + h + 2.75, pz], size: [2.4, 0.5, 2.4] });
}

export function stoneLantern(g, x, y, z) {
  const [px, , pz] = V(x, y, z);
  const b = y * VOXEL;
  g.extras.push({ c: 'stone', pos: [px, b + 0.5, pz], size: [3, 1, 3] });
  g.extras.push({ c: 'stone', pos: [px, b + 2.5, pz], size: [1.2, 3, 1.2] });
  g.extras.push({ c: 'stone', pos: [px, b + 4.25, pz], size: [2.6, 0.5, 2.6] });
  g.extras.push({ c: 'lantern', name: 'Lantern', pos: [px, b + 5.5, pz], size: [1.8, 2, 1.8] });
  g.extras.push({ c: 'stoneDark', pos: [px, b + 6.9, pz], size: [3.4, 0.8, 3.4] });
  g.extras.push({ c: 'stoneDark', pos: [px, b + 7.6, pz], size: [1, 0.6, 1] });
}

export function crystalCluster(g, x, y, z, big = false) {
  g.grid.box(x, y, z, x, y + (big ? 2 : 1), z, 'crystal');
  const [px, , pz] = V(x, y, z);
  const b = y * VOXEL;
  const r = mulberry32(x * 7 + z * 13 + y);
  for (let i = 0; i < (big ? 5 : 3); i++) {
    const h = 2 + r() * (big ? 6 : 4), a = r() * Math.PI * 2;
    g.extras.push({ c: 'crystal', name: 'Crystal', pos: [px + Math.cos(a) * 2.6, b + h / 2, pz + Math.sin(a) * 2.6], size: [1.2, h, 1.2] });
  }
}

/** Blocky cumulus: a few stacked cuboids with a flat bottom. */
export function cloud(g, cx, cy, cz, w, seed, color = 'cloud') {
  const r = mulberry32(seed);
  // flat base + rounded puffs on top, 5 voxels deep so it reads as a cloud from any angle
  g.box(cx - w, cy, cz - 2, cx + w, cy + 1, cz + 2, color);
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const bx = cx + Math.round((r() - 0.5) * w * 1.3), bw = 1 + Math.floor(r() * (w * 0.55));
    const bh = 1 + Math.floor(r() * 3);
    g.box(bx - bw, cy + 2, cz - 1, bx + bw, cy + 1 + bh, cz + 1, color);
    if (bw > 1) g.box(bx - bw + 1, cy + 2 + bh, cz - 1, bx + bw - 1, cy + 2 + bh, cz + 1, color);
  }
}

/**
 * Waving cloth (flag / banner / sail) on a 2-stud grid. pixels(x,y) -> palette key or null.
 * Flag: pinned at x=0 (pole), extends +x. Banner/Sail: pinned at the top, hangs -y.
 */
export function clothGroup(stage, kind, name, topLeft, w, h, pixels, o = {}) {
  const unit = o.unit ?? 2;
  const g = stage.group('FX', `${kind}_${name}`, { unit, origin: topLeft, pivot: topLeft, merge: kind === 'Flag' ? 'y' : 'x', depth: o.depth ?? 0.6, castShadow: true });
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    const c = pixels(x, y);
    if (c) g.grid.set(x, -y, 0, c);
  }
  // pos = origin + (x*unit, -y*unit - unit/2): shift by half a cell so the top edge sits at the pivot
  g.origin = [topLeft[0] + unit / 2, topLeft[1], topLeft[2]];
  return g;
}

/** Animated voxel waterfall: horizontal layers that the client script scrolls downward. */
export function waterfall(stage, name, top, width, height, o = {}) {
  const unit = 2;
  const g = stage.group('FX', `Waterfall_${name}`, { unit, origin: [top[0], top[1], top[2]], pivot: top, merge: 'xz', castShadow: false });
  const half = Math.floor(width / unit / 2);
  const layers = Math.round(height / unit);
  const r = mulberry32(name.length * 97);
  for (let i = 0; i < layers; i++) {
    const foam = r() < 0.18;
    for (let x = -half; x <= half; x++) g.grid.set(x, -i, 0, foam ? 'waterFoam' : 'waterFall');
  }
  if (o.axis === 'z') { // rotate the sheet so it spans z instead of x
    const pts = [...g.grid.entries()];
    g.grid.v.clear();
    for (const [x, y, z, c] of pts) g.grid.set(z, y, x, c);
  }
  g.depth = null;
  // spray / mist at the bottom
  stage.marker('FX', 'Emit_Mist', [top[0], top[1] - height + 2, top[2]], [width + 4, 4, width + 4]);
  stage.marker('FX', 'Emit_Splash', [top[0], top[1] - 1, top[2]], [width, 2, 2]);
  return g;
}

/** Distant floating island with a tree, as its own bobbing model. */
export function bgIsland(stage, name, x, y, z, r, o = {}) {
  const g = stage.group('FX', `Bob_${name}`, { pivot: V(x, y, z), castShadow: false });
  for (let xx = -r; xx <= r; xx++) for (let zz = -r; zz <= r; zz++) {
    if (Math.abs(xx) + Math.abs(zz) > r * 1.5) continue;
    const t = 1 - Math.max(Math.abs(xx), Math.abs(zz)) / (r + 1);
    const d = 1 + Math.round(r * 1.2 * t + hash3(xx, 1, zz, r) * 1.5);
    for (let k = 0; k <= d; k++) g.grid.set(x + xx, y - k, z + zz, k === 0 ? (o.top ?? 'grass') : k === 1 ? 'grassSide' : 'dirt');
  }
  if (o.tree !== false) {
    if (o.pine) pineTree(g.grid, x, y + 1, z, 5);
    else cubeTree(g.grid, x, y + 1, z, { h: 2 + (r > 2 ? 1 : 0), leaves: o.leaves ?? 'leaves', leaves2: o.leaves2 });
  }
  return g;
}

export function cloudsAround(stage, seed, o = {}) {
  const r = mulberry32(seed);
  const color = o.color ?? 'cloud';
  for (let i = 0; i < (o.count ?? 10); i++) {
    const g = stage.group('FX', `Cloud_${i}`, { castShadow: false });
    const below = i < (o.below ?? 4);
    const x = Math.round((r() - 0.5) * 120), z = below ? Math.round(-6 - r() * 20) : Math.round(-22 - r() * 28);
    const y = below ? Math.round(-16 - r() * 8) : Math.round(2 + r() * 16);
    cloud(g.grid, x, y, z, 3 + Math.floor(r() * 5), seed * 100 + i, color);
    g.pivot = V(x, y, z);
  }
}
