// Stateless GPU particle emitters: every particle's position is a closed-form
// function of time computed in the vertex shader, so thousands of sparkles,
// petals, mist puffs and fireflies cost nothing on the CPU.
import * as THREE from 'three';
import { globalUniforms } from '../engine/materials.js';
import { mulberry32 } from '../engine/rng.js';

/**
 * @param {object} o
 *  count, min:[x,y,z], max:[x,y,z]  spawn box
 *  vel:[x,y,z], velJitter:[x,y,z]    units / s
 *  gravity                          (negative = falls faster over life)
 *  life:[min,max] seconds
 *  size:[min,max] world units
 *  colors: ['#hex', ...]
 *  sway: amplitude of sinusoidal side motion
 *  shape: 'square' | 'glow' | 'soft'
 *  additive: bool
 *  twinkle: 0..1
 *  spin: bool (rotating square petals)
 */
export function createEmitter(o) {
  const rnd = mulberry32(o.seed || 1);
  const n = o.count;
  const base = new Float32Array(n * 3), vel = new Float32Array(n * 3), misc = new Float32Array(n * 4), col = new Float32Array(n * 3);
  const colors = (o.colors || ['#ffffff']).map((c) => new THREE.Color(c));
  const vj = o.velJitter || [0, 0, 0], v = o.vel || [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      base[i * 3 + a] = o.min[a] + (o.max[a] - o.min[a]) * rnd();
      vel[i * 3 + a] = v[a] + (rnd() - 0.5) * 2 * vj[a];
    }
    const life = o.life[0] + (o.life[1] - o.life[0]) * rnd();
    misc[i * 4] = life;
    misc[i * 4 + 1] = rnd() * life;                         // phase
    misc[i * 4 + 2] = o.size[0] + (o.size[1] - o.size[0]) * rnd();
    misc[i * 4 + 3] = rnd() * 100;                         // seed
    const c = colors[Math.floor(rnd() * colors.length)];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(base, 3));
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  g.setAttribute('aMisc', new THREE.BufferAttribute(misc, 4));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(
    (o.min[0] + o.max[0]) / 2, (o.min[1] + o.max[1]) / 2, (o.min[2] + o.max[2]) / 2), 200);

  const shapeId = { square: 0, glow: 1, soft: 2 }[o.shape || 'square'];
  const mat = new THREE.ShaderMaterial({
    name: 'particles',
    uniforms: {
      uTime: globalUniforms.uTime,
      uGravity: { value: o.gravity || 0 },
      uSway: { value: o.sway || 0 },
      uTwinkle: { value: o.twinkle || 0 },
      uScale: globalUniforms.uPointScale,
      uOpacity: { value: o.opacity ?? 1 },
      uSpin: { value: o.spin ? 1 : 0 },
      uIntensity: { value: o.intensity ?? 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uGravity, uSway, uScale, uTwinkle, uSpin;
      attribute vec3 aVel; attribute vec4 aMisc; attribute vec3 aColor;
      varying vec3 vColor; varying float vAlpha; varying float vRot;
      void main() {
        float life = aMisc.x;
        float age = mod(uTime + aMisc.y, life);
        float t = age / life;
        vec3 p = position + aVel * age + vec3(0.0, 0.5 * uGravity * age * age, 0.0);
        p.x += sin(uTime * 1.3 + aMisc.w) * uSway * t;
        p.z += cos(uTime * 1.1 + aMisc.w * 1.7) * uSway * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aMisc.z * uScale / -mv.z;
        float fade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.7, 1.0, t));
        float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * 7.0 + aMisc.w * 3.0));
        vAlpha = fade * tw;
        vColor = aColor;
        vRot = uSpin * (uTime * 2.0 + aMisc.w);
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity, uIntensity;
      varying vec3 vColor; varying float vAlpha; varying float vRot;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float c = cos(vRot), s = sin(vRot);
        uv = mat2(c, -s, s, c) * uv;
        float a;
        #if ${shapeId} == 0
          a = step(abs(uv.x), 0.32) * step(abs(uv.y), ${o.spin ? '0.2' : '0.32'});
        #elif ${shapeId} == 1
          float d = length(uv);
          a = smoothstep(0.5, 0.0, d);
          a = a * a + step(max(abs(uv.x), abs(uv.y)), 0.12);
        #else
          float d = length(uv);
          a = smoothstep(0.5, 0.1, d);
        #endif
        a *= vAlpha * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * uIntensity, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.name = o.name || 'particles';
  pts.frustumCulled = false;
  pts.userData.noExport = true;
  pts.renderOrder = 5;
  return pts;
}
