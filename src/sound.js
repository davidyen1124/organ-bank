// Optional room tone: mains hum, tube hiss, a relay click when a slide lands
// and a soft thump under the heart. Nothing is created until switched on.
export class Sound {
  constructor() {
    this.on = false;
    this.ctx = null;
  }

  toggle() {
    if (!this.ctx) this.build();
    this.on = !this.on;
    this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.7 : 0, this.ctx.currentTime, 0.15);
    return this.on;
  }

  build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // 60 Hz hum with a little second and third harmonic
    const hum = ctx.createGain();
    hum.gain.value = 0.11;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    for (const [f, g] of [[60, 1], [120, 0.5], [180, 0.22]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
    }
    lp.connect(hum).connect(this.master);

    // hiss
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.012;
    src.connect(bp).connect(ng).connect(this.master);
    src.start();
  }

  thump(strong) {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(strong ? 62 : 74, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.28, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  click() {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t, Math.random(), 0.06);
  }
}
