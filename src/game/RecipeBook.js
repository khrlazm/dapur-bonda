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
    this.menuMode = false;

    // A little red ribbon bookmark that peeks out when there are unread memories.
    this.ribbon = new THREE.Mesh(
      new THREE.PlaneGeometry(0.028, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xb02a2a, side: THREE.DoubleSide, transparent: true, fog: false }),
    );
    this.ribbon.position.set(0.24, -0.28, 0.004);
    this.ribbon.visible = false;
    this.group.add(this.ribbon);
    this._unread = 0;

    this.draw({ steps: {} }, 0);
  }

  // Reposition the book (the hub puts it centre-counter; cooking moves it aside).
  moveTo(position) { this.group.position.copy(position); }

  // Swap to a recipe's cooking spread (the ticking checklist).
  setRecipe(recipe, save = { steps: {} }, index = 0, memory) {
    this.menuMode = false;
    this.recipe = recipe;
    this.draw(save, index, memory);
  }

  flipToRecipe(recipe, save = { steps: {} }, index = 0) {
    this.#startFlip(() => this.setRecipe(recipe, save, index), 1);
  }

  flipToMenu(recipe, status, dir = 1) {
    this.#startFlip(() => this.drawMenu(recipe, status), dir);
  }

  // Flip with an arbitrary mid-turn draw (used for the memories pages).
  flip(drawFn, dir = 1) { this.#startFlip(drawFn, dir); }

  // Show/hide the unread-memories ribbon.
  setUnread(n) { this._unread = n; this.ribbon.visible = n > 0; }

  // dir +1: the right page lifts up and over to the left (turning forward).
  // dir -1: a page sweeps back from the left over to the right (turning back).
  #startFlip(onMid, dir = 1) {
    this._flip = { t: 0, dur: 0.9, mid: false, onMid, dir };
    this.turnPage.visible = true;
    this.turnPage.rotation.y = dir === 1 ? 0 : -Math.PI;
  }

  update(dt) {
    // Gentle "notice me" pulse on the unread ribbon.
    if (this.ribbon.visible) {
      this._rt = (this._rt || 0) + dt;
      this.ribbon.material.opacity = 0.7 + Math.sin(this._rt * 4) * 0.3;
      this.ribbon.scale.y = 1 + Math.sin(this._rt * 4) * 0.06;
    }
    const f = this._flip;
    if (!f) return;
    f.t += dt;
    const k = Math.min(f.t / f.dur, 1);
    // Negative rotation lifts the free edge UP over the spine rather than
    // dipping down through the table; backward flips run the sweep in reverse.
    this.turnPage.rotation.y = f.dir === 1 ? -Math.PI * k : -Math.PI * (1 - k);
    if (!f.mid && k >= 0.5) { f.mid = true; f.onMid(); }
    if (k >= 1) { this.turnPage.visible = false; this._flip = null; }
  }

  // Which menu control (if any) a hand is poking. Book-local zones: far-left
  // strip = previous recipe, far-right strip = next, the rest of the right page
  // = start cooking. Only active while showing the menu.
  pokeTest(worldPos) {
    if (this._flip) return null;
    const p = this.group.worldToLocal(worldPos.clone());
    if (p.z < -0.16 || p.z > 0.36) return null;      // must be near the page plane
    if (p.y < -0.24 || p.y > 0.24) return null;
    if (this.menuMode) {
      if (p.x >= -0.34 && p.x <= -0.20) return 'prev';
      if (p.x >= 0.20 && p.x <= 0.34) return 'next';
      if (p.x >= 0.00 && p.x < 0.20) return 'start';
      return null;
    }
    // cooking spread: bottom-left corner returns to the kitchen hub
    if (p.x >= -0.34 && p.x <= -0.12 && p.y <= -0.08) return 'home';
    return null;
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

      // "back to the kitchen" affordance (bottom-left; the 'home' poke zone)
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(90,47,20,0.72)';
      ctx.font = 'italic 34px Georgia, serif';
      ctx.fillText('‹  back to the kitchen', 100, h - 70);
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

  // The hub's recipe-selection spread. status = { complete, unlocked, index,
  // total, prevTitle }. One recipe per spread; flip to browse, reach the right
  // page to begin.
  drawMenu(recipe, status) {
    this.menuMode = true;
    this.recipe = recipe;

    // ---- Left page: the dish + its standing in the season ----
    {
      const { ctx, base, tex, canvas } = this.left;
      ctx.drawImage(base, 0, 0);
      const w = canvas.width, h = canvas.height;
      this.#border(ctx, w, h);
      ctx.textBaseline = 'alphabetic';

      ctx.textAlign = 'center';
      ctx.fillStyle = '#8a5a1a';
      ctx.font = 'italic 32px Georgia, serif';
      ctx.fillText(`Season ${recipe.season} · Episode ${recipe.episode}`, w / 2, 130);
      ctx.fillStyle = '#5a2f14';
      ctx.font = 'italic 88px Georgia, serif';
      ctx.fillText(recipe.title, w / 2, 230);

      // status badge
      const badge = status.comingSoon ? ['Coming soon', '#8a6b3a']
        : status.complete ? ['✓  Cooked', '#3d6b2f']
          : status.unlocked ? ['Ready to cook', '#7a2d2d']
            : ['🔒  Locked', '#9a7a55'];
      ctx.fillStyle = badge[1];
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText(badge[0], w / 2, 300);

      ctx.fillStyle = '#6b4a2a';
      ctx.font = 'italic 30px Georgia, serif';
      this.#wrap(ctx, recipe.subtitle, 140, 370, w - 280, 40);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a2f14';
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText('Ingredients', 130, 540);
      ctx.font = '32px Georgia, serif';
      let y = 600;
      for (const ing of recipe.ingredients) {
        ctx.fillStyle = '#7a2d2d'; ctx.fillText('❦', 130, y);
        ctx.fillStyle = '#4a2f1a'; ctx.fillText(ing.name, 175, y);
        y += 66;
      }

      // ◀ browse-left affordance — only when an earlier recipe exists
      if (status.index > 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(90,47,20,0.6)';
        ctx.font = 'bold 96px Georgia, serif';
        ctx.fillText('‹', 96, h / 2 + 30);
        ctx.font = 'italic 24px Georgia, serif';
        ctx.fillText('back', 96, h / 2 + 70);
      }
      tex.needsUpdate = true;
    }

    // ---- Right page: method preview + the "cook" action ----
    {
      const { ctx, base, tex, canvas } = this.right;
      ctx.drawImage(base, 0, 0);
      const w = canvas.width, h = canvas.height;
      this.#border(ctx, w, h);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a2f14';
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText('The Method', 130, 150);

      ctx.font = '30px Georgia, serif';
      let y = 210;
      if (recipe.steps.length === 0) {
        ctx.fillStyle = '#8a6b4a'; ctx.font = 'italic 30px Georgia, serif';
        this.#wrap(ctx, 'A future episode of Dapur Bonda. The pages are still being written…', 130, y, w - 260, 40);
      }
      recipe.steps.forEach((s, i) => {
        ctx.fillStyle = '#8a6b4a'; ctx.fillText(`${i + 1}.`, 130, y);
        ctx.fillStyle = '#4a2f1a'; ctx.fillText(s.title, 185, y);
        y += 52;
      });

      // action seal, lower centre of the right page (the 'start' poke zone)
      const cx = w * 0.42, cy = 800, r = 150;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = status.unlocked ? 'rgba(122,45,45,0.7)' : 'rgba(120,100,80,0.5)';
      ctx.lineWidth = 6; ctx.stroke();
      ctx.textAlign = 'center';
      if (status.unlocked) {
        ctx.fillStyle = '#7a2d2d';
        ctx.font = 'bold 34px Georgia, serif';
        ctx.fillText('REACH IN', cx, cy - 6);
        ctx.fillText('TO COOK', cx, cy + 34);
      } else if (status.comingSoon) {
        ctx.fillStyle = '#8a6b3a';
        ctx.font = 'bold 34px Georgia, serif';
        ctx.fillText('COMING', cx, cy - 6);
        ctx.fillText('SOON', cx, cy + 34);
      } else {
        ctx.fillStyle = '#8a6b4a';
        ctx.font = 'italic 26px Georgia, serif';
        ctx.fillText('Locked', cx, cy - 24);
        this.#wrap(ctx, `Finish ${status.prevTitle || 'the previous dish'} first`, cx - 120, cy + 16, 260, 30);
      }

      // page indicator + ▶ browse-right affordance — only when a later one exists
      ctx.fillStyle = '#8a6b4a';
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillText(`${status.index + 1} / ${status.total}`, w / 2, h - 90);
      if (status.index < status.total - 1) {
        ctx.fillStyle = 'rgba(90,47,20,0.6)';
        ctx.font = 'bold 96px Georgia, serif';
        ctx.fillText('›', w - 96, h / 2 + 30);
        ctx.font = 'italic 24px Georgia, serif';
        ctx.fillText('next', w - 96, h / 2 + 70);
      }
      tex.needsUpdate = true;
    }
  }

  // The heirloom "memories" spread: every family story gathered so far, five per
  // page across the two pages, paginated. `hasNext` = another memory page after.
  drawMemories(memories, page = 0, totalPages = 1, hasNext = false) {
    this.menuMode = true;
    const PER_PAGE = 5;
    const startL = page * PER_PAGE * 2;

    const list = (side, items, header) => {
      const { ctx, base, tex, canvas } = side;
      ctx.drawImage(base, 0, 0);
      const w = canvas.width, h = canvas.height;
      this.#border(ctx, w, h);
      ctx.textBaseline = 'alphabetic';
      let y = 150;
      if (header) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#5a2f14'; ctx.font = 'italic 66px Georgia, serif';
        ctx.fillText('Kitchen Memories', w / 2, 130);
        ctx.fillStyle = '#8a6b3a'; ctx.font = 'italic 28px Georgia, serif';
        ctx.fillText(`${memories.length} gathered`, w / 2, 178);
        y = 260;
      }
      ctx.textAlign = 'left';
      if (items.length === 0 && header) {
        ctx.fillStyle = '#8a6b4a'; ctx.font = 'italic 30px Georgia, serif';
        this.#wrap(ctx, 'Your memories will gather here as you cook each dish and touch each corner of Bonda’s kitchen.', 120, y + 40, w - 240, 42);
      }
      for (const m of items) {
        ctx.fillStyle = '#7a2d2d'; ctx.font = '30px Georgia, serif'; ctx.fillText('❦', 108, y);
        ctx.fillStyle = '#4a2f1a'; ctx.font = 'italic 29px Georgia, serif';
        const ny = this.#wrap(ctx, m.replace(/[“”]/g, '"'), 150, y, w - 250, 36);
        y = ny + 52;
      }
      return { ctx, tex, w, h };
    };

    // left page (with the header) + ‹ back affordance (recipes precede memories)
    {
      const { ctx, tex, w, h } = list(this.left, memories.slice(startL, startL + PER_PAGE), true);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(90,47,20,0.6)'; ctx.font = 'bold 96px Georgia, serif';
      ctx.fillText('‹', 96, h / 2 + 30);
      ctx.font = 'italic 24px Georgia, serif'; ctx.fillText('recipes', 96, h / 2 + 70);
      tex.needsUpdate = true;
    }
    // right page + page indicator + › next (if more memory pages)
    {
      const { ctx, tex, w, h } = list(this.right, memories.slice(startL + PER_PAGE, startL + PER_PAGE * 2), false);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8a6b4a'; ctx.font = 'italic 28px Georgia, serif';
      ctx.fillText(`memories · ${page + 1} / ${totalPages}`, w / 2, h - 90);
      if (hasNext) {
        ctx.fillStyle = 'rgba(90,47,20,0.6)'; ctx.font = 'bold 96px Georgia, serif';
        ctx.fillText('›', w - 96, h / 2 + 30);
        ctx.font = 'italic 24px Georgia, serif'; ctx.fillText('more', w - 96, h / 2 + 70);
      }
      tex.needsUpdate = true;
    }
  }
}
