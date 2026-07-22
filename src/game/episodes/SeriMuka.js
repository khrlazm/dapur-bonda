import * as THREE from 'three/webgpu';
import { Liquid } from '../../fx/Pour.js';

// Episode 4 — Kuih Seri Muka. Two layers: press the steamed glutinous rice into
// a firm base, whisk the pandan custard, pour it over and steam to a silky top.
// Reuses swirl / steam / glaze(press) / stir(whisk) / pour / plate, with a
// second station (the custard bowl) offset from the rice.
export class SeriMuka {
  constructor(host) {
    this.h = host;
    this.scene = host.scene;
    this.interaction = host.interaction;
    this.kitchen = host.kitchen;
    this.audio = host.audio;
    this.pour = host.pour;
    this.steam = host.steam;

    this.center = host.kitchen.anchors.prep.clone();               // rice / tray
    this.custardCenter = this.center.clone().add(new THREE.Vector3(-0.34, 0, 0.04));
    this.platingZone = new THREE.Vector3(0.85, host.kitchen.counterTopY + 0.04, -0.66);

    this._objects = [];
    this._grabbables = [];
    this._swirlLast = new Map();
    this._stirLast = new Map();
    this._plated = false;
    this.portion = null;
  }

  #track(o, grab = false) { this._objects.push(o); if (grab) this._grabbables.push(o); return o; }
  #xz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
  #inBowl(p, c, extraY = 0.16) {
    return this.#xz(p, c) < 0.14 && p.y > c.y - 0.02 && p.y < c.y + extraY;
  }

  build() {
    const y = this.kitchen.counterTopY + 0.04;

    // Rice tray (the base layer forms here).
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

    // The green custard top layer that appears on the rice as you pour.
    this.topMat = new THREE.MeshPhysicalMaterial({ color: 0x7bbf4a, roughness: 0.25, clearcoat: 0.7 });
    this.topLayer = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.02, 24), this.topMat);
    this.topLayer.position.y = 0.03;
    this.topLayer.scale.set(1, 0.001, 1);
    this.topLayer.visible = false;
    this.bowlGroup.add(this.topLayer);

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

    // Press paddle (flattens the rice) and whisk (for the custard).
    this.paddle = this.#tool(0xb98a52, 'box');
    this.paddle.position.set(0.15, y + 0.12, -0.66);
    this.scene.add(this.paddle);
    this.interaction.register(this.paddle, { home: true });
    this.#track(this.paddle, true);

    this.whisk = this.#tool(0xd8d8de, 'whisk');
    this.whisk.position.set(-0.05, y + 0.12, -0.6);
    this.scene.add(this.whisk);
    this.interaction.register(this.whisk, { home: true });
    this.#track(this.whisk, true);

    // Custard bowl (offset) — whisk here, then grab + pour it over the rice.
    this.custardGroup = new THREE.Group();
    this.custardGroup.position.copy(this.custardCenter);
    this.scene.add(this.custardGroup); this.#track(this.custardGroup, true);
    const cbowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 24, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshPhysicalMaterial({ color: 0xf3efe6, roughness: 0.3, clearcoat: 0.4 }),
    );
    cbowl.scale.y = 0.7;
    this.custardGroup.add(cbowl);
    this.custard = new Liquid(this.custardGroup, { radius: 0.085, color: 0x9ccb6a, maxY: 0.04 });
    this.custard.add(0.6);
    this.interaction.register(this.custardGroup, {
      pourable: true, home: true, spout: new THREE.Vector3(0.08, 0.02, 0),
    });

    // Serving dish.
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.kitchen.mat.leaf);
    dish.rotation.x = -Math.PI / 2;
    dish.position.copy(this.platingZone).setY(y + 0.001);
    this.scene.add(dish); this.#track(dish);
  }

  #tool(color, kind) {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    g.add(h);
    if (kind === 'box') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.01),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      blade.position.y = -0.14; g.add(blade);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 });
      for (let i = 0; i < 5; i++) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.002, 6, 12, Math.PI), mat);
        w.rotation.y = (i / 5) * Math.PI; w.position.y = -0.14; g.add(w);
      }
    }
    return g;
  }

  enterStep(step) {
    if (step.id === 'wash') { this.water.setColor(0xcbd3c8); this.water.fill = 0; this.water.add(0.7); }
    else if (step.id === 'pour') this.pour.setColor(0x9ccb6a);
    else this.steam.setIntensity(step.id === 'steam' ? 0 : 0);
  }

  restore() {}

  onComplete(step) {
    switch (step.id) {
      case 'wash': this.water.fill = 0; this.water.add(-1); break;
      case 'steam': this._sizzleLoop?.stop?.(); this._sizzleLoop = null; this.steam.setIntensity(0.15); this.riceMat.color.setHex(0xf6f1e6); break;
      case 'press': this.rice.scale.set(1.25, 0.35, 1.25); break; // pressed into a firm layer
      case 'pour':
        this._pourLoop?.stop?.(); this._pourLoop = null;
        this.topLayer.scale.set(1, 1, 1);
        this.#spawnPortion(); // the finished two-layer kuih, ready to plate
        break;
      case 'serve': break;
    }
  }

  handlePour(obj, dt, spout) {
    const step = this.h.recipe.steps[this.h.stepIndex];
    const overRice = this.#xz(spout, this.center) < 0.14 && spout.y > this.center.y;
    if (obj === this.custardGroup && step?.id === 'pour' && overRice) {
      this.pour.setColor(0x9ccb6a); this.pour.emit(spout, 2);
      this.custard.drain(dt * 0.4);
      this.topLayer.visible = true;
      const f = Math.min(this.h.progress, 1);
      this.topLayer.scale.set(1, Math.max(0.05, f), 1);
      this.h.progress += dt;
      if (!this._pourLoop) this._pourLoop = this.audio?.loop('pour');
    }
  }

  detect(step, dt) {
    switch (step.id) {
      case 'wash': this.#swirl(step, this.center, this._swirlLast); break;
      case 'steam': this.#steamStep(step, dt); break;
      case 'press': this.#press(step, dt); break;
      case 'whisk': this.#stir(step, this.custardCenter); break;
      case 'pour': break;
      case 'serve': if (this._plated) this.h.progress = step.condition.threshold; break;
    }
  }

  #swirl(step, c, mem) {
    let swirled = 0;
    for (const hand of this.interaction.hands) {
      const p = hand.worldPos;
      if (!this.#inBowl(p, c, 0.14)) { mem.delete(hand); continue; }
      const ang = Math.atan2(p.z - c.z, p.x - c.x);
      const last = mem.get(hand);
      if (last !== undefined) { let dd = ang - last; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2; swirled += Math.abs(dd); }
      mem.set(hand, ang);
      this.interaction.pulse(hand, 0.12, 15);
    }
    if (swirled > 0.02) {
      this.h.progress += swirled;
      const f = Math.min(this.h.progress / step.condition.threshold, 1);
      this.water.material.color.lerpColors(new THREE.Color(0xcbd3c8), new THREE.Color(0xdfe8df), f);
      this.rice.rotation.y += swirled * 0.5;
      if ((this._swSfx = (this._swSfx || 0) + swirled) > 1.2) { this._swSfx = 0; this.audio?.swirl(); }
    }
  }

  #stir(step, c) {
    let stirred = 0;
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.whisk) { this._stirLast.delete(hand); continue; }
      const p = hand.worldPos;
      if (!this.#inBowl(p, c, 0.18)) { this._stirLast.delete(hand); continue; }
      const ang = Math.atan2(p.z - c.z, p.x - c.x);
      const last = this._stirLast.get(hand);
      if (last !== undefined) { let dd = ang - last; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2; stirred += Math.abs(dd); }
      this._stirLast.set(hand, ang);
      this.interaction.pulse(hand, 0.12, 15);
    }
    if (stirred > 0.02) {
      this.h.progress += stirred;
      const f = Math.min(this.h.progress / step.condition.threshold, 1);
      this.custard.material.color.lerpColors(new THREE.Color(0x9ccb6a), new THREE.Color(0x7bbf4a), f);
      if ((this._stSfx = (this._stSfx || 0) + stirred) > 1.2) { this._stSfx = 0; this.audio?.swirl(); }
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
      this.riceMat.roughness = 0.8 - f * 0.25; this.riceMat.clearcoat = f * 0.4;
    } else {
      this.steam.setIntensity(0);
      this._sizzleLoop?.stop?.(); this._sizzleLoop = null;
    }
  }

  #press(step, dt) {
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.paddle) continue;
      if (this.#inBowl(hand.worldPos, this.center, 0.24)) {
        const stroke = hand.velocity.length();
        if (stroke > 0.22) {
          this.h.progress += dt * stroke * 2.0;
          this.interaction.pulse(hand, 0.2, 12);
          const f = Math.min(this.h.progress / step.condition.threshold, 1);
          this.rice.scale.set(1 + f * 0.25, 1 - f * 0.65, 1 + f * 0.25); // flatten into a layer
          if ((this._prSfx = (this._prSfx || 0) + dt) > 0.3) { this._prSfx = 0; this.audio?.fluff(); }
        }
      }
    }
  }

  #spawnPortion() {
    if (this.portion) return;
    const portion = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.08), this.riceMat.clone());
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), this.topMat.clone());
    top.position.y = 0.042; base.position.y = 0;
    portion.add(base, top);
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
