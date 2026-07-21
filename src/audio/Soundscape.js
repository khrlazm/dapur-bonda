// Immersion through place, not soundtrack. Everything here is synthesized with
// the Web Audio API — wind, cicadas, birdsong, water, the sizzle of the stove —
// so there are no audio files to ship or fail to load. Must be started from a
// user gesture (browser autoplay policy); main.js calls start() on first input.
export class Soundscape {
  constructor() {
    this.ready = false;
    this.muted = false;
  }

  start() {
    if (this.ready) { this.ctx.resume?.(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this.#noiseBuffer();
    this.#wind();
    this.#cicadas();
    this.#scheduleBirds();
    this.ready = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.2);
  }

  #noiseBuffer() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brownish
      d[i] = last * 3.5;
    }
    this.noise = buf;
  }

  #noiseSource(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = loop;
    return s;
  }

  #wind() {
    const ctx = this.ctx;
    const src = this.#noiseSource();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.12;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.06;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  }

  #cicadas() {
    const ctx = this.ctx;
    const src = this.#noiseSource();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6300; bp.Q.value = 8;
    const g = ctx.createGain(); g.gain.value = 0.015;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.01;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  }

  #scheduleBirds() {
    const chirp = () => {
      if (!this.ready) return;
      if (!this.muted) this.#bird();
      setTimeout(chirp, 1600 + Math.random() * 5000);
    };
    setTimeout(chirp, 1200);
  }

  #bird() {
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = 2 + (Math.random() * 3 | 0);
    for (let n = 0; n < notes; n++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const g = ctx.createGain();
      const base = 2200 + Math.random() * 1400;
      const st = t + n * 0.09;
      o.frequency.setValueAtTime(base, st);
      o.frequency.exponentialRampToValueAtTime(base * (1.1 + Math.random() * 0.4), st + 0.06);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.05, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
      o.connect(g); g.connect(this.master);
      o.start(st); o.stop(st + 0.1);
    }
  }

  // ---- one-shot SFX ----
  #burst(freq, q, dur, gain) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = this.#noiseSource(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  swirl() { this.#burst(900, 1.2, 0.35, 0.18); }
  sprinkle() { this.#burst(4200, 3, 0.18, 0.12); }
  fluff() { this.#burst(300, 0.8, 0.16, 0.14); }

  ding() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 1.5);
    });
  }

  // ---- sustained loops (pour, sizzle) with simple ref handles ----
  loop(kind) {
    if (!this.ready) return { stop() {} };
    const ctx = this.ctx;
    const src = this.#noiseSource(true);
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (kind === 'pour') { bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.7; g.gain.value = 0.0; }
    else { bp.type = 'highpass'; bp.frequency.value = 3200; g.gain.value = 0.0; } // sizzle/steam
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    const target = kind === 'pour' ? 0.16 : 0.06;
    g.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    return {
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(() => { try { src.stop(); } catch {} }, 400);
      },
    };
  }
}
