// Stage description -> flat list of Roblox parts organised in folders/models.
// Hierarchy produced for every stage:
//   <Stage name> (Model)
//     Stage/ MainPlatform, SoftPlatforms/Soft_*, Spawns/Spawn_*   (gameplay, collidable)
//     Background/ ...                                             (decor, no collision)
//     FX/ Spin_*, Swing_*, Bob_*, Cloud_*, Flag_*, Banner_*, Waterfall_*, Emit_*, Drift_*
//     LightingPreset (StringValue), StageFX (client Script)
import { Grid, greedy, VOXEL } from './grid.mjs';
import { PALETTE } from './palette.mjs';
import { hash3 } from '../../src/engine/rng.js';

export class Stage {
  constructor(id, title, o = {}) {
    this.id = id; this.title = title;
    this.lighting = o.lighting || 'day';
    this.groups = [];
    this.markers = []; // invisible helper parts (spawns, emitters)
  }
  /**
   * @param {string} folder  'Stage' | 'Stage/SoftPlatforms' | 'Background' | 'FX'
   * @param {string} name    model name (FX kinds are read from the prefix, e.g. 'Spin_Windmill')
   * @param {object} o       collide, unit (studs per voxel), origin [studs], pivot [studs], merge axes, depth (studs, for cloth)
   */
  group(folder, name, o = {}) {
    const g = { folder, name, grid: new Grid(), extras: [], collide: !!o.collide, unit: o.unit ?? VOXEL, origin: o.origin ?? [0, 0, 0], pivot: o.pivot ?? null, merge: o.merge ?? 'xyz', depth: o.depth ?? null, castShadow: o.castShadow ?? true };
    this.groups.push(g);
    return g;
  }
  marker(folder, name, center, size) { this.markers.push({ folder, name, center, size }); }
}

// voxel -> studs for the default 4-stud grid (top of y=0 voxels sits at Y=0)
export const V = (x, y, z) => [x * VOXEL, y * VOXEL - VOXEL / 2, z * VOXEL];

/** Expand every group into parts: {folder, model, name, color, mat, transparency, studs, pos, size, collide} */
export function stageToParts(stage) {
  const parts = [];
  const models = [];
  for (const g of stage.groups) {
    // pick colour variants per voxel (keeps the slight checker variation of the reference)
    const shaded = new Grid();
    const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [x, y, z, c] of g.grid.entries()) {
      const pal = PALETTE[c];
      if (!pal) throw new Error(`Unknown palette key "${c}" in ${g.name}`);
      // hidden voxels all get shade 0 so the interior merges into a few big parts
      const hidden = N6.every(([dx, dy, dz]) => g.grid.get(x + dx, y + dy, z + dz));
      const i = hidden ? 0 : Math.floor(hash3(x, y, z, 17) * pal.shades.length);
      shaded.set(x, y, z, `${c}#${i}`);
    }
    const u = g.unit, [ox, oy, oz] = g.origin;
    for (const b of greedy(shaded, g.merge)) {
      const [c, idx] = b.c.split('#');
      const pal = PALETTE[c];
      const size = [(b.max[0] - b.min[0] + 1) * u, (b.max[1] - b.min[1] + 1) * u, (b.max[2] - b.min[2] + 1) * u];
      const pos = [ox + ((b.min[0] + b.max[0]) / 2) * u, oy + ((b.min[1] + b.max[1]) / 2) * u - u / 2, oz + ((b.min[2] + b.max[2]) / 2) * u];
      if (g.depth) size[2] = g.depth;
      parts.push(partOf(g, c, pal, pal.shades[+idx], pos, size));
    }
    for (const e of g.extras) {
      const pal = PALETTE[e.c];
      parts.push(partOf(g, e.c, pal, pal.shades[0], e.pos, e.size, e.name));
    }
    if (g.pivot) parts.push({ folder: g.folder, model: g.name, name: 'Pivot', color: '#ffffff', mat: 'SmoothPlastic', transparency: 1, studs: false, pos: g.pivot, size: [1, 1, 1], collide: false, castShadow: false });
    models.push({ folder: g.folder, name: g.name });
  }
  for (const m of stage.markers) {
    parts.push({ folder: m.folder, model: null, name: m.name, color: '#ffffff', mat: 'SmoothPlastic', transparency: 1, studs: false, pos: m.center, size: m.size, collide: false, castShadow: false });
  }
  return { parts, models };
}

function partOf(g, c, pal, color, pos, size, name) {
  const nm = name || (c === 'lantern' ? 'Lantern' : c === 'crystal' ? 'Crystal' : c[0].toUpperCase() + c.slice(1));
  return {
    folder: g.folder, model: g.name, name: nm, color, mat: pal.mat, transparency: pal.transparency ?? 0,
    studs: pal.mat === 'Plastic', pos, size, collide: g.collide && pal.transparency !== 1, castShadow: g.castShadow && (pal.transparency ?? 0) < 0.5,
  };
}
