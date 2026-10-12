// Slide timing for each organ. Everything is a pure function of time so every
// tube stays in step with the rhythm it belongs to (and screenshots repeat).

export const BEAT = 60 / 72;   // seconds per heartbeat
export const BREATH = 60 / 14; // seconds per breath

const frac = (x) => x - Math.floor(x);
const h1 = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// lub-dub envelope, 0..1
export function heartbeat(t) {
  const ph = frac(t / BEAT);
  const lub = ph < 0.035 ? ph / 0.035 : Math.exp(-(ph - 0.035) * 12);
  const dub = ph < 0.3 ? 0 : ph < 0.33 ? ((ph - 0.3) / 0.03) * 0.55 : 0.55 * Math.exp(-(ph - 0.33) * 15);
  return Math.min(1, lub + dub);
}

export const breath = (t) => Math.sin((t / BREATH) * Math.PI * 2);

// hold frame k for `dur`, hand over to k+1 during the last `tr` seconds
function sequence(t, dur, tr, offset) {
  const k = Math.floor(t / dur);
  const f = t - k * dur;
  return { a: (k + offset) % 4, b: (k + 1 + offset) % 4, mix: f > dur - tr ? (f - (dur - tr)) / tr : 0 };
}

const EYE_SCRIPT = [
  [3.4, 0], [4.7, 1], [4.84, 2], [6.5, 0], [6.62, 2], [8.1, 3], [8.24, 2], [9.2, 0],
];

// Writes the loop state into the unit's shader uniforms and returns
// { slide, level, changed } for the UI, the lamp and the sound.
export function runLoop(unit, t, { reducedMotion = false } = {}) {
  const u = unit.material.uniforms;
  const off = unit.slideOffset;
  let a = 0, b = 0, mix = 0, trans = 0, flash = 0, level = 1, slide = 0;

  switch (unit.organ.mode) {
    case 0: { // brain
      ({ a, b, mix } = sequence(t, 5.2, 0.45, off));
      trans = 3;
      slide = mix > 0.5 ? b : a;
      const j = Math.floor(t / 1.3);
      if (!reducedMotion && mix === 0 && h1(j) > 0.3 && t - j * 1.3 < 0.08) {
        a = b = (a + 1 + Math.floor(h1(j + 0.5) * 3)) % 4;
        flash = 1;
      }
      level = 1 + flash * 0.4;
      break;
    }
    case 1: { // eye
      const f = t % 9.2;
      slide = EYE_SCRIPT.find(([end]) => f < end)[1];
      a = b = slide;
      level = slide === 2 ? 0.75 : 1;
      break;
    }
    case 2: { // lungs
      ({ a, b, mix } = sequence(t, BREATH * 2, 1.25, off));
      trans = 2;
      slide = mix > 0.5 ? b : a;
      level = 0.9 + 0.14 * breath(t);
      break;
    }
    case 3: { // heart
      const beatNo = Math.floor(t / BEAT);
      const env = heartbeat(t);
      a = b = slide = (Math.floor(beatNo / 4) + off) % 4;
      flash = beatNo % 4 === 0 ? env * 0.45 : 0;
      level = 0.55 + 0.75 * env;
      break;
    }
    case 4: { // stomach
      ({ a, b, mix } = sequence(t, 6.4, 1.1, off));
      trans = 1;
      slide = mix > 0.5 ? b : a;
      break;
    }
    case 5: { // kidney
      ({ a, b, mix } = sequence(t, 5, 0.8, off));
      trans = 4;
      slide = mix > 0.5 ? b : a;
      break;
    }
    default: { // gut
      const scroll = t * 0.11;
      u.uScroll.value = scroll % 4;
      slide = Math.floor(scroll + 0.5) % 4;
    }
  }

  u.uA.value = a;
  u.uB.value = b;
  u.uMix.value = mix;
  u.uTrans.value = trans;
  u.uFlash.value = flash;
  const changed = slide !== unit.slide;
  unit.slide = slide;
  return { slide, level, changed };
}
