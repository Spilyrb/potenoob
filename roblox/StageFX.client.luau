--[[
	StageFX  (Script, RunContext = Client)
	Visual-only animations and effects for a generated voxel stage.
	Runs on every client, so moving parts never costs network or server time.

	It looks inside the stage model for:
	  FX/Spin_*       rigid rotation around the Pivot part (windmill sails)
	  FX/Swing_*      pendulum swing around the Pivot (hanging crate, rope platform)
	  FX/Bob_*        gentle floating up and down (background islands, debris)
	  FX/Cloud_*      slow drift along X, wrapping around
	  FX/Flag_*       cloth waving, pinned at the pole (Pivot)
	  FX/Banner_*     cloth hanging from the top edge, swaying
	  FX/Sail_*       billowing sail
	  FX/Waterfall_*  layers scrolling down and fading out
	  FX/Emit_<Type>  ParticleEmitter in that box: Sparkles, Mist, Splash
	  FX/Drift_<Type> voxel particles in that box: Petals, Wind, Dust, Embers
	  any part named "Lantern" / "Crystal" gets a flickering PointLight
	The StringValue "LightingPreset" (day | sunset) and BoolValue "ApplyLighting"
	control the Lighting / Atmosphere / Clouds setup.
]]

local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")

local stage = script.Parent
local fx = stage:WaitForChild("FX", 10)
if not fx then
	return
end

local function getOrMake(className, parent, name)
	local inst = parent:FindFirstChild(name)
	if not inst then
		inst = Instance.new(className)
		inst.Name = name
		inst.Parent = parent
	end
	return inst
end

-- Lighting --------------------------------------------------------------------
local presetValue = stage:FindFirstChild("LightingPreset")
local PRESET = presetValue and presetValue.Value or "day"
local applyValue = stage:FindFirstChild("ApplyLighting")
local APPLY = (applyValue == nil) or applyValue.Value

if APPLY then
	local atm = getOrMake("Atmosphere", Lighting, "StageAtmosphere")
	local cc = getOrMake("ColorCorrectionEffect", Lighting, "StageColor")
	local bloom = getOrMake("BloomEffect", Lighting, "StageBloom")
	if PRESET == "sunset" then
		Lighting.ClockTime = 17.7
		Lighting.Brightness = 2.4
		Lighting.Ambient = Color3.fromRGB(125, 95, 135)
		Lighting.OutdoorAmbient = Color3.fromRGB(200, 150, 175)
		atm.Density = 0.3
		atm.Offset = 0.12
		atm.Color = Color3.fromRGB(255, 176, 165)
		atm.Decay = Color3.fromRGB(150, 95, 175)
		atm.Glare = 0.7
		atm.Haze = 1.3
		cc.Saturation = 0.22
		cc.Contrast = 0.06
		cc.TintColor = Color3.fromRGB(255, 238, 238)
	else
		Lighting.ClockTime = 13.5
		Lighting.Brightness = 3
		Lighting.Ambient = Color3.fromRGB(115, 125, 145)
		Lighting.OutdoorAmbient = Color3.fromRGB(175, 190, 210)
		atm.Density = 0.2
		atm.Offset = 0.05
		atm.Color = Color3.fromRGB(195, 240, 255)
		atm.Decay = Color3.fromRGB(105, 205, 255)
		atm.Glare = 0.15
		atm.Haze = 0.5
		cc.Saturation = 0.3
		cc.Contrast = 0.06
		cc.TintColor = Color3.fromRGB(250, 255, 255)
	end
	bloom.Intensity = 0.55
	bloom.Size = 24
	bloom.Threshold = 0.95
	Lighting.GlobalShadows = true
	local terrain = workspace:FindFirstChildOfClass("Terrain")
	if terrain then
		local clouds = terrain:FindFirstChildOfClass("Clouds") or getOrMake("Clouds", terrain, "Clouds")
		clouds.Cover = (PRESET == "sunset") and 0.62 or 0.55
		clouds.Density = 0.7
		clouds.Color = (PRESET == "sunset") and Color3.fromRGB(255, 205, 225) or Color3.fromRGB(255, 255, 255)
	end
end

-- helpers ---------------------------------------------------------------------
local function phaseOf(name)
	local h = 0
	for i = 1, #name do
		h = (h * 31 + string.byte(name, i)) % 1009
	end
	return h / 1009 * math.pi * 2
end

local function partsOf(model, skip)
	local list = {}
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") and d ~= skip then
			table.insert(list, d)
		end
	end
	return list
end

local function pivotCFrame(model)
	local p = model:FindFirstChild("Pivot")
	if p and p:IsA("BasePart") then
		return p.CFrame, p
	end
	return model:GetPivot(), nil
end

-- rigid animators (one transform for the whole model) ---------------------------------
local rigid = {}
local function addRigid(model, fn)
	local base = pivotCFrame(model)
	local parts = partsOf(model)
	local offsets = {}
	for i, p in ipairs(parts) do
		offsets[i] = base:ToObjectSpace(p.CFrame)
	end
	table.insert(rigid, { base = base, parts = parts, offsets = offsets, fn = fn, cfs = {} })
end

-- cloth -----------------------------------------------------------------------------------
local cloths = {}
local function addCloth(model, kind, ph)
	local base, pivotPart = pivotCFrame(model)
	local items, parts = {}, {}
	local maxD, maxX = 0.001, 0.001
	for _, p in ipairs(partsOf(model, pivotPart)) do
		local rel = base:PointToObjectSpace(p.Position)
		local d = (kind == "Flag") and rel.X or -rel.Y
		maxD = math.max(maxD, d)
		maxX = math.max(maxX, math.abs(rel.X))
		table.insert(items, { cf = p.CFrame, d = d, x = rel.X })
		table.insert(parts, p)
	end
	table.insert(cloths, { kind = kind, items = items, parts = parts, maxD = maxD, maxX = maxX, ph = ph, cfs = {} })
end

-- waterfalls -------------------------------------------------------------------------------
local falls = {}
local function addWaterfall(model)
	local base, pivotPart = pivotCFrame(model)
	local topY = base.Position.Y
	local items, parts = {}, {}
	local minY = math.huge
	for _, p in ipairs(partsOf(model, pivotPart)) do
		minY = math.min(minY, p.Position.Y - p.Size.Y / 2)
		table.insert(items, { cf = p.CFrame, phase = topY - p.Position.Y, baseT = p.Transparency, part = p })
		table.insert(parts, p)
	end
	local height = math.max(4, topY - minY)
	table.insert(falls, { items = items, parts = parts, height = height, cfs = {} })
end

-- particle emitters --------------------------------------------------------------------------
local function emitterFor(region, kind)
	local att = Instance.new("Attachment")
	att.Parent = region
	local e = Instance.new("ParticleEmitter")
	e.Shape = Enum.ParticleEmitterShape.Box
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	e.SpreadAngle = Vector2.new(180, 180)
	e.LockedToPart = false
	if kind == "Sparkles" then
		e.Color = ColorSequence.new(Color3.fromRGB(140, 245, 255), Color3.fromRGB(255, 255, 255))
		e.LightEmission = 1
		e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.3, 0.45), NumberSequenceKeypoint.new(1, 0) })
		e.Lifetime = NumberRange.new(1.2, 2.4)
		e.Speed = NumberRange.new(0.5, 1.5)
		e.Rate = 22
		e.Acceleration = Vector3.new(0, 1, 0)
	elseif kind == "Mist" then
		e.Texture = "rbxasset://textures/particles/smoke_main.dds"
		e.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
		e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.25, 0.55), NumberSequenceKeypoint.new(1, 1) })
		e.Size = NumberSequence.new(3, 8)
		e.Lifetime = NumberRange.new(2, 3.5)
		e.Speed = NumberRange.new(1, 3)
		e.Rate = 12
		e.Acceleration = Vector3.new(0, 1.5, 0)
	else -- Splash
		e.Texture = "rbxasset://textures/particles/smoke_main.dds"
		e.Color = ColorSequence.new(Color3.fromRGB(230, 250, 255))
		e.Transparency = NumberSequence.new(0.2, 1)
		e.Size = NumberSequence.new(1.2, 0.2)
		e.Lifetime = NumberRange.new(0.5, 1)
		e.Speed = NumberRange.new(3, 6)
		e.Rate = 30
		e.Acceleration = Vector3.new(0, -30, 0)
	end
	e.Parent = region
	-- the box shape follows the part size
	region.Transparency = 1
end

-- voxel drift particles (tiny client-side parts) ------------------------------------------------
local DRIFT = {
	Petals = { count = 70, size = 0.7, flat = true, colors = { Color3.fromRGB(255, 170, 205), Color3.fromRGB(255, 205, 225), Color3.fromRGB(255, 140, 190) }, vel = Vector3.new(2.5, -3, 1), life = 9, sway = 3, spin = 2, mat = Enum.Material.SmoothPlastic },
	Wind = { count = 45, size = 0.5, flat = false, colors = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(160, 230, 90) }, vel = Vector3.new(28, 0, 0), life = 6, sway = 1.5, spin = 3, mat = Enum.Material.SmoothPlastic },
	Dust = { count = 30, size = 0.4, flat = false, colors = { Color3.fromRGB(255, 225, 170), Color3.fromRGB(230, 210, 180) }, vel = Vector3.new(0, 0.6, 1.5), life = 7, sway = 1, spin = 1, mat = Enum.Material.SmoothPlastic },
	Embers = { count = 60, size = 0.45, flat = false, colors = { Color3.fromRGB(255, 200, 110), Color3.fromRGB(255, 150, 90), Color3.fromRGB(255, 240, 190) }, vel = Vector3.new(1, 1.6, 0), life = 8, sway = 2, spin = 1.5, mat = Enum.Material.Neon },
}
local drifts = {}
local function addDrift(region, kind)
	local cfg = DRIFT[kind]
	if not cfg then
		return
	end
	region.Transparency = 1
	local folder = Instance.new("Folder")
	folder.Name = "DriftParts_" .. kind
	folder.Parent = fx
	local list = { cfg = cfg, items = {}, parts = {}, cfs = {} }
	local half = region.Size / 2
	for i = 1, cfg.count do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanTouch = false
		p.CanQuery = false
		p.CastShadow = false
		p.Material = cfg.mat
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.Color = cfg.colors[(i % #cfg.colors) + 1]
		p.Size = cfg.flat and Vector3.new(cfg.size, cfg.size * 0.25, cfg.size) or Vector3.new(cfg.size, cfg.size, cfg.size)
		local start = region.Position + Vector3.new((math.random() * 2 - 1) * half.X, (math.random() * 2 - 1) * half.Y, (math.random() * 2 - 1) * half.Z)
		p.CFrame = CFrame.new(start)
		p.Parent = folder
		table.insert(list.items, { start = start, seed = math.random() * 100, life = cfg.life * (0.7 + math.random() * 0.6) })
		table.insert(list.parts, p)
	end
	table.insert(drifts, list)
end

-- lights on lanterns / crystals ---------------------------------------------------------------------
local lights = {}
local MAX_LIGHTS = 14
for _, d in ipairs(stage:GetDescendants()) do
	if #lights >= MAX_LIGHTS then
		break
	end
	if d:IsA("BasePart") and (d.Name == "Lantern" or (d.Name == "Crystal" and #lights < MAX_LIGHTS - 4)) then
		local l = Instance.new("PointLight")
		local lantern = d.Name == "Lantern"
		l.Color = lantern and Color3.fromRGB(255, 190, 110) or Color3.fromRGB(110, 230, 255)
		l.Range = lantern and 16 or 10
		l.Brightness = lantern and 1.6 or 1
		l.Shadows = false
		l.Parent = d
		table.insert(lights, { light = l, base = l.Brightness, ph = math.random() * 10 })
	end
end

-- collect FX -----------------------------------------------------------------------------------------
for _, child in ipairs(fx:GetChildren()) do
	local kind, sub = string.match(child.Name, "^(%a+)_(.+)$")
	local ph = phaseOf(child.Name)
	if child:IsA("Model") then
		if kind == "Spin" then
			addRigid(child, function(t)
				return CFrame.Angles(0, 0, -t * 0.9)
			end)
		elseif kind == "Swing" then
			addRigid(child, function(t)
				return CFrame.Angles(math.sin(t * 1.1 + ph) * 0.1, 0, math.sin(t * 0.9 + ph) * 0.22)
			end)
		elseif kind == "Bob" then
			addRigid(child, function(t)
				return CFrame.new(0, math.sin(t * 0.6 + ph) * 1.6, 0) * CFrame.Angles(0, 0, math.sin(t * 0.4 + ph) * 0.03)
			end)
		elseif kind == "Cloud" then
			local speed = 1.5 + (ph % 1.5)
			addRigid(child, function(t)
				local x = ((t * speed + ph * 60) % 480) - 240
				return CFrame.new(x, 0, 0)
			end)
		elseif kind == "Flag" or kind == "Banner" or kind == "Sail" then
			addCloth(child, kind, ph)
		elseif kind == "Waterfall" then
			addWaterfall(child)
		end
	elseif child:IsA("BasePart") then
		if kind == "Emit" then
			emitterFor(child, sub)
		elseif kind == "Drift" then
			addDrift(child, sub)
		end
	end
end

-- per-frame update ---------------------------------------------------------------------------------
local BULK = Enum.BulkMoveMode.FireCFrameChanged
local t0 = os.clock()

RunService.RenderStepped:Connect(function()
	local t = os.clock() - t0

	for _, r in ipairs(rigid) do
		local xf = r.base * r.fn(t)
		for i, off in ipairs(r.offsets) do
			r.cfs[i] = xf * off
		end
		workspace:BulkMoveTo(r.parts, r.cfs, BULK)
	end

	for _, c in ipairs(cloths) do
		for i, it in ipairs(c.items) do
			local k = it.d / c.maxD
			local dz
			if c.kind == "Flag" then
				dz = math.sin(t * 6 - it.d * 0.35 + c.ph) * 1.1 * k
			elseif c.kind == "Banner" then
				dz = math.sin(t * 2.4 - it.d * 0.25 + c.ph) * 0.7 * k
			else
				local u = math.abs(it.x) / c.maxX
				dz = -math.sin(math.pi * k) * (1 - u * u * 0.6) * (2.2 + math.sin(t * 0.8 + c.ph) * 0.5) + math.sin(t * 3 - it.x * 0.3) * 0.25 * k
			end
			c.cfs[i] = it.cf + Vector3.new(0, 0, dz)
		end
		workspace:BulkMoveTo(c.parts, c.cfs, BULK)
	end

	for _, f in ipairs(falls) do
		for i, it in ipairs(f.items) do
			local drop = (it.phase + t * 14) % f.height
			f.cfs[i] = it.cf + Vector3.new(0, it.phase - drop, 0)
			local k = drop / f.height
			it.part.Transparency = it.baseT + (1 - it.baseT) * (k ^ 3)
		end
		workspace:BulkMoveTo(f.parts, f.cfs, BULK)
	end

	for _, d in ipairs(drifts) do
		local cfg = d.cfg
		for i, it in ipairs(d.items) do
			local age = (t + it.seed) % it.life
			local pos = it.start + cfg.vel * age + Vector3.new(math.sin(t * 1.3 + it.seed) * cfg.sway, 0, math.cos(t * 1.1 + it.seed) * cfg.sway)
			d.cfs[i] = CFrame.new(pos) * CFrame.Angles(t * cfg.spin + it.seed, t * cfg.spin * 0.7, 0)
			local k = age / it.life
			d.parts[i].Transparency = (k < 0.1) and (1 - k * 10) or ((k > 0.85) and ((k - 0.85) / 0.15) or 0)
		end
		workspace:BulkMoveTo(d.parts, d.cfs, BULK)
	end

	for _, l in ipairs(lights) do
		l.light.Brightness = l.base * (0.85 + 0.1 * math.sin(t * 9 + l.ph) + 0.05 * math.sin(t * 23 + l.ph * 2))
	end
end)
