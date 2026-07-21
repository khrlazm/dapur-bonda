import * as THREE from 'three/webgpu';
import { Steam } from '../fx/Steam.js';
import { Pour } from '../fx/Pour.js';
import { PulutKuning } from './episodes/PulutKuning.js';
import { PisangSira } from './episodes/PisangSira.js';

const EPISODES = {
  'pulut-kuning': PulutKuning,
  'pisang-sira': PisangSira,
};

// The game loop host. It always boots into the HUB (an empty kitchen where the
// recipe book acts as a menu). Browse the book, choose an unlocked recipe, and
// it loads that episode's props and runs the step machine. Finishing a recipe
// unlocks the next, then returns you to the hub. Every scene switch tears the
// previous episode's props down and resets state.
export class CookingSim {
  constructor({ engine, kitchen, book, hud, audio, season, save }) {
    this.engine = engine;
    this.scene = engine.scene;
    this.interaction = engine.interaction;
    this.kitchen = kitchen;
    this.book = book;
    this.hud = hud;
    this.audio = audio;
    this.season = season;
    this.save = save;

    this.mode = 'hub';
    this.episode = null;
    this.progress = 0;
    this.done = false;
    this._locked = false;
    this._pokeCd = 0;

    this.pour = new Pour(this.scene);
    this.steam = new Steam(this.scene, new THREE.Vector3(0, kitchen.counterTopY + 0.1, -0.72), { count: 80 });
    this.interaction.onPour = (o, dt, spout) => this.episode?.handlePour?.(o, dt, spout);

    this.enterHub(false, 0);
  }

  // ---------- Status / unlock logic ----------
  #status(i) {
    const s = this.save.load().recipes;
    const complete = !!s[this.season[i].id]?.complete;
    const unlocked = i === 0 || !!s[this.season[i - 1].id]?.complete;
    return { complete, unlocked, index: i, total: this.season.length, prevTitle: i > 0 ? this.season[i - 1].title : null };
  }

  // ---------- Hub ----------
  enterHub(animate, preferredIndex) {
    this._locked = true;
    clearTimeout(this._returnTimer);
    this.episode?.teardown?.();
    this.episode = null;
    this.mode = 'hub';
    this.done = false;
    this.progress = 0;
    this.steam.setIntensity(0);
    this._pokeCd = 0.7;

    this.menuIndex = Math.min(preferredIndex ?? this.menuIndex ?? 0, this.season.length - 1);
    const recipe = this.season[this.menuIndex];
    const status = this.#status(this.menuIndex);
    if (animate) this.book.flipToMenu(recipe, status);
    else this.book.drawMenu(recipe, status);
    this.#hubPrompt(recipe, status);
    this.hud.setHubControls(true);
    this._locked = false;
  }

  #hubPrompt(recipe, status) {
    const msg = status.unlocked
      ? 'Reach into the right page — or press Cook — to begin. Flip ◀ ▶ to browse the recipes.'
      : `Locked — finish ${status.prevTitle} first. Flip ◀ ▶ to browse the recipes.`;
    this.hud.setStep('❦', recipe.title, msg);
    this.hud.setProgress(0);
  }

  browseMenu(dir) {
    if (this.mode !== 'hub' || this._locked || this.book._flip) return;
    const n = this.season.length;
    this.menuIndex = (this.menuIndex + dir + n) % n;
    const recipe = this.season[this.menuIndex];
    const status = this.#status(this.menuIndex);
    this.book.flipToMenu(recipe, status, dir);
    this.#hubPrompt(recipe, status);
  }

  selectMenu() {
    if (this.mode !== 'hub' || this._locked || this.book._flip) return;
    const status = this.#status(this.menuIndex);
    if (!status.unlocked) {
      for (const h of this.interaction.hands) this.interaction.pulse(h, 0.4, 40); // "locked" buzz
      return;
    }
    this.startRecipe(this.menuIndex);
  }

  // ---------- Cooking ----------
  startRecipe(idx) {
    this.mode = 'cooking';
    this.hud.setHubControls(false);
    this.save.resetSteps(this.season[idx].id); // always a fresh cook
    this.loadEpisode(idx, { animateBook: true, fresh: true });
  }

  loadEpisode(idx, { animateBook = false, fresh = false } = {}) {
    this._locked = true;
    this.episode?.teardown?.();

    this.recipeIndex = idx;
    this.recipe = this.season[idx];
    const Ep = EPISODES[this.recipe.id];
    this.episode = new Ep(this);
    this.episode.build();
    if (this.episode.center) this.steam.setOrigin(this.episode.center.clone().setY(this.episode.center.y + 0.08));

    const rec = this.save.load().recipes[this.recipe.id];
    let step = 0;
    if (!fresh && rec) for (let i = 0; i < this.recipe.steps.length; i++) {
      if (rec.steps[this.recipe.steps[i].id]) step = i + 1; else break;
    }
    this.stepIndex = Math.min(step, this.recipe.steps.length - 1);
    this.progress = 0;
    this.done = false;
    if (!fresh) this.episode.restore?.(rec);

    const bookSave = fresh ? { steps: {} } : (rec || { steps: {} });
    if (animateBook) this.book.flipToRecipe(this.recipe, bookSave, this.stepIndex);
    else this.book.setRecipe(this.recipe, bookSave, this.stepIndex);

    this.#enterStep(this.stepIndex);
    this._locked = false;
  }

  #enterStep(i) {
    this.progress = 0;
    const step = this.recipe.steps[i];
    if (!step) return;
    this.hud.setStep(i + 1, step.title, step.instruction);
    this.episode.enterStep?.(step);
  }

  #completeStep() {
    const i = this.stepIndex;
    const step = this.recipe.steps[i];
    this.episode.onComplete?.(step);
    this.save.markStep(this.recipe.id, step.id);
    this.save.addMemory(step.memory);
    const rec = this.save.load().recipes[this.recipe.id];
    this.book.draw(rec, Math.min(i + 1, this.recipe.steps.length - 1), step.memory);
    this.hud.toast(step.memory);
    this.audio?.ding();
    for (const h of this.interaction.hands) this.interaction.pulse(h, 0.7, 60);

    if (i + 1 >= this.recipe.steps.length) this.#finishRecipe();
    else { this.stepIndex = i + 1; this.#enterStep(this.stepIndex); }
  }

  #finishRecipe() {
    this._locked = true;
    const wasComplete = this.save.isComplete(this.recipe.id);
    this.save.markRecipeComplete(this.recipe.id);
    this.hud.setStep('✓', `${this.recipe.title} — done`, this.recipe.closing);

    const nextIdx = this.recipeIndex + 1;
    if (!wasComplete && nextIdx < this.season.length) {
      this.hud.toast(`New recipe unlocked — ${this.season[nextIdx].title}`);
    }
    // pause on the closing memory, then return to the hub (showing the next dish)
    const back = Math.min(nextIdx, this.season.length - 1);
    clearTimeout(this._returnTimer);
    this._returnTimer = setTimeout(() => this.enterHub(true, back), 5200);
  }

  // ---------- Per-frame ----------
  update(dt, t) {
    this.pour.update(dt);
    this.steam.update(dt, t);

    if (this.mode === 'hub') { this.#hubUpdate(dt); return; }
    if (this.done || this._locked) return;

    const step = this.recipe.steps[this.stepIndex];
    if (!step) return;
    this.episode.detect(step, dt, t);
    this.hud.setProgress(Math.min(this.progress / step.condition.threshold, 1));
    if (this.progress >= step.condition.threshold) this.#completeStep();
  }

  // In the hub, poking the book's zones browses recipes or starts cooking.
  #hubUpdate(dt) {
    this._pokeCd -= dt;
    // Desktop selects with the on-screen buttons/keys; only VR pokes the book,
    // so the mouse cursor sweeping over it can't start a recipe by accident.
    if (!this.engine.renderer.xr.isPresenting) return;
    if (this._locked || this.book._flip || this._pokeCd > 0) return;
    for (const hand of this.interaction.hands) {
      const action = this.book.pokeTest(hand.worldPos);
      if (!action) continue;
      this._pokeCd = 0.55;
      this.interaction.pulse(hand, 0.3, 25);
      if (action === 'next') this.browseMenu(1);
      else if (action === 'prev') this.browseMenu(-1);
      else if (action === 'start') this.selectMenu();
      break;
    }
  }
}
