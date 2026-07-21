import * as THREE from 'three/webgpu';
import { positionLocal, mix, vec3, float, clamp, normalize } from 'three/tsl';

// A warm golden-hour sky gradient rendered with a TSL node material — this is
// the project's WebGPU/TSL surface. It compiles to WGSL on the WebGPU backend
// and to GLSL on the WebGL2 fallback, so the same code path lights both.
export function createSky(scene) {
  const geo = new THREE.SphereGeometry(40, 24, 16);
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.side = THREE.BackSide;
  mat.fog = false;

  // Normalized height of the fragment on the dome: 0 at horizon, 1 at zenith.
  const t = clamp(normalize(positionLocal).y.mul(0.5).add(0.5), float(0), float(1));

  const horizon = vec3(0.98, 0.78, 0.5);   // hazy warm horizon
  const zenith = vec3(0.53, 0.62, 0.78);   // soft morning blue
  const ground = vec3(0.35, 0.26, 0.17);   // below-horizon warmth

  const above = mix(horizon, zenith, t.pow(0.6));
  mat.colorNode = mix(ground, above, clamp(t.mul(6.0), float(0), float(1)));

  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  scene.add(sky);
  return sky;
}
