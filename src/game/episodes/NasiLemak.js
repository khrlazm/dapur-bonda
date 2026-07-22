import * as THREE from 'three/webgpu';
import { Liquid } from '../../fx/Pour.js';

// Episode 3 — Nasi Lemak. Coconut rice, a spoonful of sambal, and its garnishes.
// Reuses swirl (wash) / pour (santan) / steam / glaze (sambal) / place (garnish)
// / plate at the central bowl station.
export class NasiLemak {
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
    this._garnished = false;
    this._plated = false;
    this.portion = null;
  }

  #track(o, grab = false) { this._objects.push(o); if (grab) this._grabbables.push(o); return o; }
  #xz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
  #inBowl(p, extraY = 0.16) {
    return this.#xz(p, this.center) < 0.14 && p.y > this.center.y - 0.02 && p.y < this.center.y + extraY;
  }

  build() {
    const y = this.kitchen.counterTopY + 0.04;

    // Bowl + rice + wash water.
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.copy(this.center);
    this.scene.add(this.bowlGroup); this.#track(this.bowlGroup);
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 28, 18, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }),
    );
    bowl.scale.y = 0.7;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.008, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a5aa8, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    this.bowlGroup.add(bowl, rim);

    this.riceMat = new THREE.MeshPhysicalMaterial({ color: 0xefe9d8, roughness: 0.8, clearcoat: 0.0 });
    this.rice = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), this.riceMat);
    this.rice.position.y = 0.002;
    this.bowlGroup.add(this.rice);

    this.water = new Liquid(this.bowlGroup, { radius: 0.1, color: 0xcdd6cf, maxY: 0.05 });
    this.water.add(0);

    // Sambal blob on the rice (revealed during the glaze step).
    this.sambalMat = new THREE.MeshPhysicalMaterial({ color: 0x9c2314, roughness: 0.35, clearcoat: 0.6 });
    this.sambal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), this.sambalMat);
    this.sambal.position.set(0.02, 0.06, 0.02);
    this.sambal.scale.setScalar(0.001);
    this.sambal.visible = false;
    this.bowlGroup.add(this.sambal);

    // Santan jug (pourable).
    this.santan = this.#jug(0xf3efe6);
    this.santan.position.set(-0.22, y + 0.07, -0.6);
    this.scene.add(this.santan);
    this.interaction.register(this.santan, { pourable: true, home: true, spout: new THREE.Vector3(0.06, 0.02, 0) });
    this.#track(this.santan, true);

    // Steamer lid.
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

    // Sambal spoon (tool for the glaze).
    this.spoon = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x9c2314, roughness: 0.5 }));
    scoop.rotation.x = Math.PI; scoop.position.y = -0.13; scoop.scale.set(1, 0.5, 1);
    this.spoon.add(sh, scoop);
    this.spoon.position.set(0.15, y + 0.12, -0.66);
    this.scene.add(this.spoon);
    this.interaction.register(this.spoon, { home: true });
    this.#track(this.spoon, true);

    // Garnish cluster (grabbable) — placed into the bowl.
    this.garnish = this.#garnishCluster();
    this.garnish.position.set(-0.9, y + 0.03, -0.62);
    this.scene.add(this.garnish);
    this.interaction.register(this.garnish, { onRelease: () => this.#placeGarnish() });
    this.#track(this.garnish, true);

    // Serving dish.
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.kitchen.mat.leaf);
    dish.rotation.x = -Math.PI / 2;
    dish.position.copy(this.platingZone).setY(y + 0.001);
    this.scene.add(dish); this.#track(dish);
  }

  #jug(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.13, 20), mat);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.04, 12), mat);
    spout.position.set(0.055, 0.05, 0); spout.rotation.z = -0.7;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI), mat);
    handle.position.set(-0.05, 0.01, 0); handle.rotation.z = -Math.PI / 2;
    g.add(body, spout, handle);
    return g;
  }

  #garnishCluster() {
    const g = new THREE.Group();
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xfdfdf5, roughness: 0.4 }));
    egg.scale.set(1, 0.8, 1); egg.position.set(0, 0.02, 0);
    const yolk = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1b419, roughness: 0.5 }));
    yolk.rotation.x = -Math.PI / 2; yolk.position.set(0, 0.045, 0);
    g.add(egg, yolk);
    for (let i = 0; i < 4; i++) { // peanuts
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xcaa06a, roughness: 0.6 }));
      p.position.set(-0.05 + Math.random() * 0.1, 0.008, 0.04 + Math.random() * 0.02);
      g.add(p);
    }
    for (let i = 0; i < 3; i++) { // cucumber slices
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 12),
        new THREE.MeshStandardMaterial({ color: 0x8fbf5a, roughness: 0.5 }));
      c.position.set(0.04 + i * 0.006, 0.006, -0.04); c.rotation.z = 0.2;
      g.add(c);
    }
    return g;
  }

  enterStep(step) {
    if (step.id === 'wash') { this.water.setColor(0xcbd3c8); this.water.fill = 0; this.water.add(0.7); }
    else if (step.id === 'santan') this.pour.setColor(0xf6efdd);
    else if (step.id === 'steam') this.steam.setIntensity(0);
    else this.steam.setIntensity(step.id === 'sambal' ? 0.15 : 0);
  }

  restore(rec) {
    if (!rec) return;
    if (rec.steps['santan']) { this.riceMat.color.setHex(0xf7f2e4); }
    if (rec.steps['steam']) { this.riceMat.roughness = 0.55; this.riceMat.clearcoat = 0.4; }
    if (rec.steps['sambal']) { this.sambal.visible = true; this.sambal.scale.setScalar(1); }
    if (rec.steps['garnish']) { this._garnished = true; this.#spawnPortion(); }
  }

  onComplete(step) {
    switch (step.id) {
      case 'wash': this.water.fill = 0; this.water.add(-1); break;
      case 'santan': this._pourLoop?.stop?.(); this._pourLoop = null; break;
      case 'steam': this._sizzleLoop?.stop?.(); this._sizzleLoop = null; this.steam.setIntensity(0.15); break;
      case 'garnish': this.#spawnPortion(); break;
    }
  }

  handlePour(obj, dt, spout) {
    const step = this.h.recipe.steps[this.h.stepIndex];
    const overBowl = this.#xz(spout, this.center) < 0.14 && spout.y > this.center.y;
    if (obj === this.santan && step?.id === 'santan' && overBowl) {
      this.pour.setColor(0xf6efdd); this.pour.emit(spout, 2);
      this.water.setColor(0xf3ead2); this.water.add(dt * 0.5);
      this.riceMat.color.lerpColors(new THREE.Color(0xefe9d8), new THREE.Color(0xf7f2e4), Math.min(this.h.progress, 1));
      this.h.progress += dt;
      if (!this._pourLoop) this._pourLoop = this.audio?.loop('pour');
    }
  }

  detect(step, dt) {
    switch (step.id) {
      case 'wash': this.#swirl(step); break;
      case 'santan': break;
      case 'steam': this.#steamStep(step, dt); break;
      case 'sambal': this.#glaze(step, dt); break;
      case 'garnish': if (this._garnished) this.h.progress = step.condition.threshold; break;
      case 'serve': if (this._plated) this.h.progress = step.condition.threshold; break;
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

  #steamStep(step, dt) {
    const lp = new THREE.Vector3(); this.lid.getWorldPosition(lp);
    const covering = this.#xz(lp, this.center) < 0.1 && lp.y < this.center.y + 0.16 && lp.y > this.center.y;
    if (covering) {
      this.steam.setIntensity(1);
      if (!this._sizzleLoop) this._sizzleLoop = this.audio?.loop('sizzle');
      this.h.progress += dt;
      const f = Math.min(this.h.progress / step.condition.threshold, 1);
      this.riceMat.roughness = 0.8 - f * 0.25;
      this.riceMat.clearcoat = f * 0.4;
    } else {
      this.steam.setIntensity(0);
      this._sizzleLoop?.stop?.(); this._sizzleLoop = null;
    }
  }

  #glaze(step, dt) {
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.spoon) continue;
      if (this.#inBowl(hand.worldPos, 0.24)) {
        const stroke = hand.velocity.length();
        if (stroke > 0.25) {
          this.h.progress += dt * stroke * 2.0;
          this.interaction.pulse(hand, 0.18, 10);
          const f = Math.min(this.h.progress / step.condition.threshold, 1);
          this.sambal.visible = true;
          this.sambal.scale.setScalar(Math.max(0.15, f));
          if ((this._glSfx = (this._glSfx || 0) + dt) > 0.3) { this._glSfx = 0; this.audio?.fluff(); }
        }
      }
    }
  }

  #placeGarnish() {
    const p = new THREE.Vector3(); this.garnish.getWorldPosition(p);
    const step = this.h.recipe.steps[this.h.stepIndex]?.id;
    if (step === 'garnish' && this.#xz(p, this.center) < 0.18) {
      this.garnish.position.copy(this.center).setY(this.center.y + 0.05);
      this._garnished = true;
    }
  }

  #spawnPortion() {
    if (this.portion) return;
    const portion = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 20), this.riceMat.clone());
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), this.sambalMat.clone());
    top.position.y = 0.045;
    portion.add(cone, top);
    portion.position.copy(this.center).setY(this.center.y + 0.12);
    this.scene.add(portion);
    this.portion = portion; this.#track(portion, true);
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
