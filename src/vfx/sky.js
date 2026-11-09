// Gradient sky dome with sun glow and two layers of procedural, slowly drifting
// stylised clouds painted directly in the sky shader (the far background).
import * as THREE from 'three';
import { globalUniforms } from '../engine/materials.js';

export function createSky(p) {
  const uniforms = {
    uTime: globalUniforms.uTime,
    uTop: { value: new THREE.Color(p.skyTop) },
    uHorizon: { value: new THREE.Color(p.skyHorizon) },
    uBottom: { value: new THREE.Color(p.skyBottom) },
    uSunDir: { value: new THREE.Vector3(...(p.skySunDir || p.sunDir)).normalize() },
    uSunColor: { value: new THREE.Color(p.sunColor) },
    uCloudColor: { value: new THREE.Color(p.cloudColor) },
    uCloudShade: { value: new THREE.Color(p.cloudShade) },
    uCloudAmount: { value: p.cloudAmount ?? 0.5 },
    uSkyCurve: { value: p.skyCurve ?? 0.85 },
    uSunGlow: { value: p.sunGlow ?? 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'sky',
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uCloudAmount, uSkyCurve, uSunGlow;
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor, uCloudShade;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=noise(p)*a; p*=2.03; a*=0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, uSkyCurve, h), 0.7))
                           : mix(uHorizon, uBottom, smoothstep(0.0, -0.5, h));
        // sun
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(sd, 900.0) * 3.0 + (pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.12) * uSunGlow);
        // painted cumulus band around the horizon (cylindrical mapping)
        float az = atan(d.z, d.x);
        vec2 cp = vec2(az * 3.2 + uTime * 0.004, h * 9.0);
        float band = smoothstep(-0.25, 0.05, h) * (1.0 - smoothstep(0.12, 0.42, h));
        float n = fbm(cp * vec2(1.0, 1.6) + vec2(0.0, -uTime * 0.002));
        // quantise for a chunky voxel / pixel feel
        float cl = smoothstep(0.62 - uCloudAmount * 0.25, 0.75, n) * band;
        cl = floor(cl * 4.0 + 0.5) / 4.0;
        float lit = clamp(0.5 + (fbm(cp * 1.7 + 3.1) - 0.5) * 1.5 + h * 2.0, 0.0, 1.0);
        vec3 cloud = mix(uCloudShade, uCloudColor, lit);
        col = mix(col, cloud, cl * 0.92);
        // high wispy layer
        vec2 hp = d.xz / max(h, 0.08) * 0.6 + vec2(uTime * 0.006, 0.0);
        float w = smoothstep(0.55, 0.8, fbm(hp)) * smoothstep(0.08, 0.35, h) * 0.45;
        col = mix(col, uCloudColor, w);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.noExport = true;
  return mesh;
}
