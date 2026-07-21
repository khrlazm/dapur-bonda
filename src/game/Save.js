// The recipe book IS the save file. We persist which steps/recipes are complete
// so the illustrated pages stay "filled in" between visits.
const KEY = 'dapur-bonda-save-v1';

export const Save = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { recipes: {}, memories: [] };
    } catch {
      return { recipes: {}, memories: [] };
    }
  },
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
