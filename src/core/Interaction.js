import * as THREE from 'three/webgpu';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

// One grab/hold model that works identically for a desktop mouse pointer and
// for VR controllers OR hand-tracking pinch (WebXR fires the same select events
// for a pinch gesture, so both are covered). Each "hand" exposes world position
// and velocity so the cooking sim can read gestures like swirling and fluffing.
export class Interaction {
  constructor(engine) {
    this.engine = engine;
    this.renderer = engine.renderer;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.rig = engine.rig;

    this.grabbables = [];        // Object3D[] tagged with userData.grab
    this.hands = [];             // active Hand[] (desktop: 1, VR: 2)
    this.grabRadius = 0.16;
    this.pourThreshold = Math.cos(THREE.MathUtils.degToRad(52)); // tilt to pour

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._tmp = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();

    this.onPour = null; // (heldObject, dt, worldSpoutPos) => void

    this.#setupDesktop();
    this.#setupXR();
  }

  register(object, opts = {}) {
    object.userData.grab = {
      pourable: !!opts.pourable,
      spout: opts.spout || null,          // local offset of the pour lip
      home: opts.home ? object.position.clone() : null,
      onGrab: opts.onGrab || null,
      onRelease: opts.onRelease || null,
    };
    this.grabbables.push(object);
    return object;
  }

  // ---- Desktop pointer hand -------------------------------------------------
  #setupDesktop() {
    const hand = this.#makeHand('desktop');
    hand.visual.visible = true;
    this.scene.add(hand.visual);
    this.desktopHand = hand;
    this.hands = [hand];

    // A horizontal plane at worktop height that the cursor rides along.
    this.workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.94);
    this._planePt = new THREE.Vector3();

    const dom = this.renderer.domElement;
    this._lift = 0.06;
    this._tilt = 0;
    this._shift = false;
    this._lastY = 0;

    const setPointer = (e) => {
      const r = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };

    dom.addEventListener('pointermove', (e) => {
      setPointer(e);
      if (hand.held && this._shift) {
        this._tilt = THREE.MathUtils.clamp(this._tilt + (e.clientY - this._lastY) * 0.01, 0, 1.8);
      }
      this._lastY = e.clientY;
    });
    dom.addEventListener('pointerdown', (e) => {
      if (this.renderer.xr.isPresenting) return;
      if (e.button !== 0) return; // left button = reach & grab
      setPointer(e);
      this._lastY = e.clientY;
      this.#tryGrab(hand);
    });
    const release = (e) => {
      if (e && e.button !== 0) return;
      this._tilt = 0; this._shift = false;
      this.#release(hand);
    };
    dom.addEventListener('pointerup', release);
    window.addEventListener('keydown', (e) => { if (e.key === 'Shift') this._shift = true; });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') this._shift = false; });
  }

  // ---- VR controllers / hands ----------------------------------------------
  #setupXR() {
    const cmf = new XRControllerModelFactory();
    const hmf = new XRHandModelFactory();
    this.xrHands = [];

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(cmf.createControllerModel(grip));
      const handModel = this.renderer.xr.getHand(i);
      handModel.add(hmf.createHandModel(handModel, 'mesh'));
      this.rig.add(controller, grip, handModel);

      const hand = this.#makeHand('xr', grip);
      grip.add(hand.visual);
      hand.visual.position.set(0, 0, -0.02);

      controller.addEventListener('connected', (e) => { hand.inputSource = e.data; });
      controller.addEventListener('disconnected', () => { hand.inputSource = null; });
      controller.addEventListener('selectstart', () => this.#tryGrab(hand));
      controller.addEventListener('selectend', () => this.#release(hand));
      controller.addEventListener('squeezestart', () => this.#tryGrab(hand));
      controller.addEventListener('squeezeend', () => this.#release(hand));

      this.xrHands.push(hand);
    }
  }

  #makeHand(kind, node) {
    const visual = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.4 }),
    );
    visual.castShadow = false;
    return {
      kind, node: node || null, visual,
      worldPos: new THREE.Vector3(), prevPos: new THREE.Vector3(), velocity: new THREE.Vector3(),
      held: null, inputSource: null,
    };
  }

  onSessionChange(presenting) {
    this.desktopHand.visual.visible = !presenting;
    if (presenting) {
      // drop anything held by the mouse when diving into VR
      this.#release(this.desktopHand);
      this.hands = this.xrHands;
    } else {
      this.hands = [this.desktopHand];
    }
  }

  #tryGrab(hand) {
    if (hand.held) return;
    let best = null, bestD = Infinity;
    for (const o of this.grabbables) {
      if (o.userData._heldBy) continue;
      o.getWorldPosition(this._tmp);
      const d = this._tmp.distanceTo(hand.worldPos);
      if (d < bestD) { bestD = d; best = o; }
    }
    const reach = hand.kind === 'desktop' ? 0.32 : this.grabRadius;
    if (best && bestD <= reach) {
      hand.held = best;
      best.userData._heldBy = hand;
      // reparent to hand node keeping world transform (VR), or track in update (desktop)
      if (hand.kind === 'xr' && hand.node) {
        hand.node.attach(best);
      } else {
        best.userData._grabWorld = best.position.clone();
      }
      hand.held.userData.grab.onGrab?.(hand);
      this.pulse(hand, 0.5, 30);
    }
  }

  #release(hand) {
    const o = hand.held;
    if (!o) return;
    if (hand.kind === 'xr') this.scene.attach(o);
    o.rotation.set(0, 0, 0);
    o.userData._heldBy = null;
    hand.held = null;
    const g = o.userData.grab;
    if (g.home) { // snap-return tools to their resting spot
      o.position.copy(g.home);
    }
    g.onRelease?.(hand);
  }

  pulse(hand, intensity = 0.4, ms = 40) {
    const act = hand.inputSource?.gamepad?.hapticActuators?.[0];
    if (act) { try { act.pulse(intensity, ms); } catch {} }
  }

  update(dt) {
    // Desktop: ride the cursor along the worktop plane, lift a touch, tilt to pour.
    if (!this.renderer.xr.isPresenting) {
      const hand = this.desktopHand;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (this.raycaster.ray.intersectPlane(this.workPlane, this._planePt)) {
        hand.visual.position.copy(this._planePt).add(new THREE.Vector3(0, this._lift, 0));
      }
      if (hand.held) {
        const o = hand.held;
        o.position.lerp(hand.visual.position, 0.5);
        o.rotation.z = this._tilt; // Shift+drag tilts to pour
      }
    }

    // Update world pos + velocity for every active hand.
    for (const hand of this.hands) {
      hand.prevPos.copy(hand.worldPos);
      hand.visual.getWorldPosition(hand.worldPos);
      hand.velocity.copy(hand.worldPos).sub(hand.prevPos).divideScalar(Math.max(dt, 1e-3));
    }

    // Pouring: any held pourable tilted past threshold emits from its spout.
    for (const hand of this.hands) {
      const o = hand.held;
      if (!o || !o.userData.grab.pourable) continue;
      o.getWorldQuaternion(this._tmpQ);
      const up = this._tmp.set(0, 1, 0).applyQuaternion(this._tmpQ);
      if (up.y < this.pourThreshold) {
        const spout = o.userData.grab.spout
          ? o.localToWorld(o.userData.grab.spout.clone())
          : o.getWorldPosition(new THREE.Vector3());
        this.onPour?.(o, dt, spout);
        this.pulse(hand, 0.15, 20);
      }
    }
  }
}
