import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { ORGANS } from './organs.js';
import { BEAT, runLoop } from './loops.js';
import { makeMaterials } from './scene/materials.js';
import { buildRoom } from './scene/room.js';
import { buildSculpture } from './scene/sculpture.js';
import { createUI } from './ui.js';
import { Sound } from './sound.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;

// ?t=12.5 freezes the clock (used for screenshots), ?focus=heart opens on an organ
const query = new URLSearchParams(location.search);
const still = query.has('t');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;

const canvas = document.getElementById('gl');
const sound = new Sound();
let focusIndex = -1;
let sculpture = null;

const ui = createUI({
  organs: ORGANS,
  onSelect: (i) => setFocus(i),
  onStep: (d) => setFocus((focusIndex + d + ORGANS.length) % ORGANS.length),
  onBack: () => setFocus(-1),
  onSound: () => sound.toggle(),
});

// ───────── renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  ui.fail('This piece needs WebGL, which is not available here');
  throw err;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040405);
scene.fog = new THREE.Fog(0x040405, 9, 22);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.28;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.45, 0.65, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 c = vUv - .5; float r2 = dot(c, c);
      vec2 off = c * r2 * .012;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col += (hash(gl_FragCoord.xy + fract(uTime) * 931.) - .5) * .04;
      col *= 1. - smoothstep(.12, .62, r2) * .6;
      gl_FragColor = vec4(col, 1.);
    }`,
});
composer.addPass(film);

// ───────── camera rig: a target, a distance and two angles, eased toward a goal
const rig = { target: V(0, 1.3, 0.15), dist: 6, yaw: 0, pitch: 0, uy: 0, up: 0 };
const goal = { target: V(0, 1.3, 0.15), dist: 6, yaw: 0, pitch: 0 };
const drag = { yaw: 0, pitch: 0, on: false, moved: 0, x: 0, y: 0, idle: 0 };
const pointer = { x: 0, y: 0, hover: 0, active: false };
let zoom = 1;
let snap = true;
if (query.has('yaw')) drag.yaw = parseFloat(query.get('yaw'));
if (query.has('pitch')) drag.pitch = parseFloat(query.get('pitch'));

function pose() {
  const aspect = camera.aspect;
  const tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const portrait = aspect < 0.85;
  if (focusIndex < 0 || !sculpture) {
    const w = portrait ? 1.86 : 2.3, h = portrait ? 2.8 : 2.74;
    const d = Math.max(h / 2 / tanF, w / 2 / (tanF * aspect));
    const visW = 2 * d * tanF * aspect;
    goal.target.set(aspect > 1.25 ? -visW * 0.1 : 0, portrait ? 1.34 : 1.27, 0.15);
    goal.dist = d;
    goal.yaw = 0;
    goal.pitch = 0;
    return;
  }
  const f = sculpture.focus[focusIndex];
  const n = f.normal.clone().lerp(V(0, 0, 1), 0.5).normalize();
  const need = Math.max(f.h / (portrait ? 0.3 : 0.5), f.w / ((portrait ? 0.8 : 0.5) * aspect));
  const d = Math.max(0.6, need / (2 * tanF));
  const visH = 2 * d * tanF;
  goal.target.copy(f.center);
  if (portrait) goal.target.y -= visH * 0.2;
  else if (aspect > 1.25) goal.target.x -= visH * aspect * 0.14;
  goal.dist = d;
  goal.yaw = Math.atan2(n.x, n.z);
  goal.pitch = Math.asin(n.y);
}

function setFocus(i) {
  if (!sculpture) return;
  focusIndex = i;
  if (!still) drag.yaw = drag.pitch = 0;
  zoom = 1;
  ui.setFocus(i);
  ui.hintOff();
  pose();
}

// resolution steps down if the device cannot hold the frame rate
let dprCap = mobile ? 1.5 : 2;
let slow = 0;

function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.85 ? 34 : 30;
  camera.updateProjectionMatrix();
  pose();
}
addEventListener('resize', resize);

// ───────── input
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(clientX, clientY) {
  if (!sculpture) return null;
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(sculpture.units.map((u) => u.hit), false)[0];
  return hit ? hit.object.userData.unit : null;
}

const touches = new Map();
let pinch = 0;
const spread = () => {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

canvas.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (touches.size === 2) {
    pinch = spread();
    drag.on = false;
    drag.moved = 99;
    return;
  }
  drag.on = true;
  drag.moved = 0;
  drag.x = e.clientX;
  drag.y = e.clientY;
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  pointer.active = true;
  pointer.hover = 0;
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && pinch) {
    const d = spread();
    zoom = clamp((zoom * pinch) / d, 0.55, 1.25);
    pinch = d;
    ui.hintOff();
    return;
  }
  if (drag.on) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.yaw = clamp(drag.yaw - dx * 0.0045, -0.8, 0.8);
    drag.pitch = clamp(drag.pitch + dy * 0.003, -0.1, 0.32);
    drag.idle = 0;
    if (drag.moved > 8) ui.hintOff();
  } else if (e.pointerType === 'mouse') {
    canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : '';
  }
});
const release = (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = 0;
  canvas.classList.remove('dragging');
  if (!drag.on) return;
  drag.on = false;
  if (e.type === 'pointerup' && drag.moved < 8) {
    const unit = pick(e.clientX, e.clientY);
    if (unit) setFocus(ORGANS.indexOf(unit.organ));
    else if (focusIndex >= 0) setFocus(-1);
  }
  if (e.pointerType !== 'mouse') pointer.active = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { pointer.active = false; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom = clamp(zoom * Math.exp(e.deltaY * 0.0012), 0.55, 1.25);
}, { passive: false });
addEventListener('keydown', (e) => {
  if (ui.modal || !sculpture) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setFocus((focusIndex + 1) % ORGANS.length);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setFocus((focusIndex + ORGANS.length - (focusIndex < 0 ? 0 : 1)) % ORGANS.length);
  else if (e.key === 'Escape') setFocus(-1);
  else return;
  e.preventDefault();
});

// ───────── frame
const POWER_ON = { gut: 0.3, kidney: 0.8, stomach: 1.2, heart: 1.6, lungs: 2.0, eye: 2.5, brain: 2.9 };
const LAMP = 1.15;
const look = V();
const right = V(), up = V();
let time = still ? parseFloat(query.get('t')) || 0 : 0;
let last = performance.now();
let beatNo = -1;
let frameNo = 0;
const SHADOW_EVERY = mobile ? 4 : 2;

function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw);
  last = now;
  if (!still) time += dt;
  const t = time;

  // camera
  drag.idle += dt;
  if (!drag.on && !still && drag.idle > 3.5) {
    const decay = Math.exp(-dt * 0.7);
    drag.yaw *= decay;
    drag.pitch *= decay;
  }
  const k = snap || still ? 1 : 1 - Math.exp(-dt * 3);
  rig.target.lerp(goal.target, k);
  rig.dist += (goal.dist * zoom - rig.dist) * k;
  rig.yaw += (goal.yaw - rig.yaw) * k;
  rig.pitch += (goal.pitch - rig.pitch) * k;
  const par = pointer.active && !mobile ? 1 : 0;
  const ku = snap || still ? 1 : 1 - Math.exp(-dt * 5);
  rig.uy += (drag.yaw + pointer.x * 0.07 * par - rig.uy) * ku;
  rig.up += (drag.pitch - pointer.y * 0.035 * par - rig.up) * ku;
  snap = false;
  const drift = still || reducedMotion ? 0 : 1;
  const yaw = rig.yaw + rig.uy + drift * 0.05 * Math.sin(t * 0.11);
  const pitch = rig.pitch + rig.up + drift * 0.012 * Math.sin(t * 0.17);
  camera.position.set(
    rig.target.x + rig.dist * Math.sin(yaw) * Math.cos(pitch),
    Math.max(0.14, rig.target.y + rig.dist * Math.sin(pitch)),
    Math.max(0.6, rig.target.z + rig.dist * Math.cos(yaw) * Math.cos(pitch)),
  );
  camera.lookAt(rig.target);

  if (sculpture) {
    // the eyes watch the cursor, or you, with the odd nervous glance
    camera.updateMatrixWorld();
    camera.matrixWorld.extractBasis(right, up, look);
    look.copy(camera.position);
    pointer.hover += dt;
    if (pointer.active && pointer.hover < 4) {
      look.addScaledVector(right, pointer.x * rig.dist * 0.42).addScaledVector(up, pointer.y * rig.dist * 0.26);
    } else if (!reducedMotion) {
      const g = Math.floor(t / 1.9);
      look.addScaledVector(right, Math.sin(g * 12.9) * rig.dist * 0.16).addScaledVector(up, Math.sin(g * 7.3) * rig.dist * 0.07);
    }

    const sinceBoot = still ? 99 : t;
    for (const u of sculpture.units) {
      u.power = clamp((sinceBoot - POWER_ON[u.id]) / 1.6, 0, 1);
      const { level, changed } = runLoop(u, t, { reducedMotion });
      if (u.light) u.light.intensity = LAMP * u.lamp * level * u.power;
      if (changed && u.power === 1 && u.id !== 'eye' && u.id !== 'heart') sound.click();
    }
    sculpture.update(t, dt, { look, reducedMotion });
    if (focusIndex >= 0) ui.setFrame(sculpture.focus[focusIndex].units[0].slide);

    const b = Math.floor(t / BEAT);
    if (b !== beatNo) {
      beatNo = b;
      sound.thump(b % 4 === 0);
    }
  }

  // three slow seconds in a row: trade resolution for frame rate
  slow = raw > 1 / 38 && raw < 0.5 && !still ? slow + raw : 0;
  if (slow > 3 && dprCap > 1) {
    dprCap = Math.max(1, dprCap - 0.25);
    slow = 0;
    resize();
  }

  // nothing that casts a shadow moves fast, so the shadow map can skip frames
  frameNo++;
  if (still || frameNo % SHADOW_EVERY === 0) renderer.shadowMap.needsUpdate = true;

  film.uniforms.uTime.value = t;
  composer.render(dt);
  requestAnimationFrame(frame);
}

// ───────── load
async function init() {
  resize();
  let loaded = 0;
  // files in public/ are addressed from the base ('/' in dev, './' in the build), never from the domain root
  const asset = (p) => `${import.meta.env.BASE_URL}assets/${p}`;
  const files = [
    ...ORGANS.map((o) => [`slides.${o.id}`, asset(`slides/${o.id}.webp`), true]),
    ['concrete', asset('tex/concrete.webp'), true],
    ['floor', asset('tex/floor.webp'), true],
    ['pcb', asset('tex/pcb.webp'), true],
    ['grunge', asset('tex/grunge.webp'), false],
  ];
  const loader = new THREE.TextureLoader();
  const tex = { slides: {} };
  await Promise.all([
    ...files.map(async ([key, url, srgb]) => {
      const t = await loader.loadAsync(url);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 4;
      if (key.startsWith('slides.')) tex.slides[key.slice(7)] = t;
      else tex[key] = t;
      ui.progress(++loaded / files.length);
    }),
    document.fonts.load('700 100px "Barlow Condensed"'),
    document.fonts.load('500 30px "IBM Plex Mono"'),
  ]);
  tex.grunge.wrapS = tex.grunge.wrapT = THREE.RepeatWrapping;

  const mats = makeMaterials(tex);
  scene.add(buildRoom({ tex, mobile }));
  sculpture = buildSculpture({ mats, tex, organs: ORGANS, mobile });
  scene.add(sculpture.root);

  const start = query.get('focus');
  if (start) setFocus(ORGANS.findIndex((o) => o.id === start));
  pose();
  snap = true;
  renderer.compile(scene, camera);
  last = performance.now();
  requestAnimationFrame((now) => {
    frame(now);
    ui.ready();
    // small hook for the QA scripts
    window.__ob = {
      ready: true,
      focus: (id) => setFocus(ORGANS.findIndex((o) => o.id === id)),
      where: (id) => {
        const p = sculpture.focus[ORGANS.findIndex((o) => o.id === id)].units[0].crt.userData.screen.getWorldPosition(V()).project(camera);
        return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
      },
      get dpr() { return renderer.getPixelRatio(); },
    };
  });
}

init().catch((err) => {
  console.error(err);
  ui.fail('Could not start WebGL');
});
