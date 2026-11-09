// Block registry. Tile names starting with "k:" come from the downloaded
// Kenney Voxel Pack (public/textures/kenney-voxel/Tiles, CC0). Others are
// procedural pixel textures from procTextures.js.
//
// pass:  opaque | cutout (alpha-tested, double sided) | emissive (glows, feeds bloom)
// shape: cube | slab (half) | plate (1/8 thick) | post (thin column) | cross (billboard X plant)
// jitter: per-voxel brightness variation that gives the hand-placed voxel look

const B = [];
function def(name, o) {
  const d = {
    name,
    top: o.top || o.all, side: o.side || o.all, bottom: o.bottom || o.all,
    pass: o.pass || 'opaque', shape: o.shape || 'cube',
    tint: o.tint || [1, 1, 1], jitter: o.jitter ?? 0.1,
  };
  d.id = B.length + 1;
  B.push(d);
  return d.id;
}

export const BLOCK = {
  // terrain
  GRASS: def('grass', { top: 'grass_top_px', side: 'k:dirt_grass', bottom: 'k:dirt', jitter: 0.12 }),
  GRASS_ROCK: def('grass_rock', { top: 'grass_top_px', side: 'rock_moss', bottom: 'k:stone', jitter: 0.12 }),
  DIRT: def('dirt', { all: 'k:dirt', tint: [0.85, 0.8, 0.78], jitter: 0.12 }),
  STONE: def('stone', { all: 'k:stone', tint: [0.72, 0.68, 0.7], jitter: 0.14 }),
  GREYSTONE: def('greystone', { all: 'k:greystone', tint: [0.78, 0.74, 0.74], jitter: 0.14 }),
  STONE_DIRT: def('stone_dirt', { all: 'k:stone_dirt', tint: [0.8, 0.74, 0.7], jitter: 0.12 }),
  GRAVEL: def('gravel', { all: 'k:gravel_stone', jitter: 0.08 }),
  SAND: def('sand', { all: 'k:sand', jitter: 0.06 }),
  ROCK_MOSS: def('rock_moss', { top: 'grass_top_px', side: 'rock_moss_heavy', bottom: 'k:stone', jitter: 0.12 }),
  ROCK_PURPLE: def('rock_purple', { all: 'rock_purple', jitter: 0.12 }),
  ORE_CRYSTAL: def('ore_crystal', { all: 'k:stone_diamond', tint: [0.75, 0.72, 0.75], jitter: 0.1 }),
  ORE_GOLD: def('ore_gold', { all: 'k:stone_gold', tint: [0.75, 0.72, 0.72], jitter: 0.1 }),
  ORE_COAL: def('ore_coal', { all: 'k:stone_coal', tint: [0.75, 0.72, 0.72], jitter: 0.1 }),
  // masonry
  BRICK: def('castle_brick', { all: 'castle_brick', jitter: 0.08 }),
  BRICK_DARK: def('castle_brick_dark', { all: 'castle_brick_dark', jitter: 0.08 }),
  BRICK_MOSS: def('castle_brick_moss', { top: 'grass_top_px', side: 'castle_brick_moss', bottom: 'castle_brick', jitter: 0.08 }),
  COBBLE: def('cobble', { all: 'cobble', jitter: 0.1 }),
  PAVING: def('paving', { all: 'k:brick_grey', jitter: 0.08 }),
  PAVING_WARM: def('paving_warm', { all: 'sandstone_brick', jitter: 0.08 }),
  BRICK_SLAB: def('brick_slab', { all: 'castle_brick', shape: 'slab', jitter: 0.08 }),
  PLASTER: def('plaster', { all: 'white_plaster', jitter: 0.04 }),
  STONE_LANTERN: def('stone_lantern', { all: 'stone_lantern', jitter: 0.05 }),
  // wood
  PLANKS: def('planks', { all: 'planks', jitter: 0.1 }),
  PLANKS_LIGHT: def('planks_light', { all: 'planks_light', jitter: 0.1 }),
  PLANKS_DARK: def('planks_dark', { all: 'planks_dark', jitter: 0.1 }),
  SHIP: def('ship', { all: 'planks_ship', jitter: 0.12 }),
  PLANK_SLAB: def('plank_slab', { all: 'planks', shape: 'slab', jitter: 0.1 }),
  PLANK_SLAB_LIGHT: def('plank_slab_light', { all: 'planks_light', shape: 'slab', jitter: 0.1 }),
  BEAM: def('beam', { all: 'beam', jitter: 0.08 }),
  POST: def('post', { all: 'beam', shape: 'post', jitter: 0.05 }),
  LOG: def('log', { top: 'k:trunk_top', side: 'k:trunk_side', bottom: 'k:trunk_top', jitter: 0.06 }),
  ROPE: def('rope', { all: 'rope', shape: 'post', jitter: 0 }),
  RAIL: def('rail', { all: 'k:track_straight', shape: 'plate', pass: 'cutout', jitter: 0 }),
  GRATE: def('grate', { all: 'grate', jitter: 0.05 }),
  // foliage & plants
  LEAVES: def('leaves', { all: 'leaves_green', pass: 'cutout', jitter: 0.15 }),
  CHERRY: def('cherry', { all: 'cherry_leaves', pass: 'cutout', tint: [1.18, 1.12, 1.15], jitter: 0.12 }),
  CHERRY_DARK: def('cherry_dark', { all: 'cherry_leaves_dark', pass: 'cutout', tint: [1.12, 1.08, 1.1], jitter: 0.12 }),
  BAMBOO: def('bamboo', { all: 'bamboo', shape: 'post', jitter: 0.08 }),
  VINE: def('vine', { all: 'vine', pass: 'cutout', shape: 'cross', jitter: 0.1 }),
  TALL_GRASS: def('tall_grass', { all: 'tall_grass', pass: 'cutout', shape: 'cross', jitter: 0.15 }),
  FLOWER_W: def('flower_w', { all: 'flower_white', pass: 'cutout', shape: 'cross', jitter: 0.05 }),
  FLOWER_P: def('flower_p', { all: 'flower_pink', pass: 'cutout', shape: 'cross', jitter: 0.05 }),
  FLOWER_Y: def('flower_y', { all: 'flower_yellow', pass: 'cutout', shape: 'cross', jitter: 0.05 }),
  PETALS: def('petals', { all: 'petals', pass: 'cutout', shape: 'cross', jitter: 0.05 }),
  MUSHROOM: def('mushroom', { all: 'k:mushroom_red', pass: 'cutout', shape: 'cross', jitter: 0 }),
  LILY: def('lily', { all: 'lily_pad', shape: 'plate', pass: 'cutout', jitter: 0.1 }),
  LILY_FLOWER: def('lily_flower', { all: 'lily_pad_flower', shape: 'plate', pass: 'cutout', jitter: 0.05 }),
  // colours / decor
  LACQUER: def('lacquer', { all: 'lacquer_red', jitter: 0.05 }),
  LACQUER_POST: def('lacquer_post', { all: 'lacquer_red', shape: 'post', jitter: 0.03 }),
  LACQUER_SLAB: def('lacquer_slab', { all: 'lacquer_red', shape: 'slab', jitter: 0.05 }),
  BLACK: def('black', { all: 'lacquer_black', jitter: 0.05 }),
  ROOF: def('roof', { all: 'roof_slate', jitter: 0.06 }),
  ROOF_RED: def('roof_red', { all: 'roof_red', jitter: 0.06 }),
  CLOTH_RED: def('cloth_red', { all: 'cloth_red', jitter: 0.06 }),
  IRON: def('iron', { all: 'iron', jitter: 0.08 }),
  IRON_POST: def('iron_post', { all: 'iron', shape: 'post', jitter: 0.05 }),
  GOLD: def('gold', { all: 'gold', jitter: 0.05 }),
  MINE_DARK: def('mine_dark', { all: 'mine_dark', jitter: 0.2 }),
  WATER: def('water', { all: 'k:water', pass: 'emissive', tint: [0.42, 0.62, 0.85], jitter: 0.04 }),
  // sky
  CLOUD: def('cloud', { all: 'cloud_white', jitter: 0.03 }),
  // light sources
  CRYSTAL: def('crystal', { all: 'crystal', pass: 'emissive', jitter: 0.1 }),
  CRYSTAL_SHARD: def('crystal_shard', { all: 'crystal', pass: 'emissive', shape: 'post', jitter: 0.15 }),
  LANTERN: def('lantern', { all: 'lantern', pass: 'emissive', jitter: 0.02 }),
  PAPER_LANTERN: def('paper_lantern', { all: 'lantern_paper', pass: 'emissive', jitter: 0.02 }),
};

export const BLOCKS = B; // index = id - 1

export function blockById(id) { return B[id - 1]; }

export function allTileNames() {
  const s = new Set();
  for (const b of B) { s.add(b.top); s.add(b.side); s.add(b.bottom); }
  return [...s];
}
