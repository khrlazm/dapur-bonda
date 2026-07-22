import * as THREE from 'three/webgpu';

// A full-view fade-to-black that works in VR as well as on desktop. A DOM
// overlay wouldn't show inside an immersive session, so this is an inward-facing
// black sphere parented to the camera — it surrounds the head and its opacity
// ramps up, holds while the scene is swapped, then ramps back down.
export class Fader {
  constructor(camera) {
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), this.material);
    this.mesh.renderOrder = 999;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    camera.add(this.mesh);

    this.state = 'idle';
    this.t = 0;
    this._mid = null;
    this.outDur = 0.45; this.holdDur = 0.12; this.inDur = 0.7;
  }

  get busy() { return this.state !== 'idle'; }

  // Fade out, run midCb (swap the scene) at full black, then fade back in.
  start(midCb, { outDur = 0.45, holdDur = 0.12, inDur = 0.7 } = {}) {
    if (this.busy) return;
    this.outDur = outDur; this.holdDur = holdDur; this.inDur = inDur;
    this._mid = midCb;
    this.state = 'out';
    this.t = 0;
  }

  update(dt) {
    if (this.state === 'idle') return;
    this.t += dt;
    let o = this.material.opacity;
    if (this.state === 'out') {
      o = Math.min(this.t / this.outDur, 1);
      if (this.t >= this.outDur) {
        o = 1;
        try { this._mid?.(); } catch (e) { console.error(e); }
        this._mid = null; this.state = 'hold'; this.t = 0;
      }
    } else if (this.state === 'hold') {
      o = 1;
      if (this.t >= this.holdDur) { this.state = 'in'; this.t = 0; }
    } else if (this.state === 'in') {
      o = Math.max(1 - this.t / this.inDur, 0);
      if (this.t >= this.inDur) { o = 0; this.state = 'idle'; }
    }
    this.material.opacity = o;
    this.mesh.visible = o > 0.001;
  }
}
