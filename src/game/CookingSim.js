import * as THREE from 'three/webgpu';
import { Steam } from '../fx/Steam.js';
import { Pour } from '../fx/Pour.js';
import { PulutKuning } from './episodes/PulutKuning.js';
import { PisangSira } from './episodes/PisangSira.js';

const EPISODES = {
  'pulut-kuning': PulutKuning,
  'pisang-sira': PisangSira,
};

// The host runs the whole season. It owns the shared FX (pour + steam), loads
// the current episode, runs a linear step machine, saves progress, drives the
// recipe book + HUD, and — when a recipe is finished — unlocks the next one and
// turns the page to it. No timers, no failure: you move on when the food is ready.
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

    this.progress = 0;
    this.done = false;
    this._locked = false;

    this.pour = new Pour(this.scene);
    this.steam = new Steam(this.scene, new THREE.Vector3(0, kitchen.counterTopY + 0.1, -0.72), { count: 80 });

    this.interaction.onPour = (o, dt, spout) => this.episode?.handlePour?.(o, dt, spout);

    this.#startFromSave();
  }

  #startFromSave() {
    const s = this.save.load();
    let idx = 0;
    for (let i = 0; i < this.season.length; i++) {
      if (s.recipes[this.season[i].id]?.complete) idx = i + 1; else { idx = i; break; }
    }
    this.loadEpisode(Math.min(idx, this.season.length - 1), false);
  }

  loadEpisode(idx, animateBook) {
    this._locked = true;
    this.episode?.teardown?.();

    this.recipeIndex = idx;
    this.recipe = this.season[idx];
    const Ep = EPISODES[this.recipe.id];
    this.episode = new Ep(this);
    this.episode.build();
    if (this.episode.center) {
      this.steam.setOrigin(this.episode.center.clone().setY(this.episode.center.y + 0.08));
    }

    const rec = this.save.load().recipes[this.recipe.id];
    let step = 0;
    if (rec) for (let i = 0; i < this.recipe.steps.length; i++) {
      if (rec.steps[this.recipe.steps[i].id]) step = i + 1; else break;
    }
    this.stepIndex = Math.min(step, this.recipe.steps.length - 1);
    this.progress = 0;
    this.episode.restore?.(rec);

    if (animateBook) this.book.flipToRecipe(this.recipe, rec || { steps: {} }, this.stepIndex);
    else this.book.setRecipe(this.recipe, rec || { steps: {} }, this.stepIndex);

    const finished = !!rec?.complete;
    if (finished && idx === this.season.length - 1) {
      this.done = true;
      this.hud.setStep('✓', 'Season complete', this.recipe.closing);
    } else {
      this.done = false;
      this.#enterStep(this.stepIndex);
    }
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
    this.save.markRecipeComplete(this.recipe.id);
    const nextIdx = this.recipeIndex + 1;
    if (nextIdx < this.season.length) {
      // Pause on the closing memory, then unlock + turn the page to the next dish.
      this._locked = true;
      this.hud.setStep('✓', `${this.recipe.title} — done`, this.recipe.closing);
      const next = this.season[nextIdx];
      clearTimeout(this._unlockTimer);
      this._unlockTimer = setTimeout(() => {
        this.hud.toast(`New recipe unlocked — ${next.title}`);
        this.loadEpisode(nextIdx, true);
      }, 5200);
    } else {
      this.done = true;
      this.hud.setStep('✓', 'Season complete', this.recipe.closing);
    }
  }

  update(dt, t) {
    this.pour.update(dt);
    this.steam.update(dt, t);
    if (this.done || this._locked) return;

    const step = this.recipe.steps[this.stepIndex];
    if (!step) return;
    this.episode.detect(step, dt, t);
    this.hud.setProgress(Math.min(this.progress / step.condition.threshold, 1));
    if (this.progress >= step.condition.threshold) this.#completeStep();
  }
}
