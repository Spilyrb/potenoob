// Builds one texture atlas from the Kenney Voxel Pack PNGs + procedural tiles.
// Every tile is surrounded by an extruded gutter so mipmapping never bleeds
// neighbouring tiles into each other (important for distant islands).
import * as THREE from 'three';
import { PROC_TEXTURES } from './procTextures.js';
import { allTileNames } from './blocks.js';

const CELL = 64;   // tile content size in px
const PAD = 8;     // gutter on each side
const SLOT = CELL + PAD * 2;
const COLS = 12;

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Failed to load ' + url));
    img.src = url;
  });
}

export async function buildAtlas(base = import.meta.env.BASE_URL) {
  const names = allTileNames();
  const rows = Math.ceil(names.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * SLOT;
  canvas.height = rows * SLOT;
  const ctx = canvas.getContext('2d');

  const sources = await Promise.all(names.map(async (n, i) => {
    if (n.startsWith('k:')) return loadImage(`${base}textures/kenney-voxel/Tiles/${n.slice(2)}.png`);
    const fn = PROC_TEXTURES[n];
    if (!fn) throw new Error('Unknown tile ' + n);
    return fn(1000 + i * 31);
  }));

  const uv = {};
  names.forEach((n, i) => {
    const cx = (i % COLS) * SLOT, cy = Math.floor(i / COLS) * SLOT;
    const src = sources[i];
    const pixelArt = !n.startsWith('k:');
    // Draw into a CELL x CELL scratch, then extrude edges into the gutter.
    const tile = document.createElement('canvas');
    tile.width = tile.height = CELL;
    const tctx = tile.getContext('2d');
    tctx.imageSmoothingEnabled = !pixelArt;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(src, 0, 0, CELL, CELL);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tile, cx + PAD, cy + PAD);
    // gutters: edges stretched outward
    ctx.drawImage(tile, 0, 0, CELL, 1, cx + PAD, cy, CELL, PAD);
    ctx.drawImage(tile, 0, CELL - 1, CELL, 1, cx + PAD, cy + PAD + CELL, CELL, PAD);
    ctx.drawImage(tile, 0, 0, 1, CELL, cx, cy + PAD, PAD, CELL);
    ctx.drawImage(tile, CELL - 1, 0, 1, CELL, cx + PAD + CELL, cy + PAD, PAD, CELL);
    ctx.drawImage(tile, 0, 0, 1, 1, cx, cy, PAD, PAD);
    ctx.drawImage(tile, CELL - 1, 0, 1, 1, cx + PAD + CELL, cy, PAD, PAD);
    ctx.drawImage(tile, 0, CELL - 1, 1, 1, cx, cy + PAD + CELL, PAD, PAD);
    ctx.drawImage(tile, CELL - 1, CELL - 1, 1, 1, cx + PAD + CELL, cy + PAD + CELL, PAD, PAD);

    const W = canvas.width, H = canvas.height;
    // flipY=false: v grows downward in canvas space
    uv[n] = [(cx + PAD) / W, (cy + PAD) / H, (cx + PAD + CELL) / W, (cy + PAD + CELL) / H];
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.name = 'voxel_atlas';
  return { texture, uv, canvas };
}
