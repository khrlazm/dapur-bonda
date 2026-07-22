import * as THREE from 'three/webgpu';
import { positionLocal, mix, float, clamp, normalize, uniform } from 'three/tsl';

// A gradient sky dome rendered with a TSL node material — the project's WebGPU/
// TSL surface (compiles to WGSL on WebGPU, GLSL on the WebGL2 fallback). Its
// three colours are uniforms so the Environment can retint it for any time of
// day or weather.
export function createSky(scene) {
  const geo = new THREE.SphereGeometry(40, 24, 16);
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.side = THREE.BackSide;
  mat.fog = false;

  const uHorizon = uniform(new THREE.Color(0.98, 0.78, 0.5));
  const uZenith = uniform(new THREE.Color(0.53, 0.62, 0.78));
  const uGround = uniform(new THREE.Color(0.35, 0.26, 0.17));

  const t = clamp(normalize(positionLocal).y.mul(0.5).add(0.5), float(0), float(1));
  const above = mix(uHorizon, uZenith, t.pow(0.6));
  mat.colorNode = mix(uGround, above, clamp(t.mul(6.0), float(0), float(1)));

  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.renderOrder = -1;
  scene.add(sky);

  return {
    mesh: sky,
    // Accepts hex numbers or THREE.Color; the Environment lerps toward these.
    set(horizon, zenith, ground) {
      uHorizon.value.set(horizon);
      uZenith.value.set(zenith);
      uGround.value.set(ground);
    },
    horizon: uHorizon.value,
    zenith: uZenith.value,
    ground: uGround.value,
  };
}
