import * as THREE from 'three/webgpu';
import { softSprite } from './particleTexture.js';

// Rising steam as an additive Points cloud. Reliable on both the WebGPU and the
// WebGL2 fallback backend; the natural upgrade path is a TSL compute-particle
// system, but this stays light enough for 72–90fps on a Quest.
export class Steam {
  constructor(scene, origin, { count = 90, rate = 1, spread = 0.08, height = 0.7 } = {}) {
    this.origin = origin.clone();
    this.count = count;
    this.rate = rate;
    this.spread = spread;
    this.height = height;
    this._intensity = 0;

    this.positions = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) { this.life[i] = Math.random(); this.seed[i] = Math.random() * 6.283; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      map: softSprite(),
      color: 0xfff4e0,
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.#write();
  }

  // 0 = off, 1 = full boil. Ramps smoothly.
  setIntensity(v) { this._target = v; }

  #write() { this.points.geometry.attributes.position.needsUpdate = true; }

  update(dt, t) {
    this._intensity += ((this._target ?? this._intensity) - this._intensity) * Math.min(dt * 2, 1);
    this.material.opacity = 0.5 * this._intensity;
    if (this._intensity < 0.01) { this.points.visible = false; return; }
    this.points.visible = true;

    for (let i = 0; i < this.count; i++) {
      this.life[i] += dt * (0.35 + 0.25 * this.rate);
      if (this.life[i] > 1) this.life[i] -= 1;
      const l = this.life[i];
      const s = this.seed[i];
      const rise = l * this.height;
      const sway = Math.sin(t * 0.002 + s) * (0.03 + l * this.spread);
      const idx = i * 3;
      this.positions[idx] = this.origin.x + sway + Math.cos(s) * this.spread * l;
      this.positions[idx + 1] = this.origin.y + rise;
      this.positions[idx + 2] = this.origin.z + Math.sin(t * 0.0017 + s) * (0.02 + l * this.spread) + Math.sin(s) * this.spread * l;
    }
    this.#write();
  }
}
