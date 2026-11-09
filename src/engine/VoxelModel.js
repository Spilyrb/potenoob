// Sparse voxel model + mesher.
// - hidden-face culling between solid cubes
// - per-vertex ambient occlusion (classic 3-neighbour voxel AO)
// - per-voxel brightness jitter for the hand-built voxel look
// - extra shapes: slab, plate, post, cross (X-shaped plants)
// Output: one THREE.Group with up to 3 meshes (opaque / cutout / emissive).
import * as THREE from 'three';
import { blockById } from './blocks.js';
import { hash3 } from './rng.js';

const OFF = 1024;
const key = (x, y, z) => ((x + OFF) * 2048 + (y + OFF)) * 2048 + (z + OFF);

const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], tex: 'side' },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], tex: 'side' },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], tex: 'top' },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], tex: 'bottom' },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], tex: 'side' },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], tex: 'side' },
];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];

const SHAPE_BOX = {
  slab: [0, 0, 0, 1, 0.5, 1],
  plate: [0, 0, 0, 1, 0.07, 1],
  post: [0.34, 0, 0.34, 0.66, 1, 0.66],
};

class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
}

export class VoxelModel {
  constructor() {
    this.vox = new Map();
    this.tints = new Map();
  }
  set(x, y, z, id, tint) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    const k = key(x, y, z);
    if (!id) { this.vox.delete(k); this.tints.delete(k); return; }
    this.vox.set(k, id);
    if (tint) this.tints.set(k, tint); else this.tints.delete(k);
  }
  setIfEmpty(x, y, z, id, tint) { if (!this.get(x, y, z)) this.set(x, y, z, id, tint); }
  get(x, y, z) { return this.vox.get(key(Math.round(x), Math.round(y), Math.round(z))) || 0; }
  has(x, y, z) { return this.vox.has(key(Math.round(x), Math.round(y), Math.round(z))); }
  del(x, y, z) { this.set(x, y, z, 0); }
  get size() { return this.vox.size; }

  forEach(fn) {
    for (const [k, id] of this.vox) {
      const z = (k % 2048) - OFF;
      const y = (Math.floor(k / 2048) % 2048) - OFF;
      const x = Math.floor(k / (2048 * 2048)) - OFF;
      fn(x, y, z, id);
    }
  }

  // --- building helpers -------------------------------------------------
  box(x0, y0, z0, x1, y1, z1, id, opts = {}) {
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    const [az, bz] = [Math.min(z0, z1), Math.max(z0, z1)];
    for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) {
      if (opts.hollow && x > ax && x < bx && z > az && z < bz && (opts.hollow === 'walls' || (y > ay && y < by))) continue;
      if (opts.ifEmpty) this.setIfEmpty(x, y, z, id, opts.tint); else this.set(x, y, z, id, opts.tint);
    }
  }
  line(x0, y0, z0, x1, y1, z1, id, opts = {}) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), z = Math.round(z0 + (z1 - z0) * t);
      if (opts.ifEmpty) this.setIfEmpty(x, y, z, id, opts.tint); else this.set(x, y, z, id, opts.tint);
    }
  }
  sphere(cx, cy, cz, r, id, opts = {}) {
    const ry = opts.ry ?? r;
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let z = Math.floor(cz - r); z <= cz + r; z++) {
          const d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / r) ** 2;
          const noise = opts.noise ? (hash3(x, y, z, opts.seed || 3) - 0.5) * opts.noise : 0;
          if (d <= 1 + noise) {
            if (opts.ifEmpty) this.setIfEmpty(x, y, z, id, opts.tint); else this.set(x, y, z, id, opts.tint);
          }
        }
  }
  cylinder(cx, y0, cz, r, h, id, opts = {}) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > r + 0.01) continue;
        if (opts.hollow && d < r - 1) continue;
        for (let y = y0; y < y0 + h; y++) {
          if (opts.ifEmpty) this.setIfEmpty(x, y, z, id, opts.tint); else this.set(x, y, z, id, opts.tint);
        }
      }
  }
  merge(other, dx = 0, dy = 0, dz = 0) {
    other.forEach((x, y, z, id) => this.set(x + dx, y + dy, z + dz, id, other.tints.get(key(x, y, z))));
  }

  // --- meshing ----------------------------------------------------------
  isOccluder(x, y, z, self) {
    const id = this.get(x, y, z);
    if (!id) return false;
    const b = blockById(id);
    if (b.shape !== 'cube') return false;
    if (b.pass === 'cutout') return id === self.id;
    if (self.pass === 'emissive' && b.pass !== 'emissive') return true;
    return true;
  }
  isSolidAO(x, y, z) {
    const id = this.get(x, y, z);
    if (!id) return false;
    const b = blockById(id);
    return b.shape === 'cube' && b.pass !== 'emissive';
  }

  /**
   * @param {object} atlas    result of buildAtlas()
   * @param {object} mats     result of createVoxelMaterials()
   * @param {number[]} pivot  model space point that becomes the group origin
   */
  build(atlas, mats, pivot = [0, 0, 0], name = 'voxels') {
    const bufs = { opaque: new Buf(), cutout: new Buf(), emissive: new Buf() };
    const [px, py, pz] = pivot;

    this.forEach((x, y, z, id) => {
      const b = blockById(id);
      const buf = bufs[b.pass];
      const tint = this.tints.get(key(x, y, z)) || b.tint;
      const jit = 1 + (hash3(x, y, z, 7) - 0.5) * 2 * b.jitter;
      const col = [tint[0] * jit, tint[1] * jit, tint[2] * jit];
      const ox = x - px - 0.5, oy = y - py - 0.5, oz = z - pz - 0.5; // voxel min corner

      if (b.shape === 'cross') { this.emitCross(buf, atlas.uv[b.side], ox, oy, oz, col, x, y, z); return; }
      if (b.shape !== 'cube') { this.emitBox(buf, b, atlas, SHAPE_BOX[b.shape], ox, oy, oz, col, x, y, z); return; }

      for (const f of FACES) {
        const [nx, ny, nz] = f.n;
        if (this.isOccluder(x + nx, y + ny, z + nz, b)) continue;
        const uv = atlas.uv[b[f.tex]];
        const base = buf.count;
        const ao = [];
        for (const [du, dv] of CORNERS) {
          const ux = f.u[0] * du, uy = f.u[1] * du, uz = f.u[2] * du;
          const vx = f.v[0] * dv, vy = f.v[1] * dv, vz = f.v[2] * dv;
          const s1 = this.isSolidAO(x + nx + ux, y + ny + uy, z + nz + uz) ? 1 : 0;
          const s2 = this.isSolidAO(x + nx + vx, y + ny + vy, z + nz + vz) ? 1 : 0;
          const c = this.isSolidAO(x + nx + ux + vx, y + ny + uy + vy, z + nz + uz + vz) ? 1 : 0;
          const a = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
          ao.push(a);
          buf.p.push(ox + 0.5 + (nx + ux + vx) * 0.5, oy + 0.5 + (ny + uy + vy) * 0.5, oz + 0.5 + (nz + uz + vz) * 0.5);
          buf.n.push(nx, ny, nz);
          buf.uv.push(du < 0 ? uv[0] : uv[2], dv > 0 ? uv[1] : uv[3]);
          const k = b.pass === 'emissive' ? 1 : AO_CURVE[a];
          buf.c.push(col[0] * k, col[1] * k, col[2] * k);
        }
        if (ao[0] + ao[2] < ao[1] + ao[3]) buf.i.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        else buf.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    });

    const group = new THREE.Group();
    group.name = name;
    for (const pass of ['opaque', 'cutout', 'emissive']) {
      const buf = bufs[pass];
      if (!buf.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(buf.c, 3));
      g.setIndex(buf.count > 65535 ? new THREE.Uint32BufferAttribute(buf.i, 1) : new THREE.Uint16BufferAttribute(buf.i, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[pass]);
      m.name = `${name}_${pass}`;
      m.castShadow = pass !== 'emissive';
      m.receiveShadow = true;
      group.add(m);
    }
    return group;
  }

  emitBox(buf, b, atlas, box, ox, oy, oz, col, x, y, z) {
    const [x0, y0, z0, x1, y1, z1] = box;
    const lo = [x0, y0, z0], hi = [x1, y1, z1];
    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      // cull only when the box face lies on the voxel boundary and the neighbour is solid
      const axis = nx ? 0 : ny ? 1 : 2;
      const onEdge = f.n[axis] > 0 ? hi[axis] >= 1 : lo[axis] <= 0;
      if (onEdge && this.isOccluder(x + nx, y + ny, z + nz, b)) continue;
      const uv = atlas.uv[b[f.tex]];
      const base = buf.count;
      for (const [du, dv] of CORNERS) {
        const p = [0, 0, 0];
        for (let a = 0; a < 3; a++) {
          const s = f.n[a] + f.u[a] * du + f.v[a] * dv; // -1..1 per axis
          p[a] = s > 0 ? hi[a] : lo[a];
        }
        buf.p.push(ox + p[0], oy + p[1], oz + p[2]);
        buf.n.push(nx, ny, nz);
        // crop UVs to the box extent along the face axes
        const uAxis = f.u[0] ? 0 : f.u[1] ? 1 : 2, vAxis = f.v[0] ? 0 : f.v[1] ? 1 : 2;
        const uSign = f.u[uAxis], vSign = f.v[vAxis];
        let tu = uSign > 0 ? p[uAxis] : 1 - p[uAxis];
        let tv = vSign > 0 ? p[vAxis] : 1 - p[vAxis];
        buf.uv.push(uv[0] + (uv[2] - uv[0]) * tu, uv[3] - (uv[3] - uv[1]) * tv);
        const shadeK = dv < 0 && f.v[1] ? 0.8 : 1;
        buf.c.push(col[0] * shadeK, col[1] * shadeK, col[2] * shadeK);
      }
      buf.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  emitCross(buf, uv, ox, oy, oz, col, x, y, z) {
    const r = 0.5, h = 1;
    const j = (hash3(x, y, z, 11) - 0.5) * 0.3;
    const quads = [
      [[0.5 - r + j, 0, 0.5 - r], [0.5 + r + j, 0, 0.5 + r]],
      [[0.5 - r + j, 0, 0.5 + r], [0.5 + r + j, 0, 0.5 - r]],
    ];
    for (const [a, c] of quads) {
      const base = buf.count;
      const pts = [[a[0], 0, a[2]], [c[0], 0, c[2]], [c[0], h, c[2]], [a[0], h, a[2]]];
      const uvs = [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]];
      pts.forEach((p, i) => {
        buf.p.push(ox + p[0], oy + p[1], oz + p[2]);
        buf.n.push(0, 1, 0);
        buf.uv.push(uvs[i][0], uvs[i][1]);
        const k = i < 2 ? 0.7 : 1.05;
        buf.c.push(col[0] * k, col[1] * k, col[2] * k);
      });
      buf.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}
