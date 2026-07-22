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
    this.#music();
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

  // A tinny little radio tune — a few pentatonic notes through a bandpass so it
  // sounds like an old kampung radio.
  radio() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2.5;
    bp.connect(this.master);
    const notes = [523, 587, 659, 784, 659, 880, 784];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      const st = t + i * 0.16;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.12, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.15);
      o.connect(g); g.connect(bp);
      o.start(st); o.stop(st + 0.18);
    });
  }

  // A soft kettle whistle sliding up and fading.
  whistle() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(2300, t + 0.5);
    const v = ctx.createOscillator(); v.frequency.value = 9; // vibrato
    const vg = ctx.createGain(); vg.gain.value = 30;
    v.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(this.master);
    o.start(t); v.start(t); o.stop(t + 1); v.stop(t + 1);
  }

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
    else if (kind === 'rain') { bp.type = 'lowpass'; bp.frequency.value = 2600; g.gain.value = 0.0; } // rain on the roof
    else { bp.type = 'highpass'; bp.frequency.value = 3200; g.gain.value = 0.0; } // sizzle/steam
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    const target = kind === 'pour' ? 0.16 : kind === 'rain' ? 0.14 : 0.06;
    g.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    return {
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(() => { try { src.stop(); } catch {} }, 400);
      },
    };
  }

  // ---- Tintinnabuli soundtrack ----
  // A warm, sparse Arvo Pärt-style bed: a melodic voice steps through F major
  // while a "tintinnabuli" voice sounds the nearest note of the tonic triad,
  // over a soft breathing drone. Bell-like, consoling, and quiet enough to sit
  // under the kampung ambience. Generative — it never loops or repeats exactly.
  #music() {
    const ctx = this.ctx;
    this.musicMel = 174.61; // F3, the melody's lowest note
    this._mIndex = 4;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    this.musicGain.gain.setTargetAtTime(0.6, ctx.currentTime, 6); // slow fade-in

    // Convolution reverb from a synthesized decaying-noise impulse for warmth.
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.musicGain.connect(this.master);        // dry
    this.musicGain.connect(conv); conv.connect(wet); wet.connect(this.master); // wet

    this.#drone();
    this.#scheduleMusic();
  }

  #drone() {
    const ctx = this.ctx;
    const root = this.musicMel / 2; // F2
    [root, root * 1.5].forEach((f, i) => { // root + fifth
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.06 : 0.035;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(this.musicGain);
      o.start(); lfo.start();
    });
  }

  // A soft bell/celesta-ish tone with a slow swell and long tail.
  #tone(freq, dur, gain) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const shimmer = ctx.createOscillator(); shimmer.type = 'sine'; shimmer.frequency.value = freq * 2.001;
    const sg = ctx.createGain(); sg.gain.value = 0.28;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); shimmer.connect(sg); sg.connect(g); g.connect(lp); lp.connect(this.musicGain);
    o.start(t); shimmer.start(t); o.stop(t + dur + 0.3); shimmer.stop(t + dur + 0.3);
  }

  #scheduleMusic() {
    const step = () => {
      if (!this.ready) return;
      if (!this.muted) this.#phraseNote();
      this._musicTimer = setTimeout(step, 1700 + Math.random() * 1700);
    };
    this._musicTimer = setTimeout(step, 2000);
  }

  #phraseNote() {
    const scale = [0, 2, 4, 5, 7, 9, 11]; // major scale semitone offsets
    const r = Math.random();
    if (r < 0.14) return; // a rest — space is part of the music
    let d = r < 0.64 ? (Math.random() < 0.5 ? 1 : -1)   // mostly stepwise
      : r < 0.84 ? (Math.random() < 0.5 ? 2 : -2)       // occasional leap
        : 0;                                             // or a repeated note
    this._mIndex += d;
    if (this._mIndex < 0) this._mIndex = 1;
    if (this._mIndex > 12) this._mIndex = 11;            // ~1.8 octaves

    const toFreq = (idx) => this.musicMel * Math.pow(2, (scale[((idx % 7) + 7) % 7] + 12 * Math.floor(idx / 7)) / 12);
    const mFreq = toFreq(this._mIndex);

    // Tintinnabuli voice: nearest tonic-triad note (scale degrees 0,2,4),
    // superior (above) or inferior (below) the melody note.
    const triad = [0, 2, 4];
    const superior = Math.random() < 0.6;
    let tIndex = this._mIndex;
    for (let k = 1; k <= 7; k++) {
      const cand = this._mIndex + (superior ? k : -k);
      if (triad.includes(((cand % 7) + 7) % 7)) { tIndex = cand; break; }
    }
    const dur = 2.4 + Math.random() * 1.8;
    this.#tone(mFreq, dur, 0.09);
    this.#tone(toFreq(tIndex), dur * 0.9, 0.06);
  }
}
