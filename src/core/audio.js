// Synthesised engine + ambience (no audio files). Off by default; the user opts in.

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // engine: two detuned saws through a low-pass, plus a sub square
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 0.9;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.filter.connect(this.engineGain).connect(this.master);
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'triangle';
    this.oscB.detune.value = 14;
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    this.oscA.connect(this.filter);
    this.oscB.connect(this.filter);
    this.sub.connect(subGain).connect(this.filter);

    // noise bed: road/wind/boost and rain
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 800;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'highpass';
    this.rainFilter.frequency.value = 2500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    noise.connect(this.rainFilter).connect(this.rainGain).connect(this.master);

    // daytime: a soft, distant city murmur (low-passed noise) plus occasional birdsong
    this.cityFilter = ctx.createBiquadFilter();
    this.cityFilter.type = 'lowpass';
    this.cityFilter.frequency.value = 380;
    this.cityGain = ctx.createGain();
    this.cityGain.gain.value = 0;
    noise.connect(this.cityFilter).connect(this.cityGain).connect(this.master);
    this.birdBus = ctx.createGain();
    this.birdBus.gain.value = 0;
    this.birdBus.connect(this.master);
    this.nextChirp = 0;

    for (const o of [this.oscA, this.oscB, this.sub, noise]) o.start();
    return true;
  }

  async setEnabled(v) {
    this.on = v;
    if (v && !this.ctx && !this._init()) return;
    if (!this.ctx) return;
    if (v && this.ctx.state === 'suspended') await this.ctx.resume();
    this.master.gain.setTargetAtTime(v ? 0.4 : 0, this.ctx.currentTime, 0.2);
  }

  // Pause output while the 3D view isn't visible (background tab, classic view).
  suspend(paused) {
    if (!this.ctx) return;
    if (paused) this.ctx.suspend();
    else if (this.on) this.ctx.resume();
  }

  update({ speed = 0, throttle = 0, boost = false, night = 0, idle = false }) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, Math.abs(speed) / 70);
    // fake gear changes for character
    const gear = s * 4.2;
    const g = gear - Math.floor(gear);
    const rpm = 0.25 + 0.75 * (Math.floor(gear) === 0 ? s * 4.2 : 0.35 + g * 0.65);
    const f = 38 + rpm * 70 + (boost ? 25 : 0);
    this.oscA.frequency.setTargetAtTime(f, t, 0.05);
    this.oscB.frequency.setTargetAtTime(f * 1.005, t, 0.05);
    this.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.filter.frequency.setTargetAtTime(180 + rpm * 650 + Math.max(0, throttle) * 300 + (boost ? 600 : 0), t, 0.08);
    // the engine is silent until you're actually driving (no drone on the intro or while reading)
    this.engineGain.gain.setTargetAtTime(idle ? 0 : 0.062 + Math.max(0, throttle) * 0.042, t, 0.25);
    this.windGain.gain.setTargetAtTime(idle ? 0 : s * 0.1 + (boost ? 0.07 : 0), t, 0.25);
    this.windFilter.frequency.setTargetAtTime(500 + s * 1500 + (boost ? 1200 : 0), t, 0.1);
    // ambience: rain by night, birds + distant city by day (both very quiet)
    const day = 1 - night;
    this.rainGain.gain.setTargetAtTime(night > 0.6 ? 0.022 : 0, t, 0.5);
    this.cityGain.gain.setTargetAtTime(day * 0.05, t, 0.6);
    this.birdBus.gain.setTargetAtTime(day * (idle ? 1 : 0.6), t, 0.6);
    if (day > 0.4 && t > this.nextChirp) {
      this.birdsong();
      this.nextChirp = t + 1.6 + Math.random() * 4.5;
    }
  }

  // A short phrase of 2–4 synthesised chirps, panned somewhere in the "trees".
  birdsong() {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = Math.random() * 1.4 - 0.7;
      pan.connect(this.birdBus);
    }
    const out = pan || this.birdBus;
    const base = 2600 + Math.random() * 1600;
    const notes = 2 + Math.floor(Math.random() * 3);
    let at = ctx.currentTime + 0.02;
    for (let k = 0; k < notes; k++) {
      const dur = 0.06 + Math.random() * 0.07;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const f0 = base * (0.9 + Math.random() * 0.25);
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.35 : 0.75), at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.018 + Math.random() * 0.012, at + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.02);
      at += dur + 0.04 + Math.random() * 0.08;
    }
  }

  blip(freq = 880) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }
}
