import * as THREE from 'three/webgpu';
import { softSprite } from './particleTexture.js';

// A pooled stream of droplets emitted from a tilted vessel's spout, plus a
// Liquid helper that raises a fill surface inside a bowl as you pour.
export class Pour {
  constructor(scene, { pool = 220 } = {}) {
    this.pool = pool;
    this.positions = new Float32Array(pool * 3);
    this.vel = new Float32Array(pool * 3);
    this.life = new Float32Array(pool);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      map: softSprite(),
      color: 0xf6efdd,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    });
    for (let i = 0; i < pool; i++) this.life[i] = 0;
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._tmp = new THREE.Vector3();
  }

  setColor(hex) { this.material.color.setHex(hex); }

  emit(worldPos, amount = 2) {
    for (let n = 0; n < amount; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.pool;
      const idx = i * 3;
      this.positions[idx] = worldPos.x + (Math.random() - 0.5) * 0.01;
      this.positions[idx + 1] = worldPos.y;
      this.positions[idx + 2] = worldPos.z + (Math.random() - 0.5) * 0.01;
      this.vel[idx] = (Math.random() - 0.5) * 0.05;
      this.vel[idx + 1] = -0.2 - Math.random() * 0.1;
      this.vel[idx + 2] = (Math.random() - 0.5) * 0.05;
      this.life[i] = 0.6;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.pool; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const idx = i * 3;
      this.vel[idx + 1] -= 2.4 * dt; // gravity
      this.positions[idx] += this.vel[idx] * dt;
      this.positions[idx + 1] += this.vel[idx + 1] * dt;
      this.positions[idx + 2] += this.vel[idx + 2] * dt;
      if (this.positions[idx + 1] < 0.9) this.life[i] = 0; // splash out near counter
    }
    this.points.visible = any;
    if (any) this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// A liquid fill surface that lives inside a container mesh.
export class Liquid {
  constructor(parent, { radius = 0.09, color = 0xbfe0ef, maxY = 0.06 } = {}) {
    this.max = maxY;
    this.fill = 0;
    this.material = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.15, metalness: 0, transmission: 0.2,
      transparent: true, opacity: 0.9, clearcoat: 0.5,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, 0.001, 28), this.material);
    this.mesh.position.y = 0.006;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  setColor(hex) { this.material.color.setHex(hex); }

  add(amount) {
    this.fill = THREE.MathUtils.clamp(this.fill + amount, 0, 1);
    const h = this.fill * this.max;
    this.mesh.scale.y = Math.max(h / 0.001, 0.001);
    this.mesh.position.y = 0.006 + h / 2;
    this.mesh.visible = this.fill > 0.001;
    return this.fill;
  }

  drain(amount) { return this.add(-amount); }
}
