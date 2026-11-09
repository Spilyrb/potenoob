// Voxel grid used to author the Roblox stages (1 voxel = VOXEL studs).
// Same idea as the browser engine, but every voxel stores a palette key and the
// grid is converted into as few Roblox Parts as possible with a 3D greedy merge.
import { hash3, fbm2 } from '../../src/engine/rng.js';

export const VOXEL = 4; // studs per voxel -> each block face shows 4x4 Roblox studs

const k = (x, y, z) => `${x},${y},${z}`;

export class Grid {
  constructor() { this.v = new Map(); }
  set(x, y, z, c) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (!c) this.v.delete(k(x, y, z)); else this.v.set(k(x, y, z), c);
  }
  get(x, y, z) { return this.v.get(k(Math.round(x), Math.round(y), Math.round(z))); }
  setIfEmpty(x, y, z, c) { if (!this.get(x, y, z)) this.set(x, y, z, c); }
  del(x, y, z) { this.set(x, y, z, null); }
  get size() { return this.v.size; }
  *entries() { for (const [key, c] of this.v) { const [x, y, z] = key.split(',').map(Number); yield [x, y, z, c]; } }

  box(x0, y0, z0, x1, y1, z1, c, o = {}) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
          o.ifEmpty ? this.setIfEmpty(x, y, z, c) : this.set(x, y, z, c);
  }
  line(x0, y0, z0, x1, y1, z1, c, o = {}) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t].map(Math.round);
      o.ifEmpty ? this.setIfEmpty(...p, c) : this.set(...p, c);
    }
  }
  sphere(cx, cy, cz, r, c, o = {}) {
    const ry = o.ry ?? r, rz = o.rz ?? r;
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let z = Math.floor(cz - rz); z <= cz + rz; z++) {
          const d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          const n = o.noise ? (hash3(x, y, z, o.seed || 1) - 0.5) * o.noise : 0;
          if (d <= 1 + n) o.ifEmpty ? this.setIfEmpty(x, y, z, c) : this.set(x, y, z, c);
        }
  }
  // replace the topmost voxel of each column (within a region) if its key is in `from`
  topCover(x0, x1, z0, z1, from, to, minY = -999) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (let y = 80; y >= minY; y--) {
        const c = this.get(x, y, z);
        if (!c) continue;
        if (from.includes(c)) this.set(x, y, z, to);
        break;
      }
    }
  }
}

/**
 * Blocky floating island in the "studs" style: flat grass top, coral dirt body,
 * stepped inverted-cone underside with a few hanging pillars.
 */
export function island(g, o) {
  const { cx, cz, rx, rz, y } = o;
  const depth = o.depth ?? Math.max(rx, rz);
  const seed = o.seed ?? 1;
  const heights = new Map();
  for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
    const dx = (x - cx) / (rx + 0.5), dz = (z - cz) / (rz + 0.5);
    const shape = o.square ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.sqrt(dx * dx + dz * dz);
    const r = shape + (fbm2(x * 0.3, z * 0.3, seed) - 0.5) * (o.rough ?? 0.25);
    if (r > 1) continue;
    const t = Math.max(0, 1 - r);
    let d = Math.round(1 + depth * Math.pow(t, 0.7) * (0.75 + 0.5 * hash3(x, 3, z, seed)));
    if (hash3(x, 7, z, seed) < (o.pillars ?? 0.08)) d += 1 + Math.floor(hash3(x, 8, z, seed) * 3);
    for (let yy = y - d; yy <= y; yy++) {
      const fromTop = y - yy;
      let c;
      if (fromTop === 0) c = o.top ?? 'grass';
      else if (fromTop === 1 && (o.top ?? 'grass') === 'grass') c = 'grassSide';
      else c = o.body ?? 'dirt';
      g.set(x, yy, z, c);
    }
    heights.set(`${x},${z}`, y);
  }
  return { heights, has: (x, z) => heights.has(`${x},${z}`) };
}

/**
 * 3D greedy merge: groups same-key voxels into boxes.
 * axes: which axes may be merged ('xyz' default). Waterfall stripes use 'xz', flags 'y'.
 */
export function greedy(grid, axes = 'xyz') {
  const left = new Map(grid.v);
  const boxes = [];
  const keys = [...left.keys()].map((s) => s.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const has = (x, y, z, c) => left.get(k(x, y, z)) === c;
  for (const [x, y, z] of keys) {
    const c = left.get(k(x, y, z));
    if (!c) continue;
    let x1 = x, z1 = z, y1 = y;
    if (axes.includes('x')) while (has(x1 + 1, y, z, c)) x1++;
    if (axes.includes('z')) {
      outer: while (true) {
        for (let xx = x; xx <= x1; xx++) if (!has(xx, y, z1 + 1, c)) break outer;
        z1++;
      }
    }
    if (axes.includes('y')) {
      outer2: while (true) {
        for (let xx = x; xx <= x1; xx++) for (let zz = z; zz <= z1; zz++) if (!has(xx, y1 + 1, zz, c)) break outer2;
        y1++;
      }
    }
    for (let xx = x; xx <= x1; xx++) for (let yy = y; yy <= y1; yy++) for (let zz = z; zz <= z1; zz++) left.delete(k(xx, yy, zz));
    boxes.push({ c, min: [x, y, z], max: [x1, y1, z1] });
  }
  return boxes;
}
