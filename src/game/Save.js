// The recipe book IS the save file. We persist which steps/recipes are complete
// so the illustrated pages stay "filled in" between visits.
const KEY = 'dapur-bonda-save-v1';

export const Save = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { recipes: {}, memories: [], hubStories: {} };
    } catch {
      return { recipes: {}, memories: [], hubStories: {} };
    }
  },
  // Environmental-storytelling discoveries in the hub kitchen.
  markHubStory(id) {
    const s = this.load();
    s.hubStories = s.hubStories || {};
    s.hubStories[id] = true;
    this.save(s);
    return s;
  },
  hasHubStory(id) { return !!this.load().hubStories?.[id]; },
  hubStoryCount() { return Object.keys(this.load().hubStories || {}).length; },
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  },
  markStep(recipeId, stepId) {
    const s = this.load();
    s.recipes[recipeId] = s.recipes[recipeId] || { steps: {}, complete: false };
    s.recipes[recipeId].steps[stepId] = true;
    this.save(s);
    return s;
  },
  // Clear a recipe's per-run step ticks (for a fresh cook) while keeping its
  // completed flag so unlocks and the menu's ✓ persist.
  resetSteps(recipeId) {
    const s = this.load();
    if (s.recipes[recipeId]) { s.recipes[recipeId].steps = {}; this.save(s); }
    return s;
  },
  isComplete(recipeId) {
    return !!this.load().recipes[recipeId]?.complete;
  },
  markRecipeComplete(recipeId) {
    const s = this.load();
    s.recipes[recipeId] = s.recipes[recipeId] || { steps: {}, complete: false };
    s.recipes[recipeId].complete = true;
    this.save(s);
    return s;
  },
  addMemory(text) {
    const s = this.load();
    if (!s.memories.includes(text)) { s.memories.push(text); this.save(s); }
    return s;
  },
  reset() { try { localStorage.removeItem(KEY); } catch {} },
};
