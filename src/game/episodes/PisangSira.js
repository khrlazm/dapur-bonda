import * as THREE from 'three/webgpu';
import { Liquid } from '../../fx/Pour.js';

// Episode 2 — Sira Pisang. Bananas simmered in gula melaka syrup. Reuses the
// place / pour / stir / glaze / plate vocabulary at the same worktop station the
// previous episode has just torn down.
export class PisangSira {
  constructor(host) {
    this.h = host;
    this.scene = host.scene;
    this.interaction = host.interaction;
    this.kitchen = host.kitchen;
    this.audio = host.audio;
    this.pour = host.pour;
    this.steam = host.steam;

    this.center = host.kitchen.anchors.prep.clone();
    this.boardZone = this.center.clone().add(new THREE.Vector3(-0.3, 0, 0.02));
    this.platingZone = new THREE.Vector3(0.85, host.kitchen.counterTopY + 0.04, -0.66);

    this._objects = [];
    this._grabbables = [];
    this._stirLast = new Map();
    this._onBoard = false;
    this._inPan = false;
    this._plated = false;
    this.portion = null;
  }

  #track(obj, grab = false) { this._objects.push(obj); if (grab) this._grabbables.push(obj); return obj; }
  #xz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
  #inPan(p, extraY = 0.16) {
    return this.#xz(p, this.center) < 0.14 && p.y > this.center.y - 0.02 && p.y < this.center.y + extraY;
  }

  build() {
    const y = this.kitchen.counterTopY + 0.04;

    // Pan (station) with amber syrup inside.
    this.panGroup = new THREE.Group();
    this.panGroup.position.copy(this.center);
    this.scene.add(this.panGroup); this.#track(this.panGroup);
    const pan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.13, 0.05, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x33322f, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide }),
    );
    pan.position.y = 0.025;
    const panBase = new THREE.Mesh(new THREE.CircleGeometry(0.135, 28),
      new THREE.MeshStandardMaterial({ color: 0x26251f, roughness: 0.6, metalness: 0.6 }));
    panBase.rotation.x = -Math.PI / 2; panBase.position.y = 0.001;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.6 }));
    handle.rotation.z = Math.PI / 2; handle.position.set(-0.22, 0.03, 0);
    this.panGroup.add(pan, panBase, handle);
    this.syrup = new Liquid(this.panGroup, { radius: 0.125, color: 0x6b3f16, maxY: 0.035 });
    this.syrup.add(0);

    // Cutting board.
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.18), this.kitchen.mat.woodDark);
    board.position.copy(this.boardZone).setY(y + 0.01);
    this.scene.add(board); this.#track(board);

    // Bananas (grabbable) — placed on the board, then into the pan.
    this.bananaMat = new THREE.MeshPhysicalMaterial({ color: 0xE8C23A, roughness: 0.55, clearcoat: 0.1 });
    this.bananas = this.#bananas();
    this.bananas.position.copy(this.boardZone).setY(y + 0.03).add(new THREE.Vector3(0.02, 0, 0.06));
    this.scene.add(this.bananas);
    this.interaction.register(this.bananas, { onGrab: () => { this._onBoard = false; this._inPan = false; },
      onRelease: () => this.#placeBananas() });
    this.#track(this.bananas, true);

    // Gula melaka syrup jug (grabbable + pourable).
    this.syrupJug = this.#jug(0x5a3316);
    this.syrupJug.position.set(-0.22, y + 0.07, -0.6);
    this.scene.add(this.syrupJug);
    this.interaction.register(this.syrupJug, { pourable: true, home: true, spout: new THREE.Vector3(0.06, 0.02, 0) });
    this.#track(this.syrupJug, true);

    // Wooden spoon (grabbable) — for stirring and glazing.
    this.spoon = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.6 }));
    scoop.rotation.x = Math.PI; scoop.position.y = -0.13; scoop.scale.set(1, 0.5, 1);
    this.spoon.add(sh, scoop);
    this.spoon.position.set(0.15, y + 0.12, -0.66);
    this.scene.add(this.spoon);
    this.interaction.register(this.spoon, { home: true });
    this.#track(this.spoon, true);

    // Serving dish.
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.kitchen.mat.leaf);
    dish.rotation.x = -Math.PI / 2;
    dish.position.copy(this.platingZone).setY(y + 0.001);
    this.scene.add(dish); this.#track(dish);
  }

  #bananas() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.1, 4, 10), this.bananaMat);
      b.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      b.rotation.y = (i - 1) * 0.4;
      b.position.set((i - 1) * 0.03, i * 0.012, (i - 1) * 0.015);
      g.add(b);
    }
    return g;
  }

  #jug(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.13, 20), mat);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.04, 12), mat);
    spout.position.set(0.055, 0.05, 0); spout.rotation.z = -0.7;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI), mat);
    handle.position.set(-0.05, 0.01, 0); handle.rotation.z = -Math.PI / 2;
    g.add(body, spout, handle);
    return g;
  }

  #placeBananas() {
    const p = new THREE.Vector3(); this.bananas.getWorldPosition(p);
    const step = this.h.recipe.steps[this.h.stepIndex]?.id;
    if (step === 'prepare' && this.#xz(p, this.boardZone) < 0.18) {
      this.bananas.position.copy(this.boardZone).setY(this.center.y + 0.03).add(new THREE.Vector3(0.02, 0, 0.06));
      this._onBoard = true;
    } else if (step === 'add' && this.#xz(p, this.center) < 0.16) {
      this.bananas.position.copy(this.center).setY(this.center.y + 0.03);
      this._inPan = true;
    }
    // otherwise it simply stays where you set it down
  }

  enterStep(step) {
    if (step.id === 'syrup') { this.pour.setColor(0x7a4a1a); this.steam.setIntensity(0.35); }
    else if (step.id === 'simmer') this.steam.setIntensity(0.6);
    else if (step.id === 'glaze') this.steam.setIntensity(0.4);
    else if (step.id === 'serve') this.steam.setIntensity(0.15);
    else this.steam.setIntensity(0);
  }

  restore(rec) {
    if (!rec) return;
    if (rec.steps['prepare']) this._onBoard = true;
    if (rec.steps['syrup']) { this.syrup.setColor(0x6b3f16); this.syrup.fill = 0; this.syrup.add(0.7); }
    if (rec.steps['add']) {
      this._inPan = true;
      this.bananas.position.copy(this.center).setY(this.center.y + 0.03);
    }
    if (rec.steps['glaze']) {
      this.bananaMat.color.setHex(0xC98A3A); this.bananaMat.clearcoat = 0.8;
      if (!rec.steps['serve']) this.#spawnPortion();
    }
  }

  onComplete(step) {
    switch (step.id) {
      case 'syrup': this._pourLoop?.stop?.(); this._pourLoop = null; break;
      case 'glaze':
        this.bananaMat.color.setHex(0xC98A3A); this.bananaMat.clearcoat = 0.8;
        this.#spawnPortion();
        break;
    }
  }

  handlePour(obj, dt, spout) {
    const step = this.h.recipe.steps[this.h.stepIndex];
    const overPan = this.#xz(spout, this.center) < 0.15 && spout.y > this.center.y;
    if (obj === this.syrupJug && step?.id === 'syrup' && overPan) {
      this.pour.setColor(0x7a4a1a); this.pour.emit(spout, 2);
      this.syrup.setColor(0x6b3f16); this.syrup.add(dt * 0.5);
      this.h.progress += dt;
      this.steam.setIntensity(0.4);
      if (!this._pourLoop) this._pourLoop = this.audio?.loop('pour');
    }
  }

  detect(step, dt) {
    switch (step.id) {
      case 'prepare': if (this._onBoard) this.h.progress = step.condition.threshold; break;
      case 'syrup': break; // handled in handlePour
      case 'add': if (this._inPan) this.h.progress = step.condition.threshold; break;
      case 'simmer': this.#stir(step); break;
      case 'glaze': this.#glaze(step, dt); break;
      case 'serve': if (this._plated) this.h.progress = step.condition.threshold; break;
    }
  }

  #stir(step) {
    let stirred = 0;
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.spoon) { this._stirLast.delete(hand); continue; }
      const p = hand.worldPos;
      if (!this.#inPan(p, 0.16)) { this._stirLast.delete(hand); continue; }
      const ang = Math.atan2(p.z - this.center.z, p.x - this.center.x);
      const last = this._stirLast.get(hand);
      if (last !== undefined) {
        let d = ang - last;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        stirred += Math.abs(d);
      }
      this._stirLast.set(hand, ang);
      this.interaction.pulse(hand, 0.12, 15);
    }
    if (stirred > 0.02) {
      this.h.progress += stirred;
      if ((this._stSfx = (this._stSfx || 0) + stirred) > 1.2) { this._stSfx = 0; this.audio?.swirl(); }
    }
  }

  #glaze(step, dt) {
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.spoon) continue;
      if (this.#inPan(hand.worldPos, 0.24)) {
        const stroke = hand.velocity.length();
        if (stroke > 0.25) {
          this.h.progress += dt * stroke * 2.0;
          this.interaction.pulse(hand, 0.18, 10);
          const f = Math.min(this.h.progress / step.condition.threshold, 1);
          this.bananaMat.color.lerpColors(new THREE.Color(0xE8C23A), new THREE.Color(0xC98A3A), f);
          this.bananaMat.clearcoat = Math.min(0.8, 0.1 + f * 0.7);
          if ((this._glSfx = (this._glSfx || 0) + dt) > 0.3) { this._glSfx = 0; this.audio?.fluff(); }
        }
      }
    }
  }

  #spawnPortion() {
    if (this.portion) return;
    const portion = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 4, 10), this.bananaMat.clone());
    portion.rotation.z = Math.PI / 2;
    portion.position.copy(this.center).setY(this.center.y + 0.12);
    this.scene.add(portion);
    this.portion = portion; this.#track(portion, true);
    this.interaction.register(portion, {
      onRelease: () => {
        const p = new THREE.Vector3(); portion.getWorldPosition(p);
        if (this.#xz(p, this.platingZone) < 0.16) {
          portion.position.copy(this.platingZone).setY(this.platingZone.y + 0.03);
          this._plated = true;
        } else {
          portion.position.copy(this.center).setY(this.center.y + 0.12);
        }
      },
    });
  }

  teardown() {
    this._pourLoop?.stop?.();
    this.steam.setIntensity(0);
    for (const g of this._grabbables) this.interaction.unregister(g);
    for (const o of this._objects) this.scene.remove(o);
    this._objects = []; this._grabbables = [];
  }
}
