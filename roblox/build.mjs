// Generates the Roblox stages:
//   roblox/out/<id>.rbxmx           -> Studio: right click Workspace > "Insert from File..."
//   roblox/out/<id>.builder.luau    -> alternative: paste in the Studio command bar
//   public/stages/<id>.json         -> data for the browser preview (stage.html)
// Usage: node roblox/build.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES } from './stages.mjs';
import { stageToParts } from './lib/stage.mjs';
import { hexToRgb } from './lib/palette.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');
const jsonDir = join(here, '..', 'public', 'stages');
mkdirSync(outDir, { recursive: true });
mkdirSync(jsonDir, { recursive: true });
const FX_SOURCE = readFileSync(join(here, 'StageFX.client.luau'), 'utf8');

const MATERIAL = { Plastic: 256, SmoothPlastic: 272, Neon: 288, Glass: 1568 };
const n3 = (v) => Number(v.toFixed(3));

// ---- rbxmx -----------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let ref = 0;
const referent = () => `RBX${(++ref).toString(16).toUpperCase().padStart(8, '0')}`;

function xmlPart(p) {
  const [r, g, b] = hexToRgb(p.color);
  const color = ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
  const surf = p.studs ? 3 : 0; // 3 = Studs, 0 = Smooth
  const decor = !p.collide;
  return `<Item class="Part" referent="${referent()}"><Properties>`
    + `<string name="Name">${esc(p.name)}</string>`
    + `<bool name="Anchored">true</bool>`
    + `<bool name="CanCollide">${p.collide}</bool>`
    + `<bool name="CanTouch">${!decor}</bool>`
    + `<bool name="CanQuery">${!decor}</bool>`
    + `<bool name="CastShadow">${p.castShadow}</bool>`
    + `<CoordinateFrame name="CFrame"><X>${n3(p.pos[0])}</X><Y>${n3(p.pos[1])}</Y><Z>${n3(p.pos[2])}</Z>`
    + `<R00>1</R00><R01>0</R01><R02>0</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>0</R20><R21>0</R21><R22>1</R22></CoordinateFrame>`
    + `<Color3uint8 name="Color3uint8">${color}</Color3uint8>`
    + `<token name="Material">${MATERIAL[p.mat]}</token>`
    + `<float name="Transparency">${p.transparency}</float>`
    + `<Vector3 name="size"><X>${n3(p.size[0])}</X><Y>${n3(p.size[1])}</Y><Z>${n3(p.size[2])}</Z></Vector3>`
    + ['Top', 'Bottom', 'Front', 'Back', 'Left', 'Right'].map((f) => `<token name="${f}Surface">${surf}</token>`).join('')
    + `</Properties></Item>`;
}

/** Build a nested tree {folders, models, parts} from flat parts */
function tree(parts) {
  const root = { kind: 'Model', children: new Map(), parts: [] };
  const node = (path) => {
    let cur = root;
    for (const seg of path) {
      if (!cur.children.has(seg.name)) cur.children.set(seg.name, { kind: seg.kind, name: seg.name, children: new Map(), parts: [] });
      cur = cur.children.get(seg.name);
    }
    return cur;
  };
  for (const p of parts) {
    const path = p.folder.split('/').map((name) => ({ kind: 'Folder', name }));
    if (p.model) path.push({ kind: 'Model', name: p.model });
    node(path).parts.push(p);
  }
  return root;
}

function xmlNode(n) {
  let s = `<Item class="${n.kind}" referent="${referent()}"><Properties><string name="Name">${esc(n.name)}</string></Properties>`;
  for (const c of n.children.values()) s += xmlNode(c);
  for (const p of n.parts) s += xmlPart(p);
  return s + '</Item>';
}

function rbxmx(stage, parts) {
  ref = 0;
  const t = tree(parts);
  let body = '';
  for (const c of t.children.values()) body += xmlNode(c);
  body += `<Item class="StringValue" referent="${referent()}"><Properties><string name="Name">LightingPreset</string><string name="Value">${stage.lighting}</string></Properties></Item>`;
  body += `<Item class="BoolValue" referent="${referent()}"><Properties><string name="Name">ApplyLighting</string><bool name="Value">true</bool></Properties></Item>`;
  if (FX_SOURCE.includes(']]>')) throw new Error('FX source cannot contain ]]>');
  body += `<Item class="Script" referent="${referent()}"><Properties><string name="Name">StageFX</string><bool name="Disabled">false</bool><token name="RunContext">2</token><ProtectedString name="Source"><![CDATA[${FX_SOURCE}]]></ProtectedString></Properties></Item>`;
  return '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
    + '<External>null</External><External>nil</External>'
    + `<Item class="Model" referent="${referent()}"><Properties><string name="Name">${esc(stage.title)}</string></Properties>${body}</Item></roblox>\n`;
}

// ---- command-bar builder (fallback) ---------------------------------------------
function builder(stage, parts) {
  const paths = [...new Set(parts.map((p) => p.folder + '|' + (p.model || '')))];
  const pIdx = new Map(paths.map((p, i) => [p, i + 1]));
  const rows = parts.map((p) => [
    pIdx.get(p.folder + '|' + (p.model || '')), p.name, p.color.slice(1), p.mat[0] === 'P' ? 'P' : p.mat[0] === 'S' ? 'S' : p.mat[0] === 'N' ? 'N' : 'G',
    p.transparency, p.studs ? 1 : 0, p.collide ? 1 : 0, p.castShadow ? 1 : 0, ...p.pos.map(n3), ...p.size.map(n3),
  ].join(',')).join(';');
  const fxLevel = '='.repeat(4);
  return `-- ${stage.title}: paste everything into the Roblox Studio Command Bar and press Enter.
-- Creates the model in Workspace (same content as ${stage.id}.rbxmx).
local PATHS = {${paths.map((p) => JSON.stringify(p)).join(',')}}
local DATA = "${rows}"
local FX_SOURCE = [${fxLevel}[${FX_SOURCE}]${fxLevel}]
local MAT = { P = Enum.Material.Plastic, S = Enum.Material.SmoothPlastic, N = Enum.Material.Neon, G = Enum.Material.Glass }
local root = Instance.new("Model")
root.Name = ${JSON.stringify(stage.title)}
local cache = {}
local function container(path)
	if cache[path] then return cache[path] end
	local folderPath, model = string.match(path, "^(.-)|(.*)$")
	local cur = root
	for seg in string.gmatch(folderPath, "[^/]+") do
		local nxt = cur:FindFirstChild(seg)
		if not nxt then nxt = Instance.new("Folder"); nxt.Name = seg; nxt.Parent = cur end
		cur = nxt
	end
	if model ~= "" then
		local m = cur:FindFirstChild(model)
		if not m then m = Instance.new("Model"); m.Name = model; m.Parent = cur end
		cur = m
	end
	cache[path] = cur
	return cur
end
for _, row in ipairs(string.split(DATA, ";")) do
	local f = string.split(row, ",")
	local p = Instance.new("Part")
	p.Name = f[2]
	p.Anchored = true
	p.Color = Color3.fromHex(f[3])
	p.Material = MAT[f[4]]
	p.Transparency = tonumber(f[5])
	local surf = (f[6] == "1") and Enum.SurfaceType.Studs or Enum.SurfaceType.Smooth
	p.TopSurface, p.BottomSurface, p.FrontSurface, p.BackSurface, p.LeftSurface, p.RightSurface = surf, surf, surf, surf, surf, surf
	p.CanCollide = f[7] == "1"
	p.CanTouch = f[7] == "1"
	p.CanQuery = f[7] == "1"
	p.CastShadow = f[8] == "1"
	p.Size = Vector3.new(tonumber(f[12]), tonumber(f[13]), tonumber(f[14]))
	p.CFrame = CFrame.new(tonumber(f[9]), tonumber(f[10]), tonumber(f[11]))
	p.Parent = container(PATHS[tonumber(f[1])])
end
local preset = Instance.new("StringValue"); preset.Name = "LightingPreset"; preset.Value = ${JSON.stringify(stage.lighting)}; preset.Parent = root
local apply = Instance.new("BoolValue"); apply.Name = "ApplyLighting"; apply.Value = true; apply.Parent = root
local fx = Instance.new("Script"); fx.Name = "StageFX"; fx.RunContext = Enum.RunContext.Client; fx.Source = FX_SOURCE; fx.Parent = root
root.Parent = workspace
print("Stage built: " .. root.Name .. " (" .. #root:GetDescendants() .. " instances)")
`;
}

// ---- main ---------------------------------------------------------------------------
const summary = [];
for (const make of STAGES) {
  const stage = make();
  const { parts } = stageToParts(stage);
  writeFileSync(join(outDir, `${stage.id}.rbxmx`), rbxmx(stage, parts));
  writeFileSync(join(outDir, `${stage.id}.builder.luau`), builder(stage, parts));
  writeFileSync(join(jsonDir, `${stage.id}.json`), JSON.stringify({
    id: stage.id, title: stage.title, lighting: stage.lighting,
    parts: parts.map((p) => ({ f: p.folder, m: p.model, n: p.name, c: p.color, mat: p.mat, t: p.transparency, st: p.studs ? 1 : 0, p: p.pos.map(n3), s: p.size.map(n3) })),
  }));
  const count = (f) => parts.filter((p) => p.folder.startsWith(f)).length;
  summary.push(`${stage.id.padEnd(6)} parts: ${String(parts.length).padStart(5)}  (Stage ${count('Stage')}, Background ${count('Background')}, FX ${count('FX')})`);
}
console.log(summary.join('\n'));
