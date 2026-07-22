import * as THREE from 'three/webgpu';
import { grain } from '../world/textures.js';

// Environmental storytelling for the hub. The kitchen holds nine small objects
// — a photo, a radio, Atok's songkok, a biscuit tin that betrays every
// Malaysian child — and touching one (VR: touch or pinch near it; desktop:
// click it) reveals a line of family memory. Undiscovered objects carry a soft
// warm glimmer. Discoveries persist in the save and count toward
// "Kitchen memories n/9" in the hub prompt.
export class HubStories {
  constructor({ scene, kitchen, interaction, hud, audio, save, sim }) {
    this.scene = scene;
    this.kitchen = kitchen;
    this.interaction = interaction;
    this.hud = hud;
    this.audio = audio;
    this.save = save;
    this.sim = sim;

    this.props = [];
    this._cooldowns = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);

    // A memory card that pops in-world beside the touched object and faces the
    // player. The fixed counter panel (WorldPanel) is out of view once you roam
    // the hub, so in VR this is the memory UI.
    const cc = document.createElement('canvas'); cc.width = 640; cc.height = 360;
    this._cardCtx = cc.getContext('2d');
    this._cardTex = new THREE.CanvasTexture(cc);
    this._cardTex.colorSpace = THREE.SRGBColorSpace; this._cardTex.anisotropy = 4;
    this.card = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.29),
      new THREE.MeshBasicMaterial({ map: this._cardTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.card.renderOrder = 600; this.card.visible = false; this.card.frustumCulled = false;
    scene.add(this.card);
    this._cardShown = 0; this._cardDur = 8;

    this.#build();
    this.total = this.props.length;
    sim.hubStoriesTotal = this.total;
    sim.refreshHubPrompt();
  }

  // ---------- Construction ----------
  #build() {
    const K = this.kitchen;

    this.#prop('photo-frame', this.#photoFrame(), new THREE.Vector3(-2.37, 1.55, 0.55), { rotY: Math.PI / 2 },
      '“Nenek and Atok, 1974. He built this house with his own hands, and planted the mango tree the day they moved in.”');

    this.#prop('radio', this.#radio(), new THREE.Vector3(1.12, K.counterTopY + 0.1, -0.5), { rotY: -0.35 },
      '“P. Ramlee on Saturday mornings. Bonda sang every word while the rice steamed, and the ladle was her microphone.”',
      () => this.audio?.radio());

    this.#prop('biscuit-tin', this.#biscuitTin(), new THREE.Vector3(-0.95, K.counterTopY + 0.07, -0.48), {},
      '“A tin of biscuits… full of needles and thread. Every child in this kampung has fallen for it. You did too.”');

    this.#prop('songkok', this.#songkok(), new THREE.Vector3(2.36, 1.5, 0.95), { rotY: -Math.PI / 2 },
      '“Atok’s songkok — brushed every Friday, worn to prayers, weddings, and one very long election night.”');

    this.#prop('pandan', this.#touchSphere(0.09), K.anchors.pandan.clone(), {},
      '“Bonda’s pandan. Snip two leaves, tie a knot, and suddenly the whole house smells like a celebration.”');

    this.#prop('growth-post', this.#growthPost(), new THREE.Vector3(2.38, 1.05, 1.45), { rotY: -Math.PI / 2 },
      '“Your height, marked every Raya morning. You stopped letting her measure you at fifteen. She kept the pencil anyway.”');

    this.#prop('postcard', this.#postcard(), new THREE.Vector3(-2.08, 0.87, 0.1), { rotY: 0.4, rotX: -0.35 },
      '“A postcard from your father, working in KL: ‘Mak — the food here has no soul. Save me a corner of the rendang.’”');

    this.#prop('kettle', this.#kettle(), new THREE.Vector3(1.42, 0.79, -0.58), {},
      '“The kettle knows maghrib. Tea before, prayers after, and stories until the moths circle the lamp.”',
      () => this.audio?.whistle());

    this.#prop('calendar', this.#calendar(), new THREE.Vector3(2.37, 1.6, 0.45), { rotY: -Math.PI / 2 },
      '“The kenduri, circled three times in red. As if Bonda could ever forget a feast.”');
  }

  #prop(id, object, position, { rotY = 0, rotX = 0 } = {}, memory, sound) {
    object.position.copy(position);
    object.rotation.y = rotY;
    if (rotX) object.rotation.x = rotX;
    this.group.add(object);

    // Soft pulsing glimmer, slightly proud of the object, until discovered.
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd27a, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }),
    );
    const out = new THREE.Vector3(Math.sin(rotY) * 0.07, 0.05, Math.cos(rotY) * 0.07);
    glint.position.copy(position).add(out);
    glint.visible = !this.save.hasHubStory(id);
    this.group.add(glint);

    const prop = { id, object, glint, memory, sound, seed: Math.random() * 6.28 };
    this.props.push(prop);
    this.interaction.register(object, { inspect: true, onGrab: () => this.#discover(prop) });
    return prop;
  }

  // ---------- Discovery ----------
  #discover(prop) {
    if (this.sim.mode !== 'hub') return;
    const now = performance.now();
    if ((this._cooldowns.get(prop.id) || 0) > now) return;
    this._cooldowns.set(prop.id, now + 2500);

    const first = !this.save.hasHubStory(prop.id);
    if (first) {
      this.save.markHubStory(prop.id);
      this.save.addMemory(prop.memory);
      prop.glint.visible = false;
      this.audio?.ding();
      this.sim.refreshHubPrompt();
    }
    this.hud.toast(prop.memory);
    const wp = new THREE.Vector3(); prop.object.getWorldPosition(wp);
    this.#showCard(prop.memory, wp);
    prop.sound?.();
  }

  #showCard(text, worldPos) {
    const ctx = this._cardCtx, w = 640, h = 360;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, h * 0.85);
    grad.addColorStop(0, '#f7ecd2'); grad.addColorStop(1, '#e6d2a8');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,70,40,0.55)'; ctx.lineWidth = 8; ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7a2d2d'; ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText('❦   a memory   ❦', w / 2, 62);
    ctx.textAlign = 'left'; ctx.fillStyle = '#3f2a16'; ctx.font = 'italic 30px Georgia, serif';
    this.#wrapText(ctx, text.replace(/[“”]/g, '"'), 46, 116, w - 92, 40);
    this._cardTex.needsUpdate = true;

    // Sit the card in front of the object, toward the player, so it never buries
    // itself in the wall behind.
    const cam = this.interaction.camera;
    const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
    const toCam = camPos.clone().sub(worldPos).setY(0);
    if (toCam.lengthSq() > 1e-4) toCam.normalize(); else toCam.set(0, 0, 1);
    this.card.position.copy(worldPos).add(new THREE.Vector3(0, 0.24, 0)).addScaledVector(toCam, 0.12);
    this.card.visible = true;
    this._cardShown = performance.now();
  }

  #wrapText(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = wd; y += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, y);
  }

  // VR: bare-hand proximity also counts as a touch (no pinch needed).
  update(dt, t) {
    const hub = this.sim.mode === 'hub';

    // memory card: face the player, fade in then out, and hide when leaving hub
    if (this.card.visible) {
      if (!hub) { this.card.visible = false; }
      else {
        const camPos = new THREE.Vector3(); this.interaction.camera.getWorldPosition(camPos);
        this.card.lookAt(camPos);
        const el = (performance.now() - this._cardShown) / 1000;
        let op = 1;
        if (el < 0.25) op = el / 0.25;
        else if (el > this._cardDur - 1) op = Math.max(0, this._cardDur - el);
        this.card.material.opacity = op;
        if (el > this._cardDur) this.card.visible = false;
      }
    }

    for (const p of this.props) {
      if (p.glint.visible) {
        p.glint.material.opacity = hub ? 0.55 + Math.sin(t * 0.004 + p.seed) * 0.35 : 0;
        const s = 1 + Math.sin(t * 0.004 + p.seed) * 0.3;
        p.glint.scale.setScalar(s);
      }
    }
    if (!hub || !this.interaction.renderer.xr.isPresenting) return;
    const tmp = new THREE.Vector3();
    for (const hand of this.interaction.hands) {
      for (const p of this.props) {
        p.object.getWorldPosition(tmp);
        if (tmp.distanceTo(hand.worldPos) < 0.11) {
          this.interaction.pulse(hand, 0.25, 20);
          this.#discover(p);
        }
      }
    }
  }

  // ---------- Procedural props ----------
  #canvasPlane(w, h, draw, { pxW = 256, pxH = 256 } = {}) {
    const c = document.createElement('canvas');
    c.width = pxW; c.height = pxH;
    draw(c.getContext('2d'), pxW, pxH);
    grain(c.getContext('2d'), pxW, pxH, 14); // aged photo/postcard grain
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    );
  }

  #photoFrame() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.02), this.kitchen.mat.woodDark);
    const photo = this.#canvasPlane(0.16, 0.2, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#d9c29a'); grad.addColorStop(1, '#b99b70');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // two sepia figures — head-and-shoulders
      ctx.fillStyle = '#6b4a2e';
      for (const [cx, s] of [[w * 0.36, 1], [w * 0.62, 0.92]]) {
        ctx.beginPath(); ctx.arc(cx, h * 0.42, 22 * s, 0, Math.PI * 2); ctx.fill(); // head
        ctx.beginPath(); ctx.ellipse(cx, h * 0.78, 34 * s, 40 * s, 0, Math.PI, 0); ctx.fill(); // shoulders
      }
      ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = 'rgba(255,250,235,0.85)';
      ctx.fillRect(0, h - 26, w, 26);
      ctx.fillStyle = '#6b4a2e'; ctx.font = 'italic 16px Georgia';
      ctx.textAlign = 'center'; ctx.fillText('Kampung Sungai Manik, 1974', w / 2, h - 8);
    });
    photo.position.z = 0.011;
    g.add(frame, photo);
    return g;
  }

  #radio() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.5 }));
    const grille = this.#canvasPlane(0.12, 0.08, (ctx, w, h) => {
      ctx.fillStyle = '#caa268'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 4;
      for (let x = 8; x < w; x += 14) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, h - 6); ctx.stroke(); }
    });
    grille.position.set(-0.035, 0, 0.041);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.4 }));
    dial.rotation.x = Math.PI / 2; dial.position.set(0.07, 0.015, 0.041);
    const knob = dial.clone(); knob.scale.setScalar(0.7); knob.position.set(0.07, -0.03, 0.041);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3 }));
    antenna.position.set(0.08, 0.12, -0.02); antenna.rotation.z = -0.4;
    g.add(body, grille, dial, knob, antenna);
    return g;
  }

  #biscuitTin() {
    const g = new THREE.Group();
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 24),
      new THREE.MeshStandardMaterial({ color: 0xa8241c, roughness: 0.35, metalness: 0.4 }));
    const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.006, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 0.6 }));
    lidRim.rotation.x = Math.PI / 2; lidRim.position.y = 0.025;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0705, 0.0705, 0.024, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf2e2b8, roughness: 0.5 }));
    g.add(tin, lidRim, label);
    return g;
  }

  #songkok() {
    const g = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.078, 0.09, 20),
      new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 }));
    cap.scale.z = 0.8;
    cap.position.set(0, 0, 0.06);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), this.kitchen.mat.brass);
    hook.rotation.x = Math.PI / 2; hook.position.set(0, 0.05, 0.025);
    g.add(cap, hook);
    return g;
  }

  #touchSphere(r) {
    // Invisible-ish touch target over an object the Kitchen already built.
    return new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.02, depthWrite: false }),
    );
  }

  #growthPost() {
    return this.#canvasPlane(0.09, 1.3, (ctx, w, h) => {
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,35,15,0.5)';
      for (let y = 0; y < h; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + 4); ctx.stroke(); }
      ctx.strokeStyle = '#2e1c0c'; ctx.lineWidth = 3; ctx.font = 'bold 20px Georgia';
      ctx.fillStyle = '#2e1c0c'; ctx.textAlign = 'left';
      const marks = [[0.15, "'12"], [0.32, "'10"], [0.52, "'08"], [0.68, "'06"], [0.82, "'05"]];
      for (const [f, label] of marks) {
        ctx.beginPath(); ctx.moveTo(10, h * f); ctx.lineTo(w - 10, h * f); ctx.stroke();
        ctx.fillText(label, 14, h * f - 6);
      }
    }, { pxW: 64, pxH: 512 });
  }

  #postcard() {
    return this.#canvasPlane(0.11, 0.075, (ctx, w, h) => {
      ctx.fillStyle = '#f2e8d0'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b03030'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#3a5a8a'; ctx.fillRect(w - 60, 12, 44, 52); // stamp
      ctx.strokeStyle = '#8a6b4a'; ctx.lineWidth = 2;
      for (let y = 90; y < h - 16; y += 22) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w * 0.55, y); ctx.stroke(); }
      ctx.fillStyle = '#5a3a1e'; ctx.font = 'italic 26px Georgia';
      ctx.fillText('Mak —', 16, 60);
    }, { pxW: 256, pxH: 176 });
  }

  #kettle() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), this.kitchen.mat.brass);
    body.scale.y = 0.85;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.09, 10), this.kitchen.mat.brass);
    spout.position.set(0.07, 0.02, 0); spout.rotation.z = -0.9;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 16, Math.PI), this.kitchen.mat.brass);
    handle.position.y = 0.045;
    const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), this.kitchen.mat.woodDark);
    lidKnob.position.y = 0.055;
    g.add(body, spout, handle, lidKnob);
    return g;
  }

  #calendar() {
    return this.#canvasPlane(0.16, 0.22, (ctx, w, h) => {
      ctx.fillStyle = '#f6eed8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#7a2d2d'; ctx.fillRect(0, 0, w, 44);
      ctx.fillStyle = '#f6eed8'; ctx.font = 'bold 26px Georgia'; ctx.textAlign = 'center';
      ctx.fillText('SYAWAL', w / 2, 30);
      ctx.strokeStyle = '#9a7a55'; ctx.lineWidth = 1.5;
      ctx.fillStyle = '#4a2f1a'; ctx.font = '16px Georgia';
      const cols = 7, rows = 5, cw = w / cols, ch = (h - 44) / rows;
      let day = 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = c * cw, y = 44 + r * ch;
        ctx.strokeRect(x, y, cw, ch);
        if (day <= 30) ctx.fillText(String(day), x + cw / 2, y + ch / 2 + 6);
        if (day === 14) { // the kenduri, circled three times
          ctx.strokeStyle = '#c02020'; ctx.lineWidth = 2.5;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(x + cw / 2, y + ch / 2, cw * 0.42 + i * 1.5, ch * 0.42 + i * 1.5, 0.2, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.strokeStyle = '#9a7a55'; ctx.lineWidth = 1.5;
        }
        day++;
      }
    }, { pxW: 256, pxH: 352 });
  }
}
