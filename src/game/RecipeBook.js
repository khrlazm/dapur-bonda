import * as THREE from 'three/webgpu';
import { parchmentCanvas } from '../world/textures.js';

// The illustrated heirloom cookbook — the game's UI and its save file made
// physical. It rests open on the worktop; the left page holds the recipe and
// ingredients, the right page fills in with ticks and a line of family memory
// as each step is completed.
export class RecipeBook {
  constructor(scene, position, recipe) {
    this.recipe = recipe;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.x = -Math.PI / 2.35; // lie back on a slight lectern angle
    scene.add(this.group);

    const W = 1024, H = 1024;
    this.left = this.#makePage(-0.16, W, H);
    this.right = this.#makePage(0.16, W, H);

    // a spine + cover peeking beneath the pages
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.44, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x5a2f1e, roughness: 0.6 }),
    );
    cover.position.z = -0.012;
    cover.castShadow = true;
    this.group.add(cover);

    // A single turning page, pinned at the spine (x=0), that sweeps from the
    // right page over to the left when the book advances to a new recipe.
    const turnGeo = new THREE.PlaneGeometry(0.32, 0.42);
    turnGeo.translate(0.16, 0, 0); // pivot at the left (spine) edge
    this.turnTex = new THREE.CanvasTexture(parchmentCanvas(512, 512));
    this.turnTex.colorSpace = THREE.SRGBColorSpace;
    this.turnPage = new THREE.Mesh(
      turnGeo,
      new THREE.MeshStandardMaterial({ map: this.turnTex, roughness: 0.85, side: THREE.DoubleSide }),
    );
    this.turnPage.position.set(0, 0, 0.006);
    this.turnPage.visible = false;
    this.group.add(this.turnPage);
    this._flip = null;

    this.draw({ steps: {} }, 0);
  }

  // Swap to a different recipe's spread (used when a new recipe is unlocked).
  setRecipe(recipe, save = { steps: {} }, index = 0, memory) {
    this.recipe = recipe;
    this.draw(save, index, memory);
  }

  // Animate a page turning over, swapping to the new recipe at the midpoint.
  flipToRecipe(recipe, save = { steps: {} }, index = 0) {
    this._flip = { t: 0, dur: 1.0, mid: false, recipe, save, index };
    this.turnPage.visible = true;
    this.turnPage.rotation.y = 0;
  }

  update(dt) {
    const f = this._flip;
    if (!f) return;
    f.t += dt;
    const k = Math.min(f.t / f.dur, 1);
    this.turnPage.rotation.y = Math.PI * k; // 0 (over right page) -> PI (over left)
    if (!f.mid && k >= 0.5) { f.mid = true; this.setRecipe(f.recipe, f.save, f.index); }
    if (k >= 1) { this.turnPage.visible = false; this._flip = null; }
  }

  #makePage(x, w, h) {
    const base = parchmentCanvas(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), mat);
    mesh.position.set(x, 0, 0.001);
    mesh.castShadow = false;
    this.group.add(mesh);
    return { canvas, ctx, tex, base };
  }

  #wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); line = w; y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y;
  }

  #border(ctx, w, h) {
    ctx.strokeStyle = 'rgba(120,70,40,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, w - 80, h - 80);
    ctx.lineWidth = 2;
    ctx.strokeRect(54, 54, w - 108, h - 108);
    // corner hibiscus dots
    ctx.fillStyle = 'rgba(150,50,50,0.55)';
    for (const [cx, cy] of [[40, 40], [w - 40, 40], [40, h - 40], [w - 40, h - 40]]) {
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 5, 10, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  draw(recipeSave, currentIndex, memory) {
    const steps = recipeSave?.steps || {};
    // ---- Left page: title + ingredients ----
    {
      const { ctx, base, tex, canvas } = this.left;
      ctx.drawImage(base, 0, 0);
      const w = canvas.width, h = canvas.height;
      this.#border(ctx, w, h);
      ctx.fillStyle = '#5a2f14';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.font = 'italic 92px Georgia, serif';
      ctx.fillText(this.recipe.title, w / 2, 170);
      ctx.font = 'italic 30px Georgia, serif';
      ctx.fillStyle = '#6b4a2a';
      this.#wrap(ctx, this.recipe.subtitle, 130, 220, w - 260, 38);

      ctx.textAlign = 'left';
      ctx.font = 'bold 40px Georgia, serif';
      ctx.fillStyle = '#5a2f14';
      ctx.fillText('Ingredients', 130, 360);
      ctx.font = '34px Georgia, serif';
      let y = 420;
      for (const ing of this.recipe.ingredients) {
        ctx.fillStyle = '#7a2d2d';
        ctx.fillText('❦', 130, y);
        ctx.fillStyle = '#4a2f1a';
        ctx.fillText(ing.name, 175, y);
        ctx.fillStyle = '#8a6b4a';
        ctx.font = 'italic 28px Georgia, serif';
        ctx.fillText(ing.note, 175, y + 34);
        ctx.font = '34px Georgia, serif';
        y += 96;
      }
      tex.needsUpdate = true;
    }

    // ---- Right page: steps checklist + memory ----
    {
      const { ctx, base, tex, canvas } = this.right;
      ctx.drawImage(base, 0, 0);
      const w = canvas.width, h = canvas.height;
      this.#border(ctx, w, h);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a2f14';
      ctx.font = 'bold 40px Georgia, serif';
      ctx.fillText('The Method', 130, 150);

      ctx.font = '30px Georgia, serif';
      let y = 210;
      this.recipe.steps.forEach((s, i) => {
        const done = !!steps[s.id];
        const active = i === currentIndex;
        ctx.fillStyle = done ? '#3d6b2f' : active ? '#7a2d2d' : '#a08050';
        ctx.font = 'bold 30px Georgia, serif';
        ctx.fillText(done ? '✓' : active ? '➤' : `${i + 1}.`, 130, y);
        ctx.fillStyle = done ? '#4a2f1a' : active ? '#3a2410' : '#9a7a55';
        ctx.font = (active ? 'bold ' : '') + '30px Georgia, serif';
        ctx.fillText(s.title, 190, y);
        y += 54;
      });

      // active instruction
      const active = this.recipe.steps[currentIndex];
      if (active) {
        ctx.fillStyle = '#5a3016';
        ctx.font = 'italic 28px Georgia, serif';
        y += 20;
        y = this.#wrap(ctx, active.instruction, 130, y, w - 260, 36) + 30;
      }

      // latest memory in a tinted note
      if (memory) {
        ctx.fillStyle = 'rgba(122,45,45,0.12)';
        ctx.fillRect(120, y - 6, w - 240, 170);
        ctx.fillStyle = '#7a2d2d';
        ctx.font = 'italic 27px Georgia, serif';
        this.#wrap(ctx, memory, 140, y + 34, w - 280, 34);
      }
      tex.needsUpdate = true;
    }
  }
}
