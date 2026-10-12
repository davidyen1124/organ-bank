import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// One monochrome picture tube. The four slides live in a 2x2 greyscale atlas;
// the loop controller (loops.js) decides which two are on screen and how far
// through the hand-over they are, the shader does the tube and the organ's warp.
const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uAtlas;
uniform vec3 uColor;
uniform float uTime, uSeed, uA, uB, uMix, uAspect, uCover, uPower, uBeat, uBreath;
uniform float uScroll, uFlash, uLines, uMirror, uGain;
uniform vec2 uGaze;
uniform int uMode, uTrans;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// s is slide space, -1..1 across one frame
float tap(float idx, vec2 s) {
  vec2 e = smoothstep(vec2(1.0), vec2(0.96), abs(s));
  vec2 u = clamp(s * .5 + .5, 0.006, 0.994);
  float i = mod(idx, 4.);
  vec2 cell = vec2(mod(i, 2.), 1. - floor(i * .5));
  return texture2D(uAtlas, (cell + u) * .5).r * e.x * e.y;
}

vec2 warp(vec2 s, float t) {
  if (uMode == 0) {            // brain: shears while a foreign frame is flashed
    s.x += uFlash * .06 * sin(s.y * 31. + t * 40.);
  } else if (uMode == 1) {     // eye: the picture leans toward whatever it watches
    s = s * .88 - uGaze * .12;
  } else if (uMode == 2) {     // lungs: inflate / empty
    s /= vec2(1. + .09 * uBreath, 1. + .05 * uBreath);
  } else if (uMode == 3) {     // heart: systole
    s /= 1. + .12 * uBeat * (1. - .4 * length(s));
  } else if (uMode == 4) {     // stomach: twist and peristalsis
    float r = length(s);
    float a = .55 * sin(t * .6) * exp(-r * 1.4) + .12 * sin(r * 7. - t * 2.2);
    float c = cos(a), sn = sin(a);
    s = mat2(c, -sn, sn, c) * s;
    s.x += .05 * sin(s.y * 4.5 - t * 2.4);
  } else if (uMode == 5) {     // kidney: folded down the middle, slowly dripping
    s.x = abs(s.x) - .36;
    s.y += .07 * vnoise(vec2(s.x * 9., t * .9)) - .035;
  }
  return s;
}

void main() {
  float t = uTime + uSeed * 37.1;
  vec2 p = vUv * 2. - 1.;
  p.x *= uMirror;

  // per-line jitter and the occasional tearing band
  float ln = floor(vUv.y * uLines);
  p.x += (hash(vec2(ln, floor(t * 30.))) - .5) * .006;
  float band = floor(vUv.y * 9. + t * .7);
  float tearOn = step(.94, hash(vec2(band, floor(t * 3.) + uSeed * 7.)));
  p.x += tearOn * (hash(vec2(ln * .37, floor(t * 24.))) - .5) * .09;

  vec2 kContain = vec2(uAspect, 1.) / min(uAspect, 1.);
  vec2 kCover = vec2(uAspect, 1.) / max(uAspect, 1.);
  vec2 k = mix(kContain, kCover, uCover);

  float v = 0.;
  if (uMode == 6) {
    // gut: endless sideways conveyor of all four frames
    vec2 s = p * k;
    float x = s.x * .5 + .5 + uScroll;
    vec2 s2 = vec2(fract(x) * 2. - 1., s.y + .07 * sin(x * 12.566 + t * 2.6));
    v = tap(floor(x), s2);
  } else {
    vec2 q = p;
    float which = 0.;
    if (uTrans == 1) {         // vertical hold slips: next frame drops in from the top
      q.y = p.y + uMix * 2.;
      if (q.y > 1.) { q.y -= 2.; which = 1.; }
    }
    vec2 s = warp(q * k, t);
    float a = tap(uA, s), b = tap(uB, s);
    if (uTrans == 0) {
      v = mix(a, b, step(.5, uMix));
    } else if (uTrans == 1) {
      v = mix(a, b, which) * smoothstep(0., .1, 1. - abs(q.y));
    } else if (uTrans == 2) {  // wipe up from the bottom with a hot leading edge
      float e = uMix * 2.7 - 1.35;
      float edge = p.y + .12 * (vnoise(vec2(p.x * 7., t * 3.)) - .5);
      v = mix(a, b, 1. - smoothstep(e - .05, e + .05, edge));
      v += .6 * exp(-pow((edge - e) * 16., 2.)) * step(.001, uMix) * step(uMix, .999);
    } else if (uTrans == 3) {  // dissolve through snow
      v = mix(a, b, step(.5, uMix));
      float st = sin(uMix * 3.14159);
      v = mix(v, hash(vUv * vec2(240., uLines) + fract(t) * 77.), st * st * .85);
    } else {                   // comb wipe sideways
      float e = uMix * 2.7 - 1.35;
      float teeth = .16 * step(.5, fract(vUv.y * uLines * .125));
      v = mix(a, b, 1. - smoothstep(e - .02, e + .02, p.x + teeth));
    }
  }

  // tube response, snow, hum bar, scanlines, mains flicker
  v = pow(max(v, 0.), .92) * 1.1 + uFlash * .2;
  v = mix(v, hash(vUv * vec2(uLines * 1.33, uLines) + fract(t * 1.37) * 91.7), .08);
  v *= .88 + .12 * sin((vUv.y * 1.2 - t * .23) * 6.2832);
  float sl = .62 + .38 * sin(vUv.y * uLines * 6.2832);
  sl = mix(sl, .62, smoothstep(.2, .55, fwidth(vUv.y * uLines)));
  v *= sl * 1.45;
  v *= .97 + .03 * hash(vec2(floor(t * 60.), uSeed));

  float vig = smoothstep(1.5, .45, length(p));

  // warm-up: a dot stretches to a line, the line opens into a raster
  float open = smoothstep(.35, 1., uPower);
  float lineY = mix(.008, 1.05, open * open);
  float widthX = mix(0., 1.05, smoothstep(0., .35, uPower));
  float m = smoothstep(lineY, lineY - .012, abs(p.y)) * smoothstep(widthX, widthX - .012, abs(p.x));
  float hot = (1. - open) * 3.;

  vec3 col = uColor * v;
  col = mix(col, vec3(v) * .9 + uColor * .1, smoothstep(.75, 1.3, v) * .5);
  col = col * uGain * vig + uColor * .035 * vig;
  col = mix(col, uColor * hot + vec3(hot * .35), 1. - open) * m;
  gl_FragColor = vec4(col, 1.);
}`;

export function makeScreenMaterial({ atlas, color, mode, aspect, cover = 0.3, lines = 240, seed = 0, mirror = 1, gain = 1.9 }) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtlas: { value: atlas },
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uA: { value: 0 },
      uB: { value: 0 },
      uMix: { value: 0 },
      uTrans: { value: 0 },
      uMode: { value: mode },
      uAspect: { value: aspect },
      uCover: { value: cover },
      uPower: { value: 0 },
      uBeat: { value: 0 },
      uBreath: { value: 0 },
      uScroll: { value: 0 },
      uFlash: { value: 0 },
      uLines: { value: lines },
      uMirror: { value: mirror },
      uGain: { value: gain },
      uGaze: { value: new THREE.Vector2() },
    },
  });
}
