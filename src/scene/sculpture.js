import * as THREE from 'three';
import { createCRT, addCage } from './crt.js';
import { makeScreenMaterial } from './screen.js';
import {
  V, bake, box, cyl, orient, between, bolt, rail, roundedPlate, heatsink, perfBox,
  bezier, tube, plug, corrugated, coil,
} from './hardware.js';
import { stencil, hazardSticker, tagPlate, placard } from './decals.js';
import { heartbeat, breath } from '../loops.js';

const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);
const HIT = new THREE.MeshBasicMaterial();
const _q = new THREE.Quaternion();
const _v = V();

// A body pinned to the wall: every organ is its own bare picture tube, hung
// roughly where it belongs, wired to a perforated sternum on a T-slot spine.
export function buildSculpture({ mats, tex, organs, mobile = false }) {
  const root = new THREE.Group();
  const fixed = new THREE.Group();
  root.add(fixed);
  const units = [];
  const leds = [];
  const byId = Object.fromEntries(organs.map((o) => [o.id, o]));

  const add = (o, x, y, z) => {
    if (x !== undefined) o.position.set(x, y, z);
    fixed.add(o);
    return o;
  };

  function addUnit(id, { w, h, depth, round = false, pos, rot = [0, 0, 0], mirror = 1, slideOffset = 0, cage = {}, crtZ = 0, lines, lamp = 1, anodeSide = 1, lit = true }) {
    const organ = byId[id];
    const material = makeScreenMaterial({
      atlas: tex.slides[id], color: organ.color, mode: organ.mode, aspect: w / h, cover: organ.cover,
      lines: lines ?? 170, seed: units.length * 0.618 + 0.1, mirror,
    });
    const crt = createCRT({ w, h, depth, round, anodeSide, mats, screenMat: material });
    if (cage) addCage(crt, mats, cage);
    crt.position.z = crtZ;
    const group = new THREE.Group();
    group.position.set(...pos);
    group.rotation.set(...rot);
    group.add(crt);
    // soft falloff on purpose: the glow should stain the wall without scorching the hardware next to it
    let light = null;
    if (lit) {
      // The lamp sits just behind the faceplate: it stains the wall and the
      // hardware around the tube without throwing a highlight onto its own glass.
      light = new THREE.PointLight(organ.color, 0, 1.5, 0.6);
      light.position.set(0, 0, crtZ - 0.04);
      group.add(light);
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w * 1.3, 0.17), Math.max(h * 1.3, 0.17), depth * 0.7), HIT);
    hit.position.z = crtZ - depth * 0.3;
    hit.userData.keep = true;
    hit.visible = false;
    group.add(hit);
    root.add(group);
    group.updateMatrixWorld(true);
    const unit = {
      id, organ, group, crt, material, light, hit, mirror, slideOffset, lamp, w, h,
      slide: -1, power: 0, yaw: 0, pitch: 0,
      base: { pos: group.position.clone(), quat: group.quaternion.clone() },
      pivot: crt.userData.plate ? crt.localToWorld(V(0, 0, crt.userData.plate.z)) : group.position.clone(),
    };
    hit.userData.unit = unit;
    crt.userData.screen.castShadow = true;
    units.push(unit);
    return unit;
  }

  const at = (unit, key) => unit.crt.localToWorld(unit.crt.userData[key].clone());
  const dir = (unit, key) => unit.crt.userData[key].clone().transformDirection(unit.crt.matrixWorld);
  const local = (unit, x, y, z) => unit.crt.localToWorld(V(x, y, z));

  function cable(p1, d1, p2, d2, { r = 0.005, mat = mats.rubber, sag = 0.05, k, ends = true, plugMat = mats.steel } = {}) {
    const c = bezier(p1, d1, p2, d2, sag, k);
    fixed.add(tube(c, r, mat));
    if (ends) {
      fixed.add(plug(c, 0, r * 1.9, r * 6, plugMat));
      fixed.add(plug(c, 1, r * 1.9, r * 6, plugMat));
    }
    return c;
  }

  function led(color, x, y, z, fn, parent = root) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.0045, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 3, roughness: 0.3 }),
    );
    m.position.set(x, y, z);
    m.userData.keep = true;
    parent.add(m);
    leds.push({ m, fn });
    return m;
  }

  // ───────── spine
  const SZ = 0.045;
  add(rail(1.94, mats.alu), 0, 1.47, SZ);
  for (const y of [0.56, 1.28, 2.4]) {
    add(box(0.13, 0.05, 0.006, mats.steel), 0, y, 0.004);
    for (const s of [-1, 1]) fixed.add(bolt(V(s * 0.05, y, 0.007), AZ, 0.007, mats.steel));
  }
  for (let y = 0.86; y < 2.16; y += 0.086) {
    add(box(0.062, 0.03, 0.05, mats.black), 0, y, SZ + 0.004);
    for (const s of [-1, 1]) {
      const tip = V(s * 0.074, y - 0.014, SZ + 0.014);
      fixed.add(between(V(s * 0.031, y, SZ), tip, 0.0045, mats.steel));
      fixed.add(bolt(tip, V(s, -0.3, 0.2), 0.0075, mats.brass));
    }
  }

  // ───────── 01 brain
  const brain = addUnit('brain', { w: 0.3, h: 0.225, depth: 0.27, pos: [0, 2.3, 0.375], rot: [0.13, 0, 0] });
  add(box(0.07, 0.07, 0.016, mats.alu), 0, 2.34, 0.071);

  // ───────── 02 eyes, on goosenecks, free to turn
  const eyes = [-1, 1].map((s) => {
    const u = addUnit('eye', {
      w: 0.1, h: 0.075, depth: 0.115, pos: [s * 0.118, 2.03, 0.3], cage: false, crtZ: 0.11, mirror: s, lines: 110, lamp: 0.8, lit: false,
    });
    // the tube sits in a glossy ivory shell: an eyeball with a raster for an iris
    const shroud = new THREE.Mesh(new THREE.SphereGeometry(0.074, 36, 18, 0, Math.PI * 2, 1.047, 1.75), mats.eyeball);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.z = 0.043;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 12), mats.steel);
    ball.position.z = -0.012;
    u.group.add(shroud, ball);
    const neck = bezier(V(s * 0.022, 2.17, 0.068), V(s * 0.5, -0.1, 1), V(s * 0.118, 2.03, 0.282), V(0, 0.25, -1), 0, 0.5);
    fixed.add(corrugated(neck, 0.0075, mats.steel, { pitch: 0.006, depth: 0.13, radial: 8 }));
    fixed.add(plug(neck, 0, 0.012, 0.03, mats.black));
    return u;
  });

  // the pair shares one lamp, parked between them
  eyes[0].light = new THREE.PointLight(byId.eye.color, 0, 1.5, 0.6);
  eyes[0].light.position.set(0, 2.03, 0.34);
  root.add(eyes[0].light);

  // ───────── larynx junction + trachea
  add(box(0.1, 0.06, 0.05, mats.alu), 0, 1.8, 0.095);
  const lx = tagPlate(['OB · LARYNX', 'air / signal / lie', 'do not kink'], 0.085, 0.033);
  add(lx, 0, 1.8, 0.1205);
  led(0xffa020, 0.04, 1.84, 0.1, (t) => (Math.sin(t * 5.1) > 0.2 ? 3 : 0.1));
  const trachea = bezier(at(brain, 'neck'), V(0, -1, 0.3), V(0, 1.832, 0.1), V(0, 1, 0.5), 0, 0.4);
  fixed.add(corrugated(trachea, 0.014, mats.conduit));
  fixed.add(plug(trachea, 1, 0.02, 0.03, mats.steel));

  // ───────── sternum chassis, HV posts, connectors
  add(perfBox(0.2, 0.3, 0.11, mats), 0, 1.52, 0.125);
  led(0x30ff60, -0.05, 1.61, 0.15, (t) => (Math.sin(t * 23) * Math.sin(t * 3.1) > 0 ? 4 : 0.2));
  led(0xff2a10, 0.06, 1.43, 0.15, (t) => 1 + 3 * heartbeat(t));
  const posts = { top: [], bottom: [] };
  for (const [key, y0, s] of [['top', 1.67, 1], ['bottom', 1.37, -1]]) {
    for (let i = 0; i < 4; i++) {
      const x = -0.075 + i * 0.05;
      add(cyl(0.008, 0.034, mats.ceramic, 14), x, y0 + s * 0.017, 0.145);
      add(cyl(0.012, 0.003, mats.ceramic, 14), x, y0 + s * 0.012, 0.145);
      add(cyl(0.012, 0.003, mats.ceramic, 14), x, y0 + s * 0.024, 0.145);
      add(cyl(0.004, 0.012, mats.brass, 8), x, y0 + s * 0.04, 0.145);
      posts[key].push(V(x, y0 + s * 0.044, 0.145));
    }
  }
  const sockets = {};
  for (const s of [-1, 1]) for (const [i, y] of [1.6, 1.52, 1.44].entries()) {
    const c = cyl(0.009, 0.016, mats.steel, 12);
    c.rotation.z = Math.PI / 2;
    add(c, s * 0.108, y, 0.1);
    sockets[`${s}${i}`] = V(s * 0.116, y, 0.1);
  }
  const sticker = hazardSticker(0.045);
  sticker.rotation.y = Math.PI / 2;
  add(sticker, 0.1015, 1.4, 0.14);

  // ───────── 03 lungs, each on a hinge so the chest can open
  const lungs = [-1, 1].map((s) => {
    const u = addUnit('lungs', {
      w: 0.21, h: 0.28, depth: 0.25, pos: [s * 0.43, 1.52, 0.34], rot: [0, s * 0.18, 0],
      mirror: s, slideOffset: s > 0 ? 2 : 0, anodeSide: -s,
    });
    const pl = u.crt.userData.plate;
    u.pivot = local(u, -s * (pl.w / 2 - 0.004), 0, pl.z - 0.004);
    const h = u.pivot;
    fixed.add(between(V(h.x, h.y - 0.17, h.z), V(h.x, h.y + 0.17, h.z), 0.006, mats.steel));
    for (const dy of [-0.13, 0.13]) {
      add(box(0.03, 0.036, h.z + 0.012, mats.alu), h.x, h.y + dy, (h.z + 0.012) / 2);
      fixed.add(bolt(V(h.x, h.y + dy, h.z + 0.012), AZ, 0.006, mats.steel));
    }
    // bronchus: larynx to the top hinge block
    const br = bezier(V(s * 0.052, 1.8, 0.095), V(s, 0.65, 0), V(h.x, h.y + 0.15, h.z * 0.6), V(0, 1, 0.1), 0, 0.6);
    fixed.add(corrugated(br, 0.011, mats.conduit));
    fixed.add(plug(br, 0, 0.016, 0.024, mats.steel));
    fixed.add(plug(br, 1, 0.016, 0.024, mats.steel));
    cable(at(u, 'neck'), dir(u, 'neckDir'), sockets[`${s}0`], V(s, 0, 0), { sag: 0.07 });
    cable(at(u, 'anode'), dir(u, 'anodeDir'), posts.top[s < 0 ? 0 : 3], V(s * 0.5, 1, 0.2), { r: 0.0032, mat: mats.red, sag: -0.02, k: 0.5, plugMat: mats.cap });
    return u;
  });

  // ───────── 04 heart, a round tube bolted to the front of the sternum
  const heart = addUnit('heart', {
    w: 0.16, h: 0.16, depth: 0.19, round: true, pos: [0.03, 1.55, 0.372], cage: { gap: 0, plate: 'alu', pad: 0.02 }, lines: 130,
  });
  cable(at(heart, 'anode'), dir(heart, 'anodeDir'), posts.top[1], V(-0.2, 1, 0.6), { r: 0.0032, mat: mats.red, sag: -0.03, k: 0.6, plugMat: mats.cap });
  cable(at(brain, 'anode'), dir(brain, 'anodeDir'), posts.top[2], V(0.3, 1, 0.3), { r: 0.0032, mat: mats.red, sag: 0, k: 0.45, plugMat: mats.cap });

  // ───────── ribs
  for (const y of [1.67, 1.59, 1.51, 1.43]) for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([
      V(s * 0.02, y, 0.03), V(s * 0.3, y - 0.02, 0.02), V(s * 0.57, y - 0.055, 0.035),
      V(s * 0.66, y - 0.09, 0.14), V(s * 0.668, y - 0.12, 0.27), V(s * 0.625, y - 0.14, 0.36),
    ]);
    fixed.add(tube(c, 0.0045, mats.steel, { seg: 48, radial: 6 }));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), mats.brass);
    tip.position.copy(c.getPoint(1));
    fixed.add(tip);
  }

  // ───────── 05 stomach, hung askew from a ball joint
  const stomach = addUnit('stomach', { w: 0.22, h: 0.165, depth: 0.2, pos: [-0.255, 1.16, 0.31], rot: [0.04, -0.14, 0.2] });
  {
    const p = stomach.pivot;
    fixed.add(between(V(p.x, p.y, 0), V(p.x, p.y, p.z - 0.014), 0.011, mats.steel, 14));
    const fl = cyl(0.04, 0.006, mats.steel, 24);
    fl.rotation.x = Math.PI / 2;
    add(fl, p.x, p.y, 0.003);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.021, 18, 12), mats.steel);
    add(ball, p.x, p.y, p.z - 0.02);
    cable(at(stomach, 'neck'), dir(stomach, 'neckDir'), sockets['-12'], V(-1, -0.2, 0), { sag: 0.05 });
    cable(at(stomach, 'anode'), dir(stomach, 'anodeDir'), posts.bottom[0], V(-0.2, -1, 0.3), { r: 0.0032, mat: mats.red, sag: 0.02, k: 0.5, plugMat: mats.cap });
  }

  // ───────── transformer and capacitor bank opposite the stomach
  {
    const g = new THREE.Group();
    g.position.set(0.27, 1.165, 0);
    const base = roundedPlate(0.21, 0.17, 0.012, 0.005, mats.alu);
    base.position.z = 0.03;
    g.add(base);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const so = cyl(0.006, 0.026, mats.steel, 8);
      so.rotation.x = Math.PI / 2;
      so.position.set(sx * 0.09, sy * 0.07, 0.013);
      g.add(so, bolt(V(sx * 0.09, sy * 0.07, 0.03), AZ, 0.006, mats.steel));
    }
    const core = box(0.12, 0.1, 0.058, mats.zinc);
    core.position.set(-0.03, 0, 0.059);
    const winding = cyl(0.046, 0.064, mats.copper, 32);
    winding.position.copy(core.position);
    g.add(core, winding);
    for (const y of [-0.05, 0, 0.05]) {
      const can = cyl(0.015, 0.055, mats.blue, 16);
      can.rotation.x = Math.PI / 2;
      can.position.set(0.067, y, 0.0575);
      const top = cyl(0.0152, 0.004, mats.alu, 16);
      top.rotation.x = Math.PI / 2;
      top.position.set(0.067, y, 0.086);
      g.add(can, top);
    }
    fixed.add(g);
    cable(V(0.24, 1.215, 0.075), V(-0.3, 1, 0.5), sockets['12'], V(1, 0, 0), { r: 0.004, sag: 0.02 });
  }

  // ───────── 06 kidneys on swivel arms
  const kidneys = [-1, 1].map((s, i) => {
    const u = addUnit('kidney', {
      w: 0.11, h: 0.0825, depth: 0.12, pos: [s * 0.36, 0.93, 0.26], rot: [0, s * 0.3, 0], mirror: s, slideOffset: s > 0 ? 2 : 0,
      cage: { gap: 0.02, pad: 0.018 }, lines: 110, lamp: 0.55, anodeSide: -s, lit: !mobile,
    });
    const p = u.pivot;
    const knuckle = V(p.x, p.y, p.z - 0.016);
    fixed.add(between(V(s * 0.02, 0.93, 0.078), knuckle, 0.0075, mats.alu, 12));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 10), mats.steel);
    ball.position.copy(knuckle);
    fixed.add(ball);
    add(box(0.07, 0.04, 0.05, mats.black), 0, 0.93, SZ + 0.006);
    cable(at(u, 'anode'), dir(u, 'anodeDir'), posts.bottom[i ? 3 : 1], V(s * 0.3, -1, 0.3), { r: 0.0032, mat: mats.red, sag: 0.03, k: 0.5, plugMat: mats.cap });
    if (i) {
      cable(at(u, 'neck'), dir(u, 'neckDir'), V(0.05, 1.366, 0.1), V(0.2, -1, 0), { r: 0.004, sag: 0.06 });
    } else {
      const base = bezier(at(u, 'neck'), dir(u, 'neckDir'), V(-0.05, 1.366, 0.1), V(-0.2, -1, 0), 0.07);
      fixed.add(coil(base, { R: 0.0075, r: 0.0022, pitch: 0.0062, lead: 0.06 }, mats.rubber));
      fixed.add(plug(base, 0, 0.007, 0.03, mats.steel), plug(base, 1, 0.007, 0.03, mats.steel));
    }
    return u;
  });

  // ───────── 07 gut
  const gut = addUnit('gut', { w: 0.32, h: 0.22, depth: 0.27, pos: [0, 0.7, 0.375], rot: [-0.12, 0, 0] });
  cable(at(gut, 'anode'), dir(gut, 'anodeDir'), posts.bottom[2], V(0.5, -1, 0.4), { r: 0.0032, mat: mats.red, sag: 0, k: 0.45, plugMat: mats.cap });

  // ───────── power supply on the wall, strip on the floor, outlet
  const psu = new THREE.Group();
  psu.position.set(0.66, 0.62, 0);
  {
    const back = box(0.25, 0.37, 0.006, mats.steel);
    back.position.z = 0.003;
    const hs = heatsink(0.2, 0.25, 0.085, 13, mats.black);
    hs.position.set(0, -0.035, 0.006);
    const ctl = box(0.2, 0.056, 0.075, mats.alu);
    ctl.position.set(0, 0.132, 0.0435);
    psu.add(back, hs, ctl);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) psu.add(bolt(V(sx * 0.11, sy * 0.17, 0.006), AZ, 0.007, mats.steel));
    const sw = cyl(0.0065, 0.012, mats.steel, 10);
    sw.rotation.x = Math.PI / 2;
    sw.position.set(-0.06, 0.132, 0.087);
    const lever = between(V(-0.06, 0.132, 0.09), V(-0.06, 0.146, 0.112), 0.003, mats.steel, 8);
    psu.add(sw, lever);
    for (const x of [-0.015, 0.018]) {
      const f = cyl(0.008, 0.012, mats.black, 12);
      f.rotation.x = Math.PI / 2;
      f.position.set(x, 0.132, 0.087);
      psu.add(f);
    }
    const hz = hazardSticker(0.04);
    hz.position.set(0, -0.172, 0.0065);
    hz.scale.set(1, 0.5, 1);
    psu.add(hz);
    const tag = tagPlate(['OB · SUPPLY', '18 kV · 9 A', 'serial 0007'], 0.07, 0.027);
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(0, 0.1605, 0.045);
    psu.add(tag);
  }
  fixed.add(psu);
  led(0xff2010, 0.73, 0.752, 0.083, (t) => (Math.sin(t * 2.1) > -0.6 ? 4 : 0.3));
  const loom = bezier(V(0.556, 0.752, 0.045), V(-1, 0.1, 0.2), V(0.024, 0.54, 0.07), V(1, -0.5, 0.3), 0.1, 0.4);
  fixed.add(corrugated(loom, 0.013, mats.conduit));
  fixed.add(plug(loom, 0, 0.019, 0.03, mats.steel), plug(loom, 1, 0.019, 0.03, mats.steel));

  const strip = new THREE.Group();
  strip.position.set(0.8, 0, 0.36);
  strip.rotation.y = 0.3;
  {
    const body = box(0.36, 0.042, 0.062, mats.ivory);
    body.position.y = 0.021;
    strip.add(body);
    for (const x of [-0.09, -0.03, 0.03, 0.09]) {
      const so = box(0.042, 0.004, 0.042, mats.black);
      so.position.set(x, 0.043, 0);
      strip.add(so);
    }
    for (const x of [-0.09, 0.03]) {
      const pg = box(0.04, 0.034, 0.04, mats.rubber);
      pg.position.set(x, 0.06, 0);
      strip.add(pg);
    }
    const rocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.008, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x400804, emissive: 0xff2408, emissiveIntensity: 2.2, roughness: 0.4 }),
    );
    rocker.position.set(-0.152, 0.045, 0);
    rocker.userData.keep = true;
    strip.add(rocker);
  }
  fixed.add(strip);
  strip.updateMatrixWorld(true);
  const plugA = strip.localToWorld(V(-0.09, 0.078, 0));
  const plugB = strip.localToWorld(V(0.03, 0.078, 0));
  cable(V(0.7, 0.462, 0.05), V(0, -1, 0.15), plugB, V(0, 1, 0), { r: 0.006, sag: 0, k: 0.45, ends: false });
  add(box(0.085, 0.125, 0.008, mats.ivory), 1.3, 0.25, 0.004);
  add(box(0.05, 0.045, 0.04, mats.rubber), 1.3, 0.235, 0.028);
  cable(strip.localToWorld(V(0.18, 0.02, 0)), V(1, 0, 0.35), V(1.3, 0.215, 0.04), V(0, -1, 0.6), { r: 0.006, sag: 0, k: 0.4, ends: false });

  // the long coiled cord: out of the gut, onto the floor, into the strip
  {
    const start = local(gut, 0, -gut.crt.userData.plate.h / 2 + 0.012, gut.crt.userData.plate.z - 0.012);
    const base = new THREE.CatmullRomCurve3([
      start, V(-0.01, 0.4, 0.12), V(-0.08, 0.18, 0.22), V(-0.2, 0.045, 0.36), V(-0.4, 0.02, 0.5),
      V(-0.52, 0.02, 0.36), V(-0.36, 0.02, 0.25), V(-0.12, 0.02, 0.37), V(0.14, 0.02, 0.53),
      V(0.42, 0.02, 0.52), V(0.6, 0.035, 0.45), plugA,
    ], false, 'centripetal');
    fixed.add(coil(base, { R: 0.013, r: 0.0036, pitch: 0.0125, lead: 0.02 }, mats.rubber));
    fixed.add(plug(base, 0, 0.012, 0.04, mats.steel));
  }

  // ───────── paint and paper on the wall
  const marks = [
    ['brain', -0.5, 2.36], ['eye', 0.33, 2.06], ['lungs', -0.94, 1.68], ['heart', 0.78, 1.6],
    ['stomach', -0.66, 1.1], ['kidney', 0.5, 1.02], ['gut', -0.44, 0.62],
  ];
  for (const [id, x, y] of marks) {
    const o = byId[id];
    const st = stencil(o.no, o.latin, 0.2);
    st.position.set(x + 0.1, y, 0.0015);
    fixed.add(st);
  }
  const card = placard(0.26);
  add(box(0.264, 0.165, 0.004, mats.ivory), -1.18, 1.25, 0.002);
  add(card, -1.18, 1.25, 0.0045);

  // ───────── freeze everything that does not move
  for (const u of units) bake(u.group);
  bake(fixed);

  root.updateMatrixWorld(true);
  const focus = organs.map((organ) => {
    const us = units.filter((u) => u.organ === organ);
    const centers = us.map((u) => u.crt.userData.screen.getWorldPosition(V()));
    const center = centers.reduce((acc, c) => acc.add(c), V()).multiplyScalar(1 / us.length);
    const normal = us.reduce((acc, u) => acc.add(V(0, 0, 1).transformDirection(u.crt.matrixWorld)), V()).normalize();
    const span = Math.max(...centers.map((c) => c.x)) - Math.min(...centers.map((c) => c.x));
    return { organ, units: us, center, normal, w: span + us[0].w, h: us[0].h };
  });

  function swing(unit, axis, angle) {
    _q.setFromAxisAngle(axis, angle);
    unit.group.position.copy(unit.base.pos).sub(unit.pivot).applyQuaternion(_q).add(unit.pivot);
    unit.group.quaternion.copy(unit.base.quat).premultiply(_q);
  }

  // look: world point the eyes should watch
  function update(t, dt, { look, reducedMotion = false }) {
    const hb = heartbeat(t), br = breath(t);
    for (const u of units) {
      const un = u.material.uniforms;
      un.uTime.value = t;
      un.uBeat.value = hb;
      un.uBreath.value = br;
      un.uPower.value = u.power;
    }
    const m = reducedMotion ? 0.2 : 1;
    swing(brain, AX, 0.02 * Math.sin(t * 0.37) * m);
    lungs.forEach((u, i) => swing(u, AY, (i ? 1 : -1) * 0.05 * br * m));
    heart.crt.scale.setScalar(1 + 0.022 * hb * m);
    swing(stomach, AZ, (0.03 * Math.sin(t * 0.9) + 0.012 * Math.sin(t * 2.3)) * m);
    kidneys.forEach((u, i) => swing(u, AY, (i ? -1 : 1) * 0.055 * Math.sin(t * 0.5 + i * 1.3) * m));

    const k = 1 - Math.exp(-dt * 9);
    for (const u of eyes) {
      _v.copy(look).sub(u.base.pos).normalize();
      const yaw = THREE.MathUtils.clamp(Math.atan2(_v.x, _v.z), -0.62, 0.62);
      const pitch = THREE.MathUtils.clamp(Math.asin(_v.y), -0.4, 0.4);
      u.yaw += (yaw - u.yaw) * k;
      u.pitch += (pitch - u.pitch) * k;
      u.group.rotation.set(-u.pitch, u.yaw, 0, 'YXZ');
      u.material.uniforms.uGaze.value.set((u.yaw / 0.62) * u.mirror, u.pitch / 0.4);
    }
    for (const l of leds) l.m.material.emissiveIntensity = l.fn(t);
  }

  return { root, units, focus, update };
}
