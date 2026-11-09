// "Studs" style palette: saturated lime grass, coral dirt, pastel stone, orange wood.
// mat: Roblox material. Plastic + Studs surfaces gives the bumpy toy-brick look.
// shades: random per-voxel variants (like the checker variation in the reference).
export const PALETTE = {
  grass: { shades: ['#7fd62c', '#76cf27', '#86dc33'], mat: 'Plastic' },
  grassSide: { shades: ['#5fbf22', '#67c626'], mat: 'Plastic' },
  grassDark: { shades: ['#4fa51c', '#58ad20'], mat: 'Plastic' },
  dirt: { shades: ['#e6675a', '#dc5d51', '#ee7465', '#d45449'], mat: 'Plastic' },
  dirtDark: { shades: ['#c44b44', '#b9433d'], mat: 'Plastic' },
  path: { shades: ['#f3e5b5', '#ecdba6'], mat: 'Plastic' },
  sand: { shades: ['#f6d690', '#f0cc80'], mat: 'Plastic' },
  stone: { shades: ['#a3abd0', '#97a0c6', '#aeb5d8'], mat: 'Plastic' },
  stoneDark: { shades: ['#7d84ab', '#737a9f'], mat: 'Plastic' },
  castle: { shades: ['#c9cde0', '#bcc1d8', '#d3d7e8'], mat: 'Plastic' },
  castleDark: { shades: ['#9ea4c2', '#959bb9'], mat: 'Plastic' },
  wood: { shades: ['#e8913f', '#df8838'], mat: 'Plastic' },
  woodDark: { shades: ['#b9652e', '#ad5d2a'], mat: 'Plastic' },
  plank: { shades: ['#f0a552', '#e89b48'], mat: 'Plastic' },
  hull: { shades: ['#c9733a', '#bd6a34', '#d27c40'], mat: 'Plastic' },
  trunk: { shades: ['#d8645c', '#cf5b54'], mat: 'Plastic' },
  leaves: { shades: ['#7ed957', '#6ccd47', '#8fe366'], mat: 'Plastic' },
  leavesDark: { shades: ['#5bb83c', '#53ad36'], mat: 'Plastic' },
  cherry: { shades: ['#ffa3cc', '#ff96c3', '#ffb3d6'], mat: 'Plastic' },
  cherryDark: { shades: ['#f584b6', '#ee7aad'], mat: 'Plastic' },
  bamboo: { shades: ['#8fd94e', '#82cf45'], mat: 'Plastic' },
  red: { shades: ['#ea4a3f', '#e3433a'], mat: 'Plastic' },
  roof: { shades: ['#e05050', '#d84848'], mat: 'Plastic' },
  black: { shades: ['#3a3a48'], mat: 'Plastic' },
  white: { shades: ['#fbfbff'], mat: 'Plastic' },
  plaster: { shades: ['#fff3dd', '#fbebd0'], mat: 'Plastic' },
  gold: { shades: ['#ffc83d'], mat: 'Plastic' },
  iron: { shades: ['#6d7387'], mat: 'Plastic' },
  mushroom: { shades: ['#ee3b3b'], mat: 'Plastic' },
  cloth: { shades: ['#e8453c'], mat: 'Plastic' },
  clothTrim: { shades: ['#ffc83d'], mat: 'Plastic' },
  sail: { shades: ['#f2ebdc'], mat: 'Plastic' },
  // light / fx
  crystal: { shades: ['#4fe6ff'], mat: 'Neon' },
  lantern: { shades: ['#ffd36b'], mat: 'Neon' },
  window: { shades: ['#ffcc66'], mat: 'Neon' },
  mineDark: { shades: ['#1d1a24'], mat: 'SmoothPlastic' },
  water: { shades: ['#6fd0ff', '#8adaff'], mat: 'Plastic', transparency: 0.15 },
  waterFall: { shades: ['#7fd6ff'], mat: 'SmoothPlastic', transparency: 0.1 },
  waterFoam: { shades: ['#e8f9ff'], mat: 'SmoothPlastic', transparency: 0.05 },
  cloud: { shades: ['#ffffff'], mat: 'SmoothPlastic' },
  cloudPink: { shades: ['#ffe1ec'], mat: 'SmoothPlastic' },
  cloudShade: { shades: ['#e3eefc'], mat: 'SmoothPlastic' },
  invisible: { shades: ['#ffffff'], mat: 'SmoothPlastic', transparency: 1 },
};

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
