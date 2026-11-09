// Procedural 16x16 pixel-art textures for materials not covered by the
// downloaded Kenney Voxel Pack (castle bricks, cherry leaves, bamboo, lacquer...).
// Each painter returns a 16x16 canvas; the atlas upscales it with nearest filtering.
import { mulberry32 } from './rng.js';

const N = 16;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade([r, g, b], k) {
  return [Math.max(0, Math.min(255, r * k)), Math.max(0, Math.min(255, g * k)), Math.max(0, Math.min(255, b * k))];
}

class Pix {
  constructor(seed) {
    this.c = document.createElement('canvas');
    this.c.width = this.c.height = N;
    this.ctx = this.c.getContext('2d');
    this.img = this.ctx.createImageData(N, N);
    this.r = mulberry32(seed);
  }
  set(x, y, rgb, a = 255) {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (y * N + x) * 4, d = this.img.data;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a;
  }
  fill(rgb, jitter = 0.08) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) this.set(x, y, shade(rgb, 1 + (this.r() - 0.5) * 2 * jitter));
  }
  done() { this.ctx.putImageData(this.img, 0, 0); return this.c; }
}

// Brick / block masonry. rows of bricks with mortar lines.
function bricks(seed, base, mortar, bw = 8, bh = 4, moss = 0) {
  const p = new Pix(seed);
  const B = hex(base), M = hex(mortar), G = hex('#5d9b3a');
  const tones = [];
  for (let i = 0; i < 16; i++) tones.push(1 + (p.r() - 0.5) * 0.28);
  for (let y = 0; y < N; y++) {
    const row = Math.floor(y / bh);
    const off = (row % 2) * (bw / 2);
    for (let x = 0; x < N; x++) {
      const bx = Math.floor((x + off) / bw);
      const edgeY = y % bh === bh - 1;
      const edgeX = (x + off) % bw === bw - 1;
      if (edgeY || edgeX) { p.set(x, y, shade(M, 1 + (p.r() - 0.5) * 0.1)); continue; }
      let k = tones[(row * 5 + bx * 3) % 16] * (1 + (p.r() - 0.5) * 0.12);
      if ((x + off) % bw === 0 || y % bh === 0) k *= 1.12; // bevel highlight
      p.set(x, y, shade(B, k));
    }
  }
  if (moss > 0) {
    for (let x = 0; x < N; x++) {
      const len = Math.floor(p.r() * moss * 6) + (p.r() < moss ? 2 : 0);
      for (let y = 0; y < len; y++) p.set(x, y, shade(G, 0.85 + p.r() * 0.3));
    }
  }
  return p.done();
}

function planks(seed, base, dark = 0.72, vertical = false) {
  const p = new Pix(seed);
  const B = hex(base);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = vertical ? x : y, v = vertical ? y : x;
    const board = Math.floor(u / 4);
    const seam = u % 4 === 3;
    const endJoint = (v + board * 7) % 16 === 0;
    let k = 1 + ((board * 37) % 5 - 2) * 0.04 + (p.r() - 0.5) * 0.1;
    if (seam || endJoint) k = dark;
    else if (u % 4 === 0) k *= 1.1;
    if (!seam && p.r() < 0.05) k *= 0.85; // grain
    p.set(x, y, shade(B, k));
  }
  // nails
  for (let b = 0; b < 4; b++) { p.set((b * 7 + 2) % 16, b * 4 + 1, shade(B, 0.5)); }
  return p.done();
}

function leaves(seed, base, hi, holes = 0.0) {
  const p = new Pix(seed);
  const B = hex(base), H = hex(hi);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = p.r();
    if (r < holes) { p.set(x, y, [0, 0, 0], 0); continue; }
    if (r > 0.82) p.set(x, y, shade(H, 0.95 + p.r() * 0.15));
    else p.set(x, y, shade(B, 0.8 + p.r() * 0.35));
  }
  return p.done();
}

function bamboo(seed) {
  const p = new Pix(seed);
  const B = hex('#7fb83a'), D = hex('#4f7d22'), L = hex('#b5dd62');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let c = B;
    if (x < 2 || x > 13) c = D;
    else if (x === 4 || x === 5) c = L;
    if (y === 7 || y === 15) c = shade(D, 0.9);
    if (y === 6) c = shade(L, 0.95);
    p.set(x, y, shade(c, 0.94 + p.r() * 0.12));
  }
  return p.done();
}

function lacquer(seed, base = '#c8322a') {
  const p = new Pix(seed);
  const B = hex(base);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let k = 0.92 + p.r() * 0.12;
    if (y === 0 || x === 0) k = 1.15;
    if (y === 15 || x === 15) k = 0.75;
    p.set(x, y, shade(B, k));
  }
  return p.done();
}

function crystal(seed) {
  const p = new Pix(seed);
  const B = hex('#20b8ff'), H = hex('#9af0ff'), D = hex('#0d5fc0');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = (x + y) % 8;
    let c = d < 2 ? H : d < 5 ? B : D;
    p.set(x, y, shade(c, 0.9 + p.r() * 0.2));
  }
  return p.done();
}

function lanternGlow(seed, glow = '#ffcf6b', frame = '#3a2a1c') {
  const p = new Pix(seed);
  const G = hex(glow), F = hex(frame);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const edge = x < 2 || x > 13 || y < 2 || y > 13 || x === 7 || x === 8;
    const cx = x - 7.5, cy = y - 7.5, r = Math.sqrt(cx * cx + cy * cy);
    p.set(x, y, edge ? shade(F, 0.9 + p.r() * 0.2) : shade(G, 1.15 - r * 0.05));
  }
  return p.done();
}

function grate(seed) {
  const p = new Pix(seed);
  const M = hex('#4a4f55'), D = hex('#141618');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const bar = x % 4 === 0 || y % 4 === 0 || x === 15 || y === 15;
    p.set(x, y, bar ? shade(M, 0.85 + p.r() * 0.3) : D);
  }
  return p.done();
}

function rockMoss(seed, rock = '#7d7f86', moss = '#5fa83a', cover = 0.35) {
  const p = new Pix(seed);
  const R = hex(rock), G = hex(moss);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = p.r();
    const crack = (x * 3 + y * 5) % 11 === 0;
    let c = shade(R, 0.82 + v * 0.3);
    if (crack) c = shade(R, 0.6);
    p.set(x, y, c);
  }
  for (let x = 0; x < N; x++) {
    const len = Math.floor(2 + p.r() * cover * 14);
    for (let y = 0; y < len; y++) p.set(x, y, shade(G, 0.8 + p.r() * 0.35));
  }
  return p.done();
}

function dirtSide(seed) {
  // grassy dirt side with dangling grass (warmer than Kenney's, used on islands' rims)
  const p = new Pix(seed);
  const D = hex('#8a5a35'), G = hex('#58b23a');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.set(x, y, shade(D, 0.8 + p.r() * 0.35));
  for (let x = 0; x < N; x++) {
    const len = 3 + Math.floor(p.r() * 4);
    for (let y = 0; y < len; y++) p.set(x, y, shade(G, 0.8 + p.r() * 0.35));
  }
  return p.done();
}

function grassTop(seed) {
  const p = new Pix(seed);
  const G = hex('#5cb83c');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = p.r();
    p.set(x, y, shade(G, v > 0.9 ? 1.2 : 0.82 + v * 0.3));
  }
  return p.done();
}

function rope(seed) {
  const p = new Pix(seed);
  const R = hex('#b38b55');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.set(x, y, shade(R, (x + y) % 4 < 2 ? 1.08 : 0.78));
  return p.done();
}

function roof(seed, base = '#3d3f4a') {
  const p = new Pix(seed);
  const B = hex(base);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const row = Math.floor(y / 4);
    let k = 0.9 + p.r() * 0.15;
    if (y % 4 === 3) k = 0.6;
    if ((x + row * 2) % 4 === 0) k *= 0.8;
    p.set(x, y, shade(B, k));
  }
  return p.done();
}

function solid(seed, base, j = 0.1) {
  const p = new Pix(seed);
  p.fill(hex(base), j);
  return p.done();
}

function petals(seed) {
  // cross-plant: tiny pink petals on transparent bg
  const p = new Pix(seed);
  const P = hex('#ffb3d4');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.set(x, y, [0, 0, 0], 0);
  for (let i = 0; i < 18; i++) p.set(Math.floor(p.r() * 16), Math.floor(8 + p.r() * 8), shade(P, 0.85 + p.r() * 0.3));
  return p.done();
}

function flowerCross(seed, col) {
  const p = new Pix(seed);
  const S = hex('#3f8f2a'), F = hex(col);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.set(x, y, [0, 0, 0], 0);
  for (let s = 0; s < 3; s++) {
    const sx = 3 + s * 5;
    for (let y = 8; y < 16; y++) p.set(sx, y, S);
    p.set(sx, 7, F); p.set(sx - 1, 7, F); p.set(sx + 1, 7, F); p.set(sx, 6, F); p.set(sx, 8, shade(F, 0.8));
  }
  return p.done();
}

function tallGrass(seed) {
  const p = new Pix(seed);
  const G = hex('#62bf3e');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.set(x, y, [0, 0, 0], 0);
  for (let b = 0; b < 6; b++) {
    const x0 = 1 + Math.floor(p.r() * 14), h = 5 + Math.floor(p.r() * 9);
    for (let y = 0; y < h; y++) p.set(x0 + Math.round(Math.sin(y * 0.4 + b) * 0.6), 15 - y, shade(G, 0.75 + y / h * 0.45));
  }
  return p.done();
}

function lily(seed, flower = false) {
  const p = new Pix(seed);
  const G = hex('#3e9b45'), F = hex('#ff9fd0');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = x - 7.5, cy = y - 7.5, r = Math.sqrt(cx * cx + cy * cy);
    const notch = cx > 0 && Math.abs(cy) < 1.2;
    if (r < 7 && !notch) p.set(x, y, shade(G, 0.85 + p.r() * 0.25)); else p.set(x, y, [0, 0, 0], 0);
  }
  if (flower) { p.set(5, 6, F); p.set(6, 6, F); p.set(5, 5, F); p.set(6, 5, shade(F, 1.1)); }
  return p.done();
}

function paper(seed) {
  const p = new Pix(seed);
  const W = hex('#fff1cf'), F = hex('#5a3a22');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const frame = x < 1 || x > 14 || y < 1 || y > 14 || y === 8;
    p.set(x, y, frame ? F : shade(W, 0.95 + p.r() * 0.1));
  }
  return p.done();
}

export const PROC_TEXTURES = {
  castle_brick: (s) => bricks(s, '#9aa0a8', '#5d6168', 8, 4),
  castle_brick_dark: (s) => bricks(s, '#7b8089', '#4a4d54', 8, 4),
  castle_brick_moss: (s) => bricks(s, '#959ba2', '#5d6168', 8, 4, 0.6),
  cobble: (s) => bricks(s, '#8b8e93', '#55585e', 5, 5),
  sandstone_brick: (s) => bricks(s, '#c9a878', '#8e7350', 8, 4),
  planks: (s) => planks(s, '#b97a45'),
  planks_light: (s) => planks(s, '#d39a5c'),
  planks_dark: (s) => planks(s, '#7a4a2a', 0.6),
  planks_ship: (s) => planks(s, '#9a5f34', 0.62, true),
  beam: (s) => planks(s, '#8a5530', 0.7, true),
  cherry_leaves: (s) => leaves(s, '#f7a6c9', '#ffd5e8', 0.08),
  cherry_leaves_dark: (s) => leaves(s, '#e0809f', '#f7a6c9', 0.05),
  leaves_green: (s) => leaves(s, '#3f9a36', '#7ed457', 0.05),
  bamboo: (s) => bamboo(s),
  lacquer_red: (s) => lacquer(s, '#c8322a'),
  lacquer_black: (s) => lacquer(s, '#2b2b33'),
  crystal: (s) => crystal(s),
  lantern: (s) => lanternGlow(s),
  lantern_paper: (s) => paper(s),
  grate: (s) => grate(s),
  rock_moss: (s) => rockMoss(s),
  rock_moss_heavy: (s) => rockMoss(s, '#7d7f86', '#5fa83a', 0.8),
  rock_purple: (s) => rockMoss(s, '#7a6878', '#7a9a50', 0.15),
  dirt_side: (s) => dirtSide(s),
  grass_top_px: (s) => grassTop(s),
  rope: (s) => rope(s),
  roof_slate: (s) => roof(s),
  roof_red: (s) => roof(s, '#9c2f2a'),
  mine_dark: (s) => solid(s, '#16120f', 0.25),
  iron: (s) => solid(s, '#5b5f66', 0.12),
  gold: (s) => solid(s, '#e8b93a', 0.1),
  white_plaster: (s) => solid(s, '#e9e3d6', 0.06),
  cloth_red: (s) => solid(s, '#b8312e', 0.1),
  stone_lantern: (s) => bricks(s, '#a3a39a', '#7a7a72', 16, 8),
  petals: (s) => petals(s),
  flower_white: (s) => flowerCross(s, '#ffffff'),
  flower_pink: (s) => flowerCross(s, '#ff8fc4'),
  flower_yellow: (s) => flowerCross(s, '#ffd84a'),
  tall_grass: (s) => tallGrass(s),
  lily_pad: (s) => lily(s, false),
  lily_pad_flower: (s) => lily(s, true),
  cloud_white: (s) => solid(s, '#ffffff', 0.025),
  vine: (s) => leaves(s, '#3f8f2a', '#6cc04a', 0.45),
};
