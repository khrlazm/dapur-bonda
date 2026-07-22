// Thin wrapper over the DOM overlay: current step card, a subtle progress sheen,
// memory toasts, and the sound/book buttons.
export class HUD {
  constructor() {
    this.hud = document.getElementById('hud');
    this.stepCard = document.getElementById('step-card');
    this.toastEl = document.getElementById('toast');
    this.hubControls = document.getElementById('hub-controls');
    this.hubButton = document.getElementById('btn-hub');
    this._toastTimer = null;
    this.worldPanel = null; // in-world 3D panel, mirrored for VR
  }

  show() { this.hud.hidden = false; }

  // Show/hide the desktop recipe-menu buttons (◀ Cook ▶).
  setHubControls(show) { this.hubControls.style.display = show ? 'inline' : 'none'; }

  // Show/hide the desktop "⌂ Kitchen" (return to hub) button while cooking.
  setCookingControls(show) { if (this.hubButton) this.hubButton.style.display = show ? 'inline' : 'none'; }

  // Grey out ◀/▶ at the ends of the book (browsing clamps, no wrap-around).
  setHubNav(canPrev, canNext) {
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) { prev.disabled = !canPrev; prev.style.opacity = canPrev ? '1' : '0.4'; }
    if (next) { next.disabled = !canNext; next.style.opacity = canNext ? '1' : '0.4'; }
  }

  setStep(num, title, instruction) {
    this.stepCard.innerHTML = `
      <h2><span class="step-num">Step ${num}</span> · ${title}</h2>
      <p>${instruction}</p>
      <div class="progress" style="height:4px;margin-top:8px;background:rgba(74,47,26,0.18);border-radius:2px;overflow:hidden">
        <div id="progbar" style="height:100%;width:0%;background:linear-gradient(90deg,#b08d3f,#e0b45a);transition:width .2s"></div>
      </div>`;
    this.progbar = document.getElementById('progbar');
    this.worldPanel?.setStep(num, title, instruction);
  }

  setProgress(f) {
    if (this.progbar) this.progbar.style.width = `${Math.round(f * 100)}%`;
    this.worldPanel?.setProgress(f);
  }

  toast(text) {
    this.toastEl.textContent = text.replace(/[“”]/g, '"');
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 5200);
    this.worldPanel?.toast(text);
  }
}
