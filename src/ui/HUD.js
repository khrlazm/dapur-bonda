// Thin wrapper over the DOM overlay: current step card, a subtle progress sheen,
// memory toasts, and the sound/book buttons.
export class HUD {
  constructor() {
    this.hud = document.getElementById('hud');
    this.stepCard = document.getElementById('step-card');
    this.toastEl = document.getElementById('toast');
    this._toastTimer = null;
  }

  show() { this.hud.hidden = false; }

  setStep(num, title, instruction) {
    this.stepCard.innerHTML = `
      <h2><span class="step-num">Step ${num}</span> · ${title}</h2>
      <p>${instruction}</p>
      <div class="progress" style="height:4px;margin-top:8px;background:rgba(74,47,26,0.18);border-radius:2px;overflow:hidden">
        <div id="progbar" style="height:100%;width:0%;background:linear-gradient(90deg,#b08d3f,#e0b45a);transition:width .2s"></div>
      </div>`;
    this.progbar = document.getElementById('progbar');
  }

  setProgress(f) {
    if (this.progbar) this.progbar.style.width = `${Math.round(f * 100)}%`;
  }

  toast(text) {
    this.toastEl.textContent = text.replace(/[“”]/g, '"');
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 5200);
  }
}
