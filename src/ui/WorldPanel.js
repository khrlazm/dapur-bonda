import * as THREE from 'three/webgpu';
import { parchmentCanvas } from '../world/textures.js';

// An in-world instruction card for VR (the DOM HUD can't render inside an
// immersive session). It floats above the worktop facing the player and mirrors
// the current step + a line of Bonda's memory. The progress bar is a separate
// mesh so it can update every frame without re-uploading the canvas texture.
export class WorldPanel {
  constructor(scene, position) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.x = -0.12;
    this.group.visible = false; // shown only while presenting in VR
    scene.add(this.group);

    const W = 1024, H = 512;
    this.base = parchmentCanvas(W, H);
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.31),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }),
    );
    this.group.add(panel);

    // progress track + left-anchored fill
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.014),
      new THREE.MeshBasicMaterial({ color: 0x4a2f1a, transparent: true, opacity: 0.25 }),
    );
    track.position.set(0, -0.11, 0.001);
    const fillGeo = new THREE.PlaneGeometry(0.5, 0.014);
    fillGeo.translate(0.25, 0, 0); // pivot at left edge
    this.fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xc79a3a }));
    this.fill.position.set(-0.25, -0.11, 0.002);
    this.fill.scale.x = 0.0001;
    this.group.add(track, this.fill);

    this._memory = '';
    this._memoryUntil = 0;
    this.setStep('…', 'Dapur Bonda', 'Reach out and begin.');
  }

  setVisible(v) { this.group.visible = v; }

  #wrap(text, x, y, maxW, lh) {
    const ctx = this.ctx, words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y;
  }

  setStep(num, title, instruction) {
    this._step = { num, title, instruction };
    this.#redraw();
  }

  setProgress(f) {
    this.fill.scale.x = Math.max(0.0001, Math.min(f, 1));
  }

  toast(text) {
    this._memory = text.replace(/[“”]/g, '"');
    this._memoryUntil = performance.now() + 6500;
    this.#redraw();
  }

  update(t) {
    if (this._memory && performance.now() > this._memoryUntil) { this._memory = ''; this.#redraw(); }
  }

  #redraw() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.drawImage(this.base, 0, 0);
    ctx.strokeStyle = 'rgba(120,70,40,0.5)'; ctx.lineWidth = 5;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    const s = this._step || { num: '', title: '', instruction: '' };
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8a5a1a';
    ctx.font = 'italic 40px Georgia, serif';
    ctx.fillText(`Step ${s.num}`, 60, 100);
    ctx.fillStyle = '#4a2f14';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText(s.title, 60, 160);
    ctx.fillStyle = '#5a3a1e';
    ctx.font = '34px Georgia, serif';
    let y = this.#wrap(s.instruction, 60, 220, w - 120, 44);

    if (this._memory) {
      y = Math.max(y + 20, 330);
      ctx.fillStyle = 'rgba(122,45,45,0.12)';
      ctx.fillRect(48, y - 34, w - 96, 118);
      ctx.fillStyle = '#7a2d2d';
      ctx.font = 'italic 30px Georgia, serif';
      this.#wrap(this._memory, 68, y, w - 140, 38);
    }
    this.tex.needsUpdate = true;
  }
}
