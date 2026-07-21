import * as THREE from 'three/webgpu';
import { Liquid } from '../../fx/Pour.js';

// Episode 1 — Pulut Kuning. Owns its props and the per-step gesture detection;
// it accumulates the host's progress and the host handles step advancement,
// the book, saving, and completion side-effects via onComplete().
export class PulutKuning {
  constructor(host) {
    this.h = host;
    this.scene = host.scene;
    this.interaction = host.interaction;
    this.kitchen = host.kitchen;
    this.audio = host.audio;
    this.pour = host.pour;
    this.steam = host.steam;

    this.center = host.kitchen.anchors.prep.clone();
    this.platingZone = new THREE.Vector3(0.85, host.kitchen.counterTopY + 0.04, -0.66);

    this._objects = [];
    this._grabbables = [];
    this._swirlLast = new Map();
    this._plated = false;
    this.portion = null;
  }

  #track(obj, grab = false) { this._objects.push(obj); if (grab) this._grabbables.push(obj); return obj; }
  #xz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
  #inBowl(p, extraY = 0.14) {
    return this.#xz(p, this.center) < 0.13 && p.y > this.center.y - 0.02 && p.y < this.center.y + extraY;
  }

  // ---------- Props ----------
  build() {
    const y = this.kitchen.counterTopY + 0.04;

    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.copy(this.center);
    this.scene.add(this.bowlGroup);
    this.#track(this.bowlGroup);

    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 28, 18, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }),
    );
    bowl.scale.y = 0.7;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.118, 0.008, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a5aa8, roughness: 0.4 }),
    );
    rim.rotation.x = Math.PI / 2;
    this.bowlGroup.add(bowl, rim);

    this.riceMat = new THREE.MeshPhysicalMaterial({ color: 0xefe9d8, roughness: 0.8, clearcoat: 0.0 });
    this.rice = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), this.riceMat);
    this.rice.position.y = 0.002;
    this.bowlGroup.add(this.rice);

    this.water = new Liquid(this.bowlGroup, { radius: 0.1, color: 0xcdd6cf, maxY: 0.05 });
    this.water.add(0);

    this.turmeric = this.#jar(0xE8A317, 0.03, 0.08);
    this.turmeric.position.set(-0.9, y + 0.05, -0.62);
    this.scene.add(this.turmeric);
    this.interaction.register(this.turmeric, { home: true });
    this.#track(this.turmeric, true);

    this.santan = this.#jug();
    this.santan.position.set(-0.22, y + 0.07, -0.6);
    this.scene.add(this.santan);
    this.interaction.register(this.santan, { pourable: true, home: true, spout: new THREE.Vector3(0.06, 0.02, 0) });
    this.#track(this.santan, true);

    this.lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xcfcfd4, roughness: 0.35, metalness: 0.7 }),
    );
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.6 }));
    knob.position.y = 0.14; this.lid.add(knob);
    this.lid.position.set(0.32, y + 0.14, -0.85);
    this.scene.add(this.lid);
    this.interaction.register(this.lid, { home: true });
    this.#track(this.lid, true);

    this.paddle = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.008),
      new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.6 }));
    blade.position.y = -0.14; this.paddle.add(handle, blade);
    this.paddle.position.set(0.15, y + 0.12, -0.66);
    this.scene.add(this.paddle);
    this.interaction.register(this.paddle, { home: true });
    this.#track(this.paddle, true);

    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.kitchen.mat.leaf);
    dish.rotation.x = -Math.PI / 2;
    dish.position.copy(this.platingZone).setY(y + 0.001);
    this.scene.add(dish);
    this.#track(dish);
  }

  #jar(color, r, h) {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })),
    );
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.015, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.6 }));
    cap.position.y = h / 2; g.add(cap);
    return g;
  }

  #jug() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.13, 20),
      new THREE.MeshPhysicalMaterial({ color: 0xf3efe6, roughness: 0.3, clearcoat: 0.5 }));
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.04, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xf3efe6, roughness: 0.3 }));
    spout.position.set(0.055, 0.05, 0); spout.rotation.z = -0.7;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.3 }));
    handle.position.set(-0.05, 0.01, 0); handle.rotation.z = -Math.PI / 2;
    g.add(body, spout, handle);
    return g;
  }

  // ---------- Lifecycle ----------
  enterStep(step) {
    if (step.id === 'wash') { this.water.setColor(0xcbd3c8); this.water.fill = 0; this.water.add(0.7); }
    if (step.id === 'turmeric') this.pour.setColor(0xE8A317);
    if (step.id === 'santan') this.pour.setColor(0xf6efdd);
  }

  restore(rec) {
    if (!rec) return;
    if (rec.steps['turmeric']) this.riceMat.color.setHex(0xf2c531);
    if (rec.steps['steam']) { this.riceMat.color.setHex(0xf1c02a); this.riceMat.roughness = 0.6; }
    if (rec.steps['fluff']) {
      this.riceMat.color.setHex(0xf4c936); this.riceMat.roughness = 0.45; this.riceMat.clearcoat = 0.5;
      this.rice.scale.setScalar(1.06);
      if (!rec.steps['plate']) this.#spawnPortion();
    }
  }

  onComplete(step) {
    switch (step.id) {
      case 'wash': this.water.fill = 0; this.water.add(-1); break;
      case 'santan': this._pourLoop?.stop?.(); this._pourLoop = null; break;
      case 'steam': this._sizzleLoop?.stop?.(); this._sizzleLoop = null; this.steam.setIntensity(0.15); break;
      case 'fluff': this.riceMat.color.setHex(0xf4c936); this.#spawnPortion(); break;
    }
  }

  handlePour(obj, dt, spout) {
    const step = this.h.recipe.steps[this.h.stepIndex];
    const overBowl = this.#xz(spout, this.center) < 0.14 && spout.y > this.center.y;
    if (obj === this.santan && step?.id === 'santan' && overBowl) {
      this.pour.emit(spout, 2);
      this.water.setColor(0xf3ead2);
      this.water.add(dt * 0.5);
      this.h.progress += dt;
      if (!this._pourLoop) this._pourLoop = this.audio?.loop('pour');
    }
  }

  // ---------- Detection ----------
  detect(step, dt) {
    switch (step.id) {
      case 'wash': this.#swirl(step); break;
      case 'turmeric': this.#sprinkle(step, dt); break;
      case 'santan': break; // handled in handlePour
      case 'steam': this.#steamStep(step, dt); break;
      case 'fluff': this.#fluff(step, dt); break;
      case 'plate': if (this._plated) this.h.progress = step.condition.threshold; break;
    }
  }

  #swirl(step) {
    let swirled = 0;
    for (const hand of this.interaction.hands) {
      const p = hand.worldPos;
      if (!this.#inBowl(p, 0.14)) { this._swirlLast.delete(hand); continue; }
      const ang = Math.atan2(p.z - this.center.z, p.x - this.center.x);
      const last = this._swirlLast.get(hand);
      if (last !== undefined) {
        let d = ang - last;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        swirled += Math.abs(d);
      }
      this._swirlLast.set(hand, ang);
      this.interaction.pulse(hand, 0.12, 15);
    }
    if (swirled > 0.02) {
      this.h.progress += swirled;
      const f = Math.min(this.h.progress / step.condition.threshold, 1);
      this.water.material.color.lerpColors(new THREE.Color(0xcbd3c8), new THREE.Color(0xdfe8df), f);
      this.rice.rotation.y += swirled * 0.5;
      if ((this._swirlSfx = (this._swirlSfx || 0) + swirled) > 1.2) { this._swirlSfx = 0; this.audio?.swirl(); }
    }
  }

  #sprinkle(step, dt) {
    let sprinkling = false;
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.turmeric) continue;
      const p = new THREE.Vector3(); this.turmeric.getWorldPosition(p);
      const above = this.#xz(p, this.center) < 0.14 && p.y > this.center.y + 0.03;
      if (above && hand.velocity.length() > 0.15) {
        sprinkling = true;
        this.pour.setColor(0xE8A317); this.pour.emit(p, 1);
        this.h.progress += dt;
        const f = Math.min(this.h.progress / step.condition.threshold, 1);
        this.riceMat.color.lerpColors(new THREE.Color(0xefe9d8), new THREE.Color(0xf2c531), f);
        this.interaction.pulse(hand, 0.1, 12);
      }
    }
    if (sprinkling && (this._sprSfx = (this._sprSfx || 0) + dt) > 0.25) { this._sprSfx = 0; this.audio?.sprinkle(); }
  }

  #steamStep(step, dt) {
    const lp = new THREE.Vector3(); this.lid.getWorldPosition(lp);
    const covering = this.#xz(lp, this.center) < 0.1 && lp.y < this.center.y + 0.16 && lp.y > this.center.y;
    if (covering) {
      this.steam.setIntensity(1);
      if (!this._sizzleLoop) this._sizzleLoop = this.audio?.loop('sizzle');
      this.h.progress += dt;
      const f = Math.min(this.h.progress / step.condition.threshold, 1);
      this.riceMat.color.lerpColors(new THREE.Color(0xf2c531), new THREE.Color(0xf1c02a), f);
      this.riceMat.roughness = 0.8 - f * 0.2;
    } else {
      this.steam.setIntensity(0);
      this._sizzleLoop?.stop?.(); this._sizzleLoop = null;
    }
  }

  #fluff(step, dt) {
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.paddle) continue;
      if (this.#inBowl(hand.worldPos, 0.26)) {
        const stroke = hand.velocity.length();
        if (stroke > 0.25) {
          this.h.progress += dt * stroke * 2.2;
          this.interaction.pulse(hand, 0.2, 10);
          this.rice.scale.setScalar(1 + Math.min(this.h.progress / step.condition.threshold, 1) * 0.08);
          this.riceMat.roughness = Math.max(0.45, this.riceMat.roughness - dt * 0.2);
          this.riceMat.clearcoat = Math.min(0.5, this.riceMat.clearcoat + dt * 0.3);
          if ((this._flSfx = (this._flSfx || 0) + dt) > 0.3) { this._flSfx = 0; this.audio?.fluff(); }
        }
      }
    }
  }

  #spawnPortion() {
    if (this.portion) return;
    const portion = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 20), this.riceMat.clone());
    portion.position.copy(this.center).setY(this.center.y + 0.12);
    this.scene.add(portion);
    this.portion = portion;
    this.#track(portion, true);
    this.interaction.register(portion, {
      onRelease: () => {
        const p = new THREE.Vector3(); portion.getWorldPosition(p);
        if (this.#xz(p, this.platingZone) < 0.16) {
          portion.position.copy(this.platingZone).setY(this.platingZone.y + 0.04);
          this._plated = true;
        } else {
          portion.position.copy(this.center).setY(this.center.y + 0.12);
        }
      },
    });
  }

  teardown() {
    this._pourLoop?.stop?.(); this._sizzleLoop?.stop?.();
    this.steam.setIntensity(0);
    for (const g of this._grabbables) this.interaction.unregister(g);
    for (const o of this._objects) this.scene.remove(o);
    this._objects = []; this._grabbables = [];
  }
}
