import * as THREE from 'three/webgpu';
import { Steam } from '../fx/Steam.js';
import { Pour, Liquid } from '../fx/Pour.js';

// The cooking simulator: it spawns the interactive props for Pulut Kuning,
// registers them for grabbing/pouring, and runs a linear state machine over the
// recipe steps. Each step watches a physical gesture (swirl, sprinkle, pour,
// steam, fluff, plate), and on completion it advances the book, plays a memory
// line, saves progress, and gives a haptic nudge. No timers on the player, no
// failure — you simply move forward when the food is ready.
export class CookingSim {
  constructor({ engine, kitchen, book, hud, audio, recipe, save }) {
    this.engine = engine;
    this.scene = engine.scene;
    this.interaction = engine.interaction;
    this.kitchen = kitchen;
    this.book = book;
    this.hud = hud;
    this.audio = audio;
    this.recipe = recipe;
    this.save = save;

    this.bowlCenter = kitchen.anchors.prep.clone();
    this.platingZone = new THREE.Vector3(0.85, kitchen.counterTopY + 0.04, -0.66);

    this.stepIndex = 0;
    this.progress = 0;
    this._swirlLast = new Map();
    this._pourLoop = null;
    this._sizzleLoop = null;

    this.pour = new Pour(this.scene);
    this.steam = new Steam(this.scene, this.bowlCenter.clone().setY(this.bowlCenter.y + 0.08), { count: 80 });

    this.#buildProps();
    this.interaction.onPour = (o, dt, spout) => this.#handlePour(o, dt, spout);

    this.#restore();
    this.#enterStep(this.stepIndex);
  }

  // ---------- Props ----------
  #buildProps() {
    const y = this.kitchen.counterTopY + 0.04;

    // Bowl station (not grabbed) holding the rice + wash water.
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.copy(this.bowlCenter);
    this.scene.add(this.bowlGroup);

    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 28, 18, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }),
    );
    bowl.scale.y = 0.7;
    bowl.castShadow = true; bowl.receiveShadow = true;
    // blue-and-white rim motif
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.118, 0.008, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a5aa8, roughness: 0.4 }),
    );
    rim.rotation.x = Math.PI / 2;
    this.bowlGroup.add(bowl, rim);

    // Rice mound.
    this.riceMat = new THREE.MeshPhysicalMaterial({ color: 0xefe9d8, roughness: 0.8, clearcoat: 0.0 });
    this.rice = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      this.riceMat,
    );
    this.rice.position.y = 0.002;
    this.rice.castShadow = true;
    this.bowlGroup.add(this.rice);

    // Wash water inside the bowl.
    this.water = new Liquid(this.bowlGroup, { radius: 0.1, color: 0xcdd6cf, maxY: 0.05 });
    this.water.add(0); // starts empty until wash step fills it

    // Turmeric shaker (grabbable).
    this.turmeric = this.#jar(0xE8A317, 0.03, 0.08);
    this.turmeric.position.set(-0.9, y + 0.05, -0.62);
    this.scene.add(this.turmeric);
    this.interaction.register(this.turmeric, { home: true });

    // Santan jug (grabbable + pourable).
    this.santan = this.#jug();
    this.santan.position.set(-0.22, y + 0.07, -0.6);
    this.scene.add(this.santan);
    this.interaction.register(this.santan, {
      pourable: true, home: true, spout: new THREE.Vector3(0.06, 0.02, 0),
    });

    // Steamer lid (grabbable dome).
    this.lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xcfcfd4, roughness: 0.35, metalness: 0.7 }),
    );
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.6 }));
    knob.position.y = 0.14;
    this.lid.add(knob);
    this.lid.position.set(0.32, y + 0.14, -0.85);
    this.lid.castShadow = true;
    this.scene.add(this.lid);
    this.interaction.register(this.lid, { home: true });

    // Wooden fluffing paddle (grabbable tool).
    this.paddle = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.008),
      new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.6 }));
    blade.position.y = -0.14;
    this.paddle.add(handle, blade);
    this.paddle.position.set(0.15, y + 0.12, -0.66);
    this.paddle.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.paddle);
    this.interaction.register(this.paddle, { home: true });

    // Banana-leaf plating dish (target).
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.kitchen.mat.leaf);
    dish.rotation.x = -Math.PI / 2;
    dish.position.copy(this.platingZone).setY(y + 0.001);
    this.scene.add(dish);
  }

  #jar(color, r, h) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.015, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.6 }));
    cap.position.y = h / 2;
    g.add(body, cap);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
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
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---------- Step lifecycle ----------
  #restore() {
    const rec = this.save.load().recipes[this.recipe.id];
    if (!rec) return;
    let idx = 0;
    for (let i = 0; i < this.recipe.steps.length; i++) {
      if (rec.steps[this.recipe.steps[i].id]) idx = i + 1; else break;
    }
    this.stepIndex = Math.min(idx, this.recipe.steps.length - 1);
    // reflect visual state for restored progress
    if (rec.steps['turmeric']) this.riceMat.color.setHex(0xf2c531);
    if (rec.steps['steam']) { this.riceMat.color.setHex(0xf1c02a); this.riceMat.roughness = 0.6; }
    if (rec.steps['fluff']) { this.riceMat.roughness = 0.45; this.riceMat.clearcoat = 0.5; this.rice.scale.setScalar(1.06); }
    this.book.draw(rec, this.stepIndex);
  }

  #enterStep(i) {
    this.progress = 0;
    const step = this.recipe.steps[i];
    if (!step) return;
    this.hud.setStep(i + 1, step.title, step.instruction);
    // set up per-step affordances
    if (step.id === 'wash') { this.water.setColor(0xcbd3c8); this.water.fill = 0; this.water.add(0.7); }
    if (step.id === 'turmeric') this.pour.setColor(0xE8A317);
    if (step.id === 'santan') this.pour.setColor(0xf6efdd);
  }

  #complete(i) {
    const step = this.recipe.steps[i];
    this.save.markStep(this.recipe.id, step.id);
    this.save.addMemory(step.memory);
    const rec = this.save.load().recipes[this.recipe.id];
    this.book.draw(rec, Math.min(i + 1, this.recipe.steps.length - 1), step.memory);
    this.hud.toast(step.memory);
    this.audio?.ding();
    for (const h of this.interaction.hands) this.interaction.pulse(h, 0.7, 60);

    if (i + 1 >= this.recipe.steps.length) {
      this.save.markRecipeComplete(this.recipe.id);
      this.hud.setStep('✓', 'Selamat menjamu selera', this.recipe.closing);
      this.done = true;
    } else {
      this.stepIndex = i + 1;
      this.#enterStep(this.stepIndex);
    }
  }

  // ---------- Pour routing ----------
  #handlePour(obj, dt, spout) {
    const overBowl = this.#xzDist(spout, this.bowlCenter) < 0.14 && spout.y > this.bowlCenter.y;
    const step = this.recipe.steps[this.stepIndex];
    if (obj === this.santan && step?.id === 'santan' && overBowl) {
      this.pour.emit(spout, 2);
      this.water.setColor(0xf3ead2);
      this.water.add(dt * 0.5);
      this.progress += dt;
      this.#sizzleOff();
      if (!this._pourLoop) this._pourLoop = this.audio?.loop('pour');
      if (this.progress >= step.condition.threshold) { this.#stopPourLoop(); this.#complete(this.stepIndex); }
    }
  }

  #stopPourLoop() { this._pourLoop?.stop?.(); this._pourLoop = null; }
  #sizzleOff() {}

  // ---------- Per-frame gesture detection ----------
  update(dt, t) {
    this.pour.update(dt);
    this.steam.update(dt, t);

    if (this.done) return;
    const step = this.recipe.steps[this.stepIndex];
    if (!step) return;

    switch (step.id) {
      case 'wash': this.#detectSwirl(dt, step); break;
      case 'turmeric': this.#detectSprinkle(dt, step); break;
      case 'santan': /* handled in #handlePour; stop loop if not pouring */ this.#pourIdle(); break;
      case 'steam': this.#detectSteam(dt, step); break;
      case 'fluff': this.#detectFluff(dt, step); break;
      case 'plate': this.#detectPlate(step); break;
    }
    this.hud.setProgress(Math.min(this.progress / step.condition.threshold, 1));
  }

  #pourIdle() {
    // if the jug isn't actively pouring this frame the loop times itself out via onPour gaps
    if (this._pourLoop && !this._pouringThisFrame) { /* keep; stopped on completion */ }
  }

  #inBowl(p, extraY = 0.12) {
    return this.#xzDist(p, this.bowlCenter) < 0.13 &&
      p.y > this.bowlCenter.y - 0.02 && p.y < this.bowlCenter.y + extraY;
  }

  #detectSwirl(dt, step) {
    let swirled = 0;
    for (const hand of this.interaction.hands) {
      const p = hand.worldPos;
      if (!this.#inBowl(p, 0.14)) { this._swirlLast.delete(hand); continue; }
      const ang = Math.atan2(p.z - this.bowlCenter.z, p.x - this.bowlCenter.x);
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
      this.progress += swirled;
      // water clears as you wash
      const f = Math.min(this.progress / step.condition.threshold, 1);
      this.water.material.color.lerpColors(new THREE.Color(0xcbd3c8), new THREE.Color(0xdfe8df), f);
      this.rice.rotation.y += swirled * 0.5;
      if ((this._swirlSfx = (this._swirlSfx || 0) + swirled) > 1.2) { this._swirlSfx = 0; this.audio?.swirl(); }
    }
    if (this.progress >= step.condition.threshold) { this.water.fill = 0; this.water.add(-1); this.#complete(this.stepIndex); }
  }

  #detectSprinkle(dt, step) {
    let sprinkling = false;
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.turmeric) continue;
      const p = new THREE.Vector3(); this.turmeric.getWorldPosition(p);
      const above = this.#xzDist(p, this.bowlCenter) < 0.14 && p.y > this.bowlCenter.y + 0.03;
      const shaking = hand.velocity.length() > 0.15;
      if (above && shaking) {
        sprinkling = true;
        this.pour.setColor(0xE8A317);
        this.pour.emit(p, 1);
        this.progress += dt;
        const f = Math.min(this.progress / step.condition.threshold, 1);
        this.riceMat.color.lerpColors(new THREE.Color(0xefe9d8), new THREE.Color(0xf2c531), f);
        this.interaction.pulse(hand, 0.1, 12);
      }
    }
    if (sprinkling && (this._sprSfx = (this._sprSfx || 0) + dt) > 0.25) { this._sprSfx = 0; this.audio?.sprinkle(); }
    if (this.progress >= step.condition.threshold) this.#complete(this.stepIndex);
  }

  #detectSteam(dt, step) {
    const lp = new THREE.Vector3(); this.lid.getWorldPosition(lp);
    const covering = this.#xzDist(lp, this.bowlCenter) < 0.1 &&
      lp.y < this.bowlCenter.y + 0.16 && lp.y > this.bowlCenter.y;
    if (covering) {
      this.steam.setIntensity(1);
      if (!this._sizzleLoop) this._sizzleLoop = this.audio?.loop('sizzle');
      this.progress += dt;
      // rice deepens colour as it cooks
      const f = Math.min(this.progress / step.condition.threshold, 1);
      this.riceMat.color.lerpColors(new THREE.Color(0xf2c531), new THREE.Color(0xf1c02a), f);
      this.riceMat.roughness = 0.8 - f * 0.2;
      if (this.progress >= step.condition.threshold) {
        this._sizzleLoop?.stop?.(); this._sizzleLoop = null;
        this.steam.setIntensity(0.15);
        this.#complete(this.stepIndex);
      }
    } else {
      this.steam.setIntensity(0);
      this._sizzleLoop?.stop?.(); this._sizzleLoop = null;
    }
  }

  #detectFluff(dt, step) {
    for (const hand of this.interaction.hands) {
      if (hand.held !== this.paddle) continue;
      // Use the hand position (it drives the paddle) so the gesture is reachable
      // whether the hand rides the desktop worktop plane or is a VR controller.
      if (this.#inBowl(hand.worldPos, 0.26)) {
        const stroke = hand.velocity.length();
        if (stroke > 0.25) {
          this.progress += dt * stroke * 2.2;
          this.interaction.pulse(hand, 0.2, 10); // soft fluff pulses
          this.rice.scale.setScalar(1 + Math.min(this.progress / step.condition.threshold, 1) * 0.08);
          this.riceMat.roughness = Math.max(0.45, this.riceMat.roughness - dt * 0.2);
          this.riceMat.clearcoat = Math.min(0.5, this.riceMat.clearcoat + dt * 0.3);
          if ((this._flSfx = (this._flSfx || 0) + dt) > 0.3) { this._flSfx = 0; this.audio?.fluff(); }
        }
      }
    }
    if (this.progress >= step.condition.threshold) {
      this.riceMat.color.setHex(0xf4c936);
      this.#spawnPortion();
      this.#complete(this.stepIndex);
    }
  }

  #spawnPortion() {
    if (this.portion) return;
    const portion = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.08, 20),
      this.riceMat.clone(),
    );
    portion.position.copy(this.bowlCenter).setY(this.bowlCenter.y + 0.12);
    portion.castShadow = true;
    this.scene.add(portion);
    this.portion = portion;
    // No home-return: the portion must stay where you drop it so onRelease can
    // decide whether it landed on the banana leaf.
    this.interaction.register(portion, {
      onRelease: () => {
        const p = new THREE.Vector3(); portion.getWorldPosition(p);
        if (this.#xzDist(p, this.platingZone) < 0.16) {
          portion.position.copy(this.platingZone).setY(this.platingZone.y + 0.04);
          this._plated = true;
        } else {
          // gently returns above the bowl to try again
          portion.position.copy(this.bowlCenter).setY(this.bowlCenter.y + 0.12);
        }
      },
    });
  }

  #detectPlate(step) {
    if (this._plated) this.#complete(this.stepIndex);
  }

  #xzDist(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
}
