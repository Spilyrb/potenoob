// Shared building blocks for the four maps: floating islands, decoration
// scattering, trees, lanterns with flickering lights, waving cloth (flags,
// banners, sails) and the distant background islands.
import * as THREE from 'three';
import { VoxelModel } from '../engine/VoxelModel.js';
import { BLOCK } from '../engine/blocks.js';
import { fbm2, hash3, mulberry32 } from '../engine/rng.js';
import { globalUniforms } from '../engine/materials.js';
import { createEmitter } from '../vfx/particles.js';

/**
 * Carves a floating island: flat (or gently bumpy) top, noisy outline,
 * inverted-cone underside with stalactite spikes, layered materials.
 * Returns a height map accessor top(x,z) -> y or null.
 */
export function floatingIsland(m, o) {
  const { cx, cz, rx, rz } = o;
  const topY = o.y;
  const depth = o.depth ?? Math.max(rx, rz) * 0.9;
  const seed = o.seed ?? 1;
  const topBlock = o.top ?? BLOCK.GRASS;
  const sub = o.sub ?? BLOCK.DIRT;
  const rock = o.rock ?? [BLOCK.STONE, BLOCK.GREYSTONE, BLOCK.STONE, BLOCK.STONE_DIRT];
  const ores = o.ores ?? [];
  const bump = o.bump ?? 0;
  const heights = new Map();
  const inside = (x, z) => {
    const dx = (x - cx) / rx, dz = (z - cz) / rz;
    const r = Math.sqrt(dx * dx + dz * dz) + (fbm2(x * 0.11, z * 0.11, seed) - 0.5) * (o.rough ?? 0.45);
    return r;
  };
  for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
    for (let z = Math.floor(cz - rz - 3); z <= cz + rz + 3; z++) {
      const r = inside(x, z);
      if (r > 1) continue;
      const ty = topY + Math.round(bump * (fbm2(x * 0.08, z * 0.08, seed + 5) - 0.5) * 2);
      const k = Math.pow(Math.max(0, 1 - r), 0.75);
      let d = Math.round(2 + depth * k * (0.65 + 0.7 * fbm2(x * 0.15, z * 0.15, seed + 9)));
      if (hash3(x, 0, z, seed) < 0.08) d += Math.round(2 + hash3(x, 1, z, seed) * 6); // stalactite spikes
      for (let y = ty - d; y <= ty; y++) {
        let id;
        const fromTop = ty - y;
        if (fromTop === 0) id = topBlock;
        else if (fromTop <= (o.subDepth ?? 2)) id = sub;
        else {
          id = rock[Math.floor(hash3(x, y, z, seed + 2) * rock.length)];
          if (ores.length && hash3(x, y, z, seed + 4) < (o.oreChance ?? 0.03)) id = ores[Math.floor(hash3(z, x, y, 3) * ores.length)];
        }
        m.set(x, y, z, id);
      }
      heights.set(x * 4096 + z, ty);
    }
  }
  // hanging vines on the rim
  if (o.vines !== false) {
    const rnd = mulberry32(seed + 100);
    for (const [k, ty] of heights) {
      const x = Math.round(k / 4096), z = k - x * 4096;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (heights.has((x + dx) * 4096 + (z + dz))) continue;
        if (rnd() > (o.vineChance ?? 0.18)) continue;
        const len = 1 + Math.floor(rnd() * 4);
        for (let i = 1; i <= len; i++) m.setIfEmpty(x + dx, ty - i, z + dz, BLOCK.VINE);
      }
    }
  }
  return {
    top: (x, z) => (heights.has(Math.round(x) * 4096 + Math.round(z)) ? heights.get(Math.round(x) * 4096 + Math.round(z)) : null),
    heights,
  };
}

export function scatter(m, island, opts) {
  const rnd = mulberry32(opts.seed || 5);
  for (const [k, ty] of island.heights) {
    const x = Math.round(k / 4096), z = k - x * 4096;
    if (opts.avoid && opts.avoid(x, z)) continue;
    if (m.get(x, ty + 1, z)) continue;
    if (m.get(x, ty, z) !== (opts.on ?? BLOCK.GRASS)) continue;
    if (rnd() < opts.chance) m.set(x, ty + 1, z, opts.blocks[Math.floor(rnd() * opts.blocks.length)]);
  }
}

export function tree(m, x, y, z, o = {}) {
  const h = o.h ?? 6, r = o.r ?? 3;
  m.box(x, y, z, x, y + h - 1, z, o.trunk ?? BLOCK.LOG);
  m.sphere(x, y + h, z, r, o.leaves ?? BLOCK.LEAVES, { ry: r * 0.8, noise: 0.35, seed: x * 7 + z, ifEmpty: true });
}

export function stairs(m, x, y, z, steps, dir, width, id) {
  // dir: [dx,dz] the direction going *up*
  for (let i = 0; i < steps; i++) {
    for (let w = 0; w < width; w++) {
      const ox = dir[0] ? 0 : w, oz = dir[0] ? w : 0;
      for (let k = 0; k <= i; k++) m.set(x + dir[0] * i + ox, y + k, z + dir[1] * i + oz, id);
    }
  }
}

/** Wooden scaffold platform on posts (left/right decks of the mines, zen floating slabs...). */
export function deck(m, x0, z0, x1, z1, y, o = {}) {
  m.box(x0, y, z0, x1, y, z1, o.floor ?? BLOCK.PLANKS);
  if (o.legs !== false) {
    const legH = o.legH ?? 4;
    for (const [lx, lz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) m.box(lx, y - legH, lz, lx, y - 1, lz, o.leg ?? BLOCK.POST);
  }
  if (o.rim) {
    m.box(x0, y - 1, z0, x1, y - 1, z0, o.rim);
    m.box(x0, y - 1, z1, x1, y - 1, z1, o.rim);
  }
}

// ---------------------------------------------------------------------------
// Lanterns: voxel glow block + optional flickering point light + glow sprite
export class LightRig {
  constructor(group, maxLights = 8) {
    this.group = group; this.lights = []; this.max = maxLights; this.glows = [];
  }
  add(x, y, z, color = '#ffb347', intensity = 18, distance = 14) {
    if (intensity > 0 && this.lights.length < this.max) {
      const l = new THREE.PointLight(color, intensity, distance, 1.6);
      l.position.set(x, y, z);
      l.userData.base = intensity;
      l.userData.phase = Math.random() * 10;
      this.group.add(l);
      this.lights.push(l);
    }
    this.glows.push([x, y, z, color]);
  }
  finalize() {
    if (!this.glows.length) return;
    // a soft additive halo around every lantern
    const pos = [], col = [];
    for (const [x, y, z, c] of this.glows) { pos.push(x, y, z); const cc = new THREE.Color(c); col.push(cc.r, cc.g, cc.b); }
    for (const [x, y, z, c] of this.glows) {
      this.group.add(createEmitter({
        name: 'lantern_halo', seed: Math.floor(x * 31 + z * 17 + y), count: 2,
        min: [x, y, z], max: [x, y, z], vel: [0, 0, 0], life: [3, 4], size: [3.2, 4.2],
        colors: [c], shape: 'soft', additive: true, opacity: 0.35, twinkle: 0.25,
      }));
    }
  }
  update(t) {
    for (const l of this.lights) {
      const p = l.userData.phase;
      l.intensity = l.userData.base * (0.82 + 0.12 * Math.sin(t * 9 + p) + 0.08 * Math.sin(t * 23.7 + p * 2));
    }
  }
}

/** Voxel hanging lantern: rope/post above, frame, glowing core. Returns light position. */
export function lantern(m, x, y, z, o = {}) {
  m.set(x, y, z, o.block ?? BLOCK.LANTERN);
  if (o.hang) for (let i = 1; i <= o.hang; i++) m.set(x, y + i, z, BLOCK.IRON_POST);
  return [x, y, z];
}

// ---------------------------------------------------------------------------
// Cloth: flags (pinned at one side), banners (pinned top), sails (billow)
function clothCanvas(o) {
  const W = o.px?.[0] ?? 16, H = o.px?.[1] ?? 24;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const r = mulberry32(o.seed || 3);
  const base = new THREE.Color(o.color || '#b8312e');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = 0.88 + r() * 0.16 - (y / H) * 0.08;
    ctx.fillStyle = `rgb(${base.r * 255 * k | 0},${base.g * 255 * k | 0},${base.b * 255 * k | 0})`;
    ctx.fillRect(x, y, 1, 1);
  }
  if (o.trim) {
    ctx.fillStyle = o.trim;
    ctx.fillRect(0, 0, W, 1); ctx.fillRect(0, 0, 1, H); ctx.fillRect(W - 1, 0, 1, H);
  }
  if (o.emblem) o.emblem(ctx, W, H, r);
  if (o.tatter) {
    // torn bottom edge + holes
    for (let x = 0; x < W; x++) {
      const len = Math.floor(r() * o.tatter * H * 0.3);
      ctx.clearRect(x, H - len, 1, len);
    }
    for (let i = 0; i < o.tatter * 6; i++) ctx.clearRect(Math.floor(r() * W), Math.floor(H * 0.3 + r() * H * 0.6), 1 + Math.floor(r() * 2), 1);
  }
  if (o.pennant) {
    // swallow-tail cut at the free end
    for (let y = 0; y < H; y++) {
      const cut = Math.round((1 - Math.abs(y / (H - 1) - 0.5) * 2) * W * 0.3);
      ctx.clearRect(W - cut, y, cut, 1);
    }
  }
  if (o.pointed) {
    for (let y = 0; y < H; y++) {
      const rem = Math.max(0, y - (H - Math.floor(W / 2) - 1));
      if (rem > 0) { ctx.clearRect(0, y, rem, 1); ctx.clearRect(W - rem, y, rem, 1); }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = o.name || 'cloth';
  return tex;
}

export const EMBLEMS = {
  crest(ctx, W, H) {
    // golden heraldic crest: shield with a stylised winged egg
    const g = '#f2c84b', d = '#b8862a';
    const cx = Math.floor(W / 2), cy = Math.floor(H * 0.42);
    ctx.fillStyle = g;
    for (let y = -4; y <= 4; y++) {
      const w = y < 2 ? 4 : 4 - (y - 1);
      ctx.fillRect(cx - w, cy + y, w * 2, 1);
    }
    ctx.fillStyle = '#b8312e';
    ctx.fillRect(cx - 1, cy - 2, 2, 4); ctx.fillRect(cx - 2, cy - 1, 4, 2);
    ctx.fillStyle = d;
    ctx.fillRect(cx - 6, cy - 3, 2, 1); ctx.fillRect(cx + 4, cy - 3, 2, 1);
    ctx.fillRect(cx - 7, cy - 4, 1, 1); ctx.fillRect(cx + 6, cy - 4, 1, 1);
  },
  egg(ctx, W, H) {
    // white dragon egg with wings (pirate-ish sigil for the wreck)
    const cx = W / 2, cy = H * 0.45;
    ctx.fillStyle = '#f4efe6';
    for (let y = -6; y <= 6; y++) {
      const t = y / 6;
      const w = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * (y < 0 ? 3.5 : 4.5));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(Math.round(cx - 6 - i), Math.round(cy - 2 + i), 2, 1);
      ctx.fillRect(Math.round(cx + 4 + i), Math.round(cy - 2 + i), 2, 1);
    }
    ctx.fillStyle = '#8f2a2a';
    ctx.fillRect(Math.round(cx - 1), Math.round(cy - 1), 2, 2);
    ctx.fillRect(Math.round(cx + 1), Math.round(cy + 2), 1, 1);
  },
  diamond(ctx, W, H) {
    ctx.fillStyle = '#f2c84b';
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    for (let y = -3; y <= 3; y++) { const w = 3 - Math.abs(y); ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
  },
};

/**
 * Waving cloth. mode: 'flag' (pinned at x=0), 'banner' (pinned at top), 'sail' (billowing, pinned top+bottom)
 * The plane spans +x (width) and -y (height) from its origin (top-left corner).
 */
export function cloth(o) {
  const tex = clothCanvas(o);
  const w = o.w, h = o.h;
  const geo = new THREE.PlaneGeometry(w, h, o.segX ?? 12, o.segY ?? 12);
  geo.translate(w / 2, -h / 2, 0);
  const mat = new THREE.MeshStandardMaterial({
    name: o.name || 'cloth', map: tex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.95,
  });
  const mode = { flag: 0, banner: 1, sail: 2 }[o.mode || 'flag'];
  const amp = o.amp ?? 0.6, freq = o.freq ?? 3, speed = o.speed ?? 4;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float u = position.x / ${w.toFixed(3)};
        float v = -position.y / ${h.toFixed(3)};
        float ph = uTime * ${speed.toFixed(3)};
        float disp;
        if (${mode} == 0) {
          disp = sin(u * ${freq.toFixed(3)} * 3.14159 - ph) * u * ${amp.toFixed(3)} + sin(v * 4.0 + ph * 0.7) * 0.08 * u;
          transformed.y += sin(u * 6.0 - ph) * 0.06 * u * ${h.toFixed(3)};
        } else if (${mode} == 1) {
          disp = sin(v * ${freq.toFixed(3)} * 3.14159 - ph + u * 1.5) * v * ${amp.toFixed(3)};
          transformed.x += sin(ph * 0.5 + v * 2.0) * v * 0.15;
        } else {
          float belly = sin(v * 3.14159) * (0.85 + 0.15 * sin(ph * 0.6));
          disp = belly * ${amp.toFixed(3)} + sin(u * 9.0 - ph) * 0.12 * v;
        }
        transformed.z += disp;`);
  };
  mat.customProgramCacheKey = () => `cloth_${mode}_${w}_${h}_${amp}_${freq}_${speed}`;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = o.name || 'cloth';
  mesh.castShadow = true;
  if (o.pos) mesh.position.set(...o.pos);
  if (o.rotY) mesh.rotation.y = o.rotY;
  return mesh;
}

// ---------------------------------------------------------------------------
// Distant floating islands (background), bobbing slowly
export function backgroundIslands(ctx, o = {}) {
  const { atlas, mats } = ctx;
  const rnd = mulberry32(o.seed ?? 99);
  const group = new THREE.Group();
  group.name = 'background_islands';
  const kinds = [];
  for (let i = 0; i < (o.variants ?? 5); i++) {
    const m = new VoxelModel();
    const r = 3 + Math.floor(rnd() * 5);
    const isl = floatingIsland(m, {
      cx: 0, cz: 0, rx: r, rz: r * (0.7 + rnd() * 0.5), y: 0, depth: r * 1.4, seed: 300 + i,
      top: o.top ?? BLOCK.GRASS, sub: BLOCK.DIRT, vineChance: 0.3,
    });
    if (rnd() < 0.7) {
      const leaves = o.leaves ? o.leaves[Math.floor(rnd() * o.leaves.length)] : BLOCK.LEAVES;
      tree(m, 0, 1, 0, { h: 2 + Math.floor(rnd() * 3), r: 1.5 + rnd() * 1.5, leaves });
    }
    scatter(m, isl, { chance: 0.25, blocks: [BLOCK.TALL_GRASS, BLOCK.FLOWER_W], seed: i, on: o.top ?? BLOCK.GRASS });
    kinds.push(m.build(atlas, mats, [0, 0, 0], 'bg_island_' + i));
  }
  const bobbers = [];
  const n = o.count ?? 12;
  for (let i = 0; i < n; i++) {
    const g = kinds[i % kinds.length].clone();
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const r = (o.minR ?? 85) + rnd() * (o.spanR ?? 140);
    g.position.set(Math.cos(a) * r, -15 + rnd() * 55, Math.sin(a) * r - 20);
    g.rotation.y = rnd() * Math.PI * 2;
    g.scale.setScalar(0.8 + rnd() * 0.9);
    g.userData.baseY = g.position.y;
    g.userData.phase = rnd() * 10;
    g.traverse((c) => { if (c.isMesh) c.castShadow = false; });
    group.add(g);
    bobbers.push(g);
  }
  return {
    group,
    update(t) {
      for (const b of bobbers) b.position.y = b.userData.baseY + Math.sin(t * 0.4 + b.userData.phase) * 1.2;
    },
  };
}

/** small satellite island built into a model at a given place */
export function satellite(m, x, y, z, r, seed, o = {}) {
  return floatingIsland(m, { cx: x, cz: z, rx: r, rz: r * (o.squash ?? 0.85), y, depth: r * (o.depthK ?? 1.5), seed, ...o });
}
