import * as THREE from 'three/webgpu';
import { Steam } from '../fx/Steam.js';
import { Pour } from '../fx/Pour.js';
import { Fader } from '../core/Fader.js';
import { PulutKuning } from './episodes/PulutKuning.js';
import { PisangSira } from './episodes/PisangSira.js';
import { NasiLemak } from './episodes/NasiLemak.js';
import { SeriMuka } from './episodes/SeriMuka.js';

const EPISODES = {
  'pulut-kuning': PulutKuning,
  'pisang-sira': PisangSira,
  'nasi-lemak': NasiLemak,
  'seri-muka': SeriMuka,
};

// The game loop host. It always boots into the HUB (an empty kitchen where the
// recipe book acts as a menu). Browse the book, choose an unlocked recipe, and
// it loads that episode's props and runs the step machine. Finishing a recipe
// unlocks the next, then returns you to the hub. Every scene switch tears the
// previous episode's props down and resets state.
export class CookingSim {
  constructor({ engine, kitchen, book, hud, audio, season, save, environment }) {
    this.engine = engine;
    this.scene = engine.scene;
    this.interaction = engine.interaction;
    this.kitchen = kitchen;
    this.book = book;
    this.hud = hud;
    this.audio = audio;
    this.season = season;
    this.save = save;
    this.environment = environment;

    this.mode = 'hub';
    this.episode = null;
    this.progress = 0;
    this.done = false;
    this._locked = false;
    this._pokeCd = 0;

    this.pour = new Pour(this.scene);
    this.steam = new Steam(this.scene, new THREE.Vector3(0, kitchen.counterTopY + 0.1, -0.72), { count: 80 });
    this.fader = new Fader(this.engine.camera);
    this.interaction.onPour = (o, dt, spout) => this.episode?.handlePour?.(o, dt, spout);

    // The book sits centre-counter in the hub (raised a little so its tilted
    // front edge doesn't clip into the worktop), and moves aside while cooking.
    this.hubBookPos = new THREE.Vector3(0.1, kitchen.counterTopY + 0.13, -0.64);
    this.cookBookPos = kitchen.anchors.book.clone();

    this.enterHub(0);
  }

  // ---------- Status / unlock logic ----------
  #status(i) {
    const s = this.save.load().recipes;
    const recipe = this.season[i];
    const comingSoon = !!recipe.comingSoon;
    const complete = !comingSoon && !!s[recipe.id]?.complete;
    // A "coming soon" teaser is never cookable, even once its predecessor is done.
    const unlocked = !comingSoon && (i === 0 || !!s[this.season[i - 1].id]?.complete);
    return { comingSoon, complete, unlocked, index: i, total: this.season.length, prevTitle: i > 0 ? this.season[i - 1].title : null };
  }

  // ---------- Hub ----------
  // Called at full-black during a fade (or once at boot), so it just resets the
  // scene: tears down the episode, centres the book, and shows the menu.
  enterHub(preferredIndex) {
    this._locked = true;
    clearTimeout(this._returnTimer);
    this.episode?.teardown?.();
    this.episode = null;
    this.mode = 'hub';
    this.done = false;
    this.progress = 0;
    this.steam.setIntensity(0);
    this._pokeCd = 0.7;
    this.book.moveTo(this.hubBookPos);
    this.environment?.randomize(); // fresh time-of-day + weather for the hub

    this.menuIndex = Math.min(preferredIndex ?? this.menuIndex ?? 0, this.season.length - 1);
    const recipe = this.season[this.menuIndex];
    const status = this.#status(this.menuIndex);
    this.book.drawMenu(recipe, status);
    this.#hubPrompt(recipe, status);
    this.hud.setHubControls(true);
    this.hud.setCookingControls(false);
    this._locked = false;
  }

  #hubPrompt(recipe, status) {
    let msg = status.comingSoon
      ? 'Coming soon — a future episode. Flip ◀ ▶ to browse the recipes.'
      : status.unlocked
        ? 'Reach into the right page — or press Cook — to begin. Flip ◀ ▶ to browse the recipes.'
        : `Locked — finish ${status.prevTitle} first. Flip ◀ ▶ to browse the recipes.`;
    if (this.hubStoriesTotal) {
      msg += ` · Kitchen memories ${this.save.hubStoryCount()}/${this.hubStoriesTotal} — wander, and touch what glimmers.`;
    }
    const wx = this.environment?.label?.();
    this.hud.setStep(wx ? `❦ ${wx}` : '❦', recipe.title, msg);
    this.hud.setProgress(0);
    this.hud.setHubNav?.(status.index > 0, status.index < status.total - 1);
  }

  // Re-render the hub prompt (e.g. after a kitchen memory is discovered).
  refreshHubPrompt() {
    if (this.mode !== 'hub') return;
    this.#hubPrompt(this.season[this.menuIndex], this.#status(this.menuIndex));
  }

  browseMenu(dir) {
    if (this.mode !== 'hub' || this._locked || this.book._flip) return;
    // Clamp — no wrap-around. Wrapping made flipping back from Episode 1 land
    // on Episode 4, which read as the book being out of order (1, 4, 3, 2).
    const next = this.menuIndex + dir;
    if (next < 0 || next >= this.season.length) {
      for (const h of this.interaction.hands) this.interaction.pulse(h, 0.2, 25); // end-of-book nudge
      return;
    }
    this.menuIndex = next;
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

  // Abandon the current cook and fade back to the kitchen hub.
  returnToHubEarly() {
    if (this.mode !== 'cooking' || this.fader.busy) return;
    clearTimeout(this._returnTimer);
    this.fader.start(() => this.enterHub(this.recipeIndex));
  }

  // ---------- Cooking ----------
  // Fade to black, build the recipe's scene at full-black, then fade in.
  startRecipe(idx) {
    if (this.fader.busy) return;
    this._locked = true;
    this.hud.setHubControls(false);
    this.hud.setCookingControls(true);
    this.save.resetSteps(this.season[idx].id); // always a fresh cook
    this.fader.start(() => {
      this.mode = 'cooking';
      this.book.moveTo(this.cookBookPos);
      this.environment?.randomize(); // each cook gets its own weather too
      this.loadEpisode(idx, { fresh: true });
    });
  }

  loadEpisode(idx, { fresh = false } = {}) {
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

    this.book.setRecipe(this.recipe, fresh ? { steps: {} } : (rec || { steps: {} }), this.stepIndex);
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
    if (!wasComplete && nextIdx < this.season.length && !this.season[nextIdx].comingSoon) {
      this.hud.toast(`New recipe unlocked — ${this.season[nextIdx].title}`);
    }
    // pause on the closing memory, then fade to black and return to the hub
    // (showing the next dish).
    const back = Math.min(nextIdx, this.season.length - 1);
    clearTimeout(this._returnTimer);
    this._returnTimer = setTimeout(() => this.fader.start(() => this.enterHub(back)), 5200);
  }

  // ---------- Per-frame ----------
  update(dt, t) {
    this.fader.update(dt);
    this.pour.update(dt);
    this.steam.update(dt, t);
    if (this.fader.busy) return; // gameplay paused during a fade transition

    if (this.mode === 'hub') { this.#hubUpdate(dt); return; }
    if (this.done || this._locked) return;

    // VR: poke the book's bottom-left corner to abandon the cook and go back to
    // the kitchen hub. (Desktop uses the ⌂ Kitchen button.)
    if (this.engine.renderer.xr.isPresenting) {
      this._pokeCd -= dt;
      if (this._pokeCd <= 0 && !this.book._flip) {
        for (const hand of this.interaction.hands) {
          if (this.book.pokeTest(hand.worldPos) === 'home') {
            this._pokeCd = 0.6; this.interaction.pulse(hand, 0.35, 30);
            this.returnToHubEarly(); return;
          }
        }
      }
    }

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
