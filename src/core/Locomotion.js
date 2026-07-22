import * as THREE from 'three/webgpu';

// VR locomotion driven by the controller thumbsticks:
//   Left stick  — smooth horizontal movement across the kitchen, relative to
//                 where you're looking (yaw only, y locked).
//   Right stick — snap turn in fixed increments (comfort option that avoids the
//                 nausea of smooth rotation).
// The rig is kept inside a gentle bounding box so you can't walk through walls.
export class Locomotion {
  constructor(engine, {
    speed = 1.35,
    snapAngle = THREE.MathUtils.degToRad(30),
    // The whole kitchen is walkable (explorable hub); the counter band along
    // the back is kept out of reach by minZ so you can't clip through it.
    bounds = { minX: -2.0, maxX: 2.0, minZ: -0.28, maxZ: 1.9 },
  } = {}) {
    this.renderer = engine.renderer;
    this.rig = engine.rig;
    this.camera = engine.camera;
    this.speed = speed;
    this.snapAngle = snapAngle;
    this.bounds = bounds;
    this._snapReady = true;

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._head = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  update(dt) {
    if (!this.renderer.xr.isPresenting) return;
    const session = this.renderer.xr.getSession?.();
    if (!session) return;

    let moveX = 0, moveY = 0, turnX = 0;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp || !gp.axes) continue;
      // xr-standard: axes[2],[3] are the thumbstick; older mappings use [0],[1].
      const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
      const y = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
      if (src.handedness === 'left') { moveX = x; moveY = y; }
      else if (src.handedness === 'right') { turnX = x; }
    }

    const dead = 0.15;

    // ---- smooth move (left stick) ----
    if (Math.abs(moveX) > dead || Math.abs(moveY) > dead) {
      this.camera.getWorldDirection(this._fwd);
      this._fwd.y = 0;
      if (this._fwd.lengthSq() > 1e-5) this._fwd.normalize();
      this._right.crossVectors(this._fwd, this._up).normalize(); // points to the player's right
      this._move.set(0, 0, 0)
        .addScaledVector(this._right, Math.abs(moveX) > dead ? moveX : 0)
        .addScaledVector(this._fwd, Math.abs(moveY) > dead ? -moveY : 0); // stick up = forward
      if (this._move.lengthSq() > 0) {
        this._move.normalize().multiplyScalar(this.speed * dt);
        const b = this.bounds;
        this.rig.position.x = THREE.MathUtils.clamp(this.rig.position.x + this._move.x, b.minX, b.maxX);
        this.rig.position.z = THREE.MathUtils.clamp(this.rig.position.z + this._move.z, b.minZ, b.maxZ);
      }
    }

    // ---- snap turn (right stick) ----
    if (Math.abs(turnX) > 0.7) {
      if (this._snapReady) {
        this._snapReady = false;
        this.#snap(turnX > 0 ? -this.snapAngle : this.snapAngle);
      }
    } else if (Math.abs(turnX) < 0.3) {
      this._snapReady = true;
    }
  }

  // Rotate the rig about the vertical axis through the head so the player pivots
  // in place rather than being flung sideways.
  #snap(angle) {
    this.camera.getWorldPosition(this._head);
    const v = new THREE.Vector3().subVectors(this.rig.position, this._head);
    v.applyAxisAngle(this._up, angle);
    this.rig.position.copy(this._head).add(v);
    this.rig.rotation.y += angle;
  }
}
