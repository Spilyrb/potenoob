// Shared materials for voxel meshes. Animation is injected with onBeforeCompile
// so the very same MeshStandardMaterial still exports cleanly to glTF.
import * as THREE from 'three';

export const globalUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uPointScale: { value: 600 },
};

export function createVoxelMaterials(atlasTexture) {
  const opaque = new THREE.MeshStandardMaterial({
    name: 'voxel_opaque', map: atlasTexture, vertexColors: true, roughness: 0.92, metalness: 0,
  });

  const cutout = new THREE.MeshStandardMaterial({
    name: 'voxel_cutout', map: atlasTexture, vertexColors: true, roughness: 0.9, metalness: 0,
    alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // gentle wind sway for foliage, plants, vines (stronger on upper vertices)
  cutout.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.uWind = globalUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wpSway = modelMatrix * vec4(position, 1.0);
        float swayK = 1.0; // same displacement for coincident vertices -> no cracks
        float sw = sin(uTime * 1.7 + wpSway.x * 0.35 + wpSway.z * 0.27) * 0.06 * uWind * swayK;
        transformed.x += sw;
        transformed.z += cos(uTime * 1.3 + wpSway.x * 0.21) * 0.04 * uWind * swayK;`);
  };
  cutout.customProgramCacheKey = () => 'voxel_cutout_sway';

  const emissive = new THREE.MeshStandardMaterial({
    name: 'voxel_emissive', map: atlasTexture, vertexColors: true, roughness: 0.4, metalness: 0,
    emissive: new THREE.Color(1, 1, 1), emissiveMap: atlasTexture, emissiveIntensity: 1.6,
  });
  // slow pulse so crystals/lanterns feel alive
  emissive.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWpos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWpos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWpos;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= 0.85 + 0.25 * sin(uTime * 2.3 + vWpos.x * 0.7 + vWpos.y * 0.5 + vWpos.z * 0.3);`);
  };
  emissive.customProgramCacheKey = () => 'voxel_emissive_pulse';

  return { opaque, cutout, emissive };
}
