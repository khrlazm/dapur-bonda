import * as THREE from 'three/webgpu';
import { Liquid } from '../../fx/Pour.js';

// Episode 5 — Rendang Ayam. Grind the rempah in the stone mortar, toast it dark
// in the wok, coat the chicken, pour the santan, then reduce low and slow and
// fold in the kerisik. Reuses stir / place / pour / glaze across two stations:
// the wok (centre) and the lesung/mortar (offset).
export class Rendang {
  constructor(host) {
    this.h = host;
    this.scene = host.scene;
    this.interaction = host.interaction;
    this.kitchen = host.kitchen;
    this.audio = host.audio;
    this.pour = host.pour;
    this.steam = host.steam;

    this.center = host.kitchen.anchors.prep.clone();                 // wok
    this.mortarCenter = this.center.clone().add(new THREE.Vector3(-0.34, 0, 0.04));
    this.platingZone = new THREE.Vector3(0.85, host.kitchen.counterTopY + 0.04, -0.66);

    this._objects = [];
    this._grabbables = [];
    this._stirLast = new Map();
    this._chickenIn = false;
    this.portion = null;

    // Sauce colour journey: raw rempah red -> toasted -> creamy santan -> deep
    // brown -> glossy dark.
    this.C = {
      rempah: new THREE.Color(0xb5321f), toasted: new THREE.Color(0x7e2913),
      creamy: new THREE.Color(0xd8a878), brown: new THREE.Color(0x6a3a1c), dark: new THREE.Color(0x3d200f),
    };
  }

  #track(o, grab = false) { this._objects.push(o); if (grab) this._grabbables.push(o); return o; }
  #xz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
  #near(p, c, r = 0.14, extraY = 0.18) { return this.#xz(p, c) < r && p.y > c.y - 0.02 && p.y < c.y + extraY; }

  build() {
    const y = this.kitchen.counterTopY + 0.04;

    // Wok (kuali) — the main station.
    this.wokGroup = new THREE.Group();
    this.wokGroup.position.copy(this.center);
    this.scene.add(this.wokGroup); this.#track(this.wokGroup);
    const wok = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 28, 16, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38),
      new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 0.5, metalness: 0.7 }),
    );
    wok.scale.y = 0.55; wok.position.y = 0.03;
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f1c19, roughness: 0.6, metalness: 0.6 }));
      ear.position.set(s * 0.15, 0.03, 0); ear.rotation.y = Math.PI / 2; this.wokGroup.add(ear);
    }
    this.wokGroup.add(wok);

    this.sauce = new Liquid(this.wokGroup, { radius: 0.13, color: 0xb5321f, maxY: 0.03 });
    this.sauce.mesh.visible = false;

    // Chicken (grabbable cluster) — placed into the wok, then cooks in place.
    this.chickenMat = new THREE.MeshStandardMaterial({ color: 0xe8b8a0, roughness: 0.6 });
    this.chicken = this.#chicken();
    this.chicken.position.set(-0.92, y + 0.03, -0.62);
    this.scene.add(this.chicken);
    this.interaction.register(this.chicken, { onRelease: () => this.#placeChicken() });
    this.#track(this.chicken, true);

    // Stone mortar (lesung) + pestle, for grinding the rempah.
    this.mortarGroup = new THREE.Group();
    this.mortarGroup.position.copy(this.mortarCenter);
    this.scene.add(this.mortarGroup); this.#track(this.mortarGroup);
    const mortar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.07, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: 0x555049, roughness: 0.9 }),
    );
    mortar.position.y = 0.04;
    const rempahMat = new THREE.MeshStandardMaterial({ color: 0xc23a22, roughness: 0.5 });
    this.rempahBit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), rempahMat);
    this.rempahBit.position.y = 0.07;
    this.mortarGroup.add(mortar, this.rempahBit);

    this.pestle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0x555049, roughness: 0.9 }));
    this.pestle.position.set(this.mortarCenter.x + 0.12, y + 0.12, this.mortarCenter.z);
    this.scene.add(this.pestle);
    this.interaction.register(this.pestle, { home: true });
    this.#track(this.pestle, true);

    // Wooden spoon (wok stirring / glazing).
    this.spoon = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.6 }));
    sc.rotation.x = Math.PI; sc.position.y = -0.14; sc.scale.set(1, 0.5, 1);
    this.spoon.add(sh, sc);
    this.spoon.position.set(0.15, y + 0.12, -0.66);
    this.scene.add(this.spoon);
    this.interaction.register(this.spoon, { home: true });
    this.#track(this.spoon, true);

    // Santan jug (pourable).
    this.santan = this.#jug(0xf3efe6);
    this.santan.position.set(-0.05, y + 0.07, -0.58);
    this.scene.add(this.santan);
    this.interaction.register(this.santan, { pourable: true, home: true, spout: new THREE.Vector3(0.06, 0.02, 0) });
    this.#track(this.santan, true);

    // Serving dish (banana leaf).
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.kitchen.mat.leaf);
    dish.rotation.x = -Math.PI / 2;
    dish.position.copy(this.platingZone).setY(y + 0.001);
    this.scene.add(dish); this.#track(dish);
  }

  #chicken() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), this.chickenMat);
      p.scale.set(1.2, 0.8, 1);
      p.position.set((i % 2 - 0.5) * 0.06, 0.02 + (i > 1 ? 0.03 : 0), ((i >> 1) - 0.5) * 0.06);
      g.add(p);
    }
    return g;
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

  enterStep(step) {
    if (step.id === 'santan') this.pour.setColor(0xf6efdd);
    if (step.id === 'saute' || step.id === 'slowcook') this.steam.setIntensity(0.5);
    else if (step.id === 'finish') this.steam.setIntensity(0.3);
    else this.steam.setIntensity(0);
  }

  restore() {}

  onComplete(step) {
    switch (step.id) {
      case 'blend': this.sauce.mesh.visible = true; this.sauce.setColor(this.C.rempah.getHex()); this.rempahBit.visible = false; break;
      case 'saute': this.sauce.setColor(this.C.toasted.getHex()); break;
      case 'santan': this._pourLoop?.stop?.(); this._pourLoop = null; break;
      case 'slowcook': this.sauce.setColor(this.C.brown.getHex()); this.chickenMat.color.setHex(0x7a4a28); break;
      case 'finish':
        this.sauce.setColor(this.C.dark.getHex()); this.sauce.material.clearcoat = 0.5;
        this.chickenMat.color.setHex(0x5a3418);
        this.#spawnPortion(); // plated on the banana leaf, garnished
        break;
    }
  }

  handlePour(obj, dt, spout) {
    const step = this.h.recipe.steps[this.h.stepIndex];
    const overWok = this.#xz(spout, this.center) < 0.16 && spout.y > this.center.y;
    if (obj === this.santan && step?.id === 'santan' && overWok) {
      this.pour.setColor(0xf6efdd); this.pour.emit(spout, 2);
      const f = Math.min(this.h.progress, 1);
      this.sauce.material.color.lerpColors(this.C.toasted, this.C.creamy, f);
      this.h.progress += dt;
      this.steam.setIntensity(0.4);
      if (!this._pourLoop) this._pourLoop = this.audio?.loop('pour');
    }
  }

  detect(step, dt) {
    switch (step.id) {
      case 'blend': this.#stir(step, this.mortarCenter, this.pestle, 'pestle'); break;
      case 'saute': this.#stir(step, this.center, this.spoon, 'toast'); break;
      case 'chicken': if (this._chickenIn) this.h.progress = step.condition.threshold; break;
      case 'santan': break;
      case 'slowcook': this.#stir(step, this.center, this.spoon, 'reduce'); break;
      case 'finish': this.#glaze(step, dt); break;
    }
  }

  #stir(step, c, tool, phase) {
    let stirred = 0;
    for (const hand of this.interaction.hands) {
      if (hand.held !== tool) { this._stirLast.delete(hand); continue; }
      const p = hand.worldPos;
      if (!this.#near(p, c, 0.15)) { this._stirLast.delete(hand); continue; }
      const ang = Math.atan2(p.z - c.z, p.x - c.x);
      const last = this._stirLast.get(hand);
      if (last !== undefined) { let dd = ang - last; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2; stirred += Math.abs(dd); }
      this._stirLast.set(hand, ang);
      this.interaction.pulse(hand, 0.12, 15);
    }
    if (stirred > 0.02) {
      this.h.progress += stirred;
      const f = Math.min(this.h.progress / step.condition.threshold, 1);
      if (phase === 'pestle') this.rempahBit.scale.setScalar(1 - f * 0.4);
      else if (phase === 'toast') this.sauce.material.color.lerpColors(this.C.rempah, this.C.toasted, f);
      else if (phase === 'reduce') this.sauce.material.color.lerpColors(this.C.creamy, this.C.brown, f);
      if ((this._sfx = (this._sfx || 0) + stirred) > 1.2) { this._sfx = 0; this.audio?.swirl(); }
    }
  }

  #glaze(step, dt) {
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.spoon) continue;
      if (this.#near(hand.worldPos, this.center, 0.15, 0.24)) {
        const stroke = hand.velocity.length();
        if (stroke > 0.24) {
          this.h.progress += dt * stroke * 2.0;
          this.interaction.pulse(hand, 0.18, 10);
          const f = Math.min(this.h.progress / step.condition.threshold, 1);
          this.sauce.material.color.lerpColors(this.C.brown, this.C.dark, f);
          this.sauce.material.clearcoat = f * 0.5;
          if ((this._gsfx = (this._gsfx || 0) + dt) > 0.3) { this._gsfx = 0; this.audio?.fluff(); }
        }
      }
    }
  }

  #placeChicken() {
    const p = new THREE.Vector3(); this.chicken.getWorldPosition(p);
    const step = this.h.recipe.steps[this.h.stepIndex]?.id;
    if (step === 'chicken' && this.#xz(p, this.center) < 0.17) {
      this.chicken.position.copy(this.center).setY(this.center.y + 0.03);
      this.chickenMat.color.setHex(0xcaa070); // coated in rempah
      this._chickenIn = true;
    }
  }

  #spawnPortion() {
    if (this.portion) return;
    const portion = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: 0x4a2c14, roughness: 0.35, clearcoat: 0.5 }));
      p.scale.set(1.2, 0.8, 1); p.position.set((i - 1) * 0.05, 0.02, 0);
      portion.add(p);
    }
    portion.position.copy(this.platingZone).setY(this.platingZone.y + 0.03);
    this.scene.add(portion); this.portion = portion; this.#track(portion);
  }

  teardown() {
    this._pourLoop?.stop?.();
    this.steam.setIntensity(0);
    for (const g of this._grabbables) this.interaction.unregister(g);
    for (const o of this._objects) this.scene.remove(o);
    this._objects = []; this._grabbables = [];
  }
}
