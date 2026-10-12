import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const _m = new THREE.Matrix4();

// Collapse every static mesh under `group` into one mesh per material.
// Meshes flagged `keep` (screens, hit boxes, blinking LEDs) are left alone,
// and so is anything an earlier bake already produced.
export function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const done = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keep || o.userData.baked) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
    done.push(o);
  });
  for (const o of done) o.removeFromParent();
  for (const [mat, list] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
    mesh.userData.baked = true;
    mesh.castShadow = !mat.userData.noShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// cylinder along +Y
export const cyl = (r, len, mat, seg = 16, r2 = r) => new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);

export function orient(obj, dir) {
  obj.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
  return obj;
}

// rod from p1 to p2
export function between(p1, p2, r, mat, seg = 10) {
  const d = p2.clone().sub(p1);
  const m = cyl(r, d.length(), mat, seg);
  m.position.copy(p1).addScaledVector(d, 0.5);
  return orient(m, d);
}

export function bolt(pos, dir, r, mat) {
  const m = cyl(r, r * 0.9, mat, 6);
  m.position.copy(pos).addScaledVector(dir.clone().normalize(), r * 0.45);
  return orient(m, dir);
}

// 40-series T-slot extrusion standing along Y
export function rail(len, mat, size = 0.04) {
  const s = size / 2, k = size * 0.11, d = size * 0.22;
  const sh = new THREE.Shape();
  sh.moveTo(-s, -s);
  sh.lineTo(-k, -s); sh.lineTo(-k, -s + d); sh.lineTo(k, -s + d); sh.lineTo(k, -s); sh.lineTo(s, -s);
  sh.lineTo(s, -k); sh.lineTo(s - d, -k); sh.lineTo(s - d, k); sh.lineTo(s, k); sh.lineTo(s, s);
  sh.lineTo(k, s); sh.lineTo(k, s - d); sh.lineTo(-k, s - d); sh.lineTo(-k, s); sh.lineTo(-s, s);
  sh.lineTo(-s, k); sh.lineTo(-s + d, k); sh.lineTo(-s + d, -k); sh.lineTo(-s, -k);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

function roundedPath(path, w, h, r) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// flat plate with rounded corners, lying in XY, thickness along -Z from z=0.
// `inset` > 0 leaves only a frame of that width (used for the lit edge of acrylic).
export function roundedPlate(w, h, r, thick, mat, inset = 0) {
  const sh = roundedPath(new THREE.Shape(), w, h, r);
  if (inset) sh.holes.push(roundedPath(new THREE.Path(), w - inset * 2, h - inset * 2, Math.max(0.001, r - inset)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -thick);
  return new THREE.Mesh(g, mat);
}

// black finned heat sink, fins toward +Z
export function heatsink(w, h, d, fins, mat) {
  const g = new THREE.Group();
  const base = box(w, h, d * 0.3, mat);
  base.position.z = d * 0.15;
  g.add(base);
  for (let i = 0; i < fins; i++) {
    const f = box(w * 0.028, h, d * 0.72, mat);
    f.position.set(-w / 2 + (w * (i + 0.5)) / fins, 0, d * 0.64);
    g.add(f);
  }
  return g;
}

// perforated steel enclosure with something half-visible inside
export function perfBox(w, h, d, mats) {
  const g = new THREE.Group();
  const pitch = 0.02;
  const panel = (pw, ph) => {
    const geo = new THREE.PlaneGeometry(pw, ph);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (pw / pitch), uv.getY(i) * (ph / pitch));
    return new THREE.Mesh(geo, mats.perf);
  };
  const front = panel(w, h); front.position.z = d / 2; g.add(front);
  for (const s of [-1, 1]) {
    const side = panel(d, h); side.position.x = (s * w) / 2; side.rotation.y = (s * Math.PI) / 2; g.add(side);
    const cap = panel(w, d); cap.position.y = (s * h) / 2; cap.rotation.x = (-s * Math.PI) / 2; g.add(cap);
  }
  // folded edges
  const e = 0.007;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = box(e, h + e, e, mats.zinc);
    post.position.set((sx * w) / 2, 0, (sz * d) / 2);
    g.add(post);
  }
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const bar = box(w + e, e, e, mats.zinc);
    bar.position.set(0, (sy * h) / 2, (sz * d) / 2);
    g.add(bar);
  }
  const back = box(w, h, 0.004, mats.zinc); back.position.z = -d / 2; g.add(back);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.9), mats.pcb);
  board.position.z = -d / 2 + 0.02;
  g.add(board);
  return g;
}

// cable with a tangent handle at each end and a little gravity
export function bezier(p1, d1, p2, d2, sag = 0, k = 0.36) {
  const dist = p1.distanceTo(p2);
  const c1 = p1.clone().addScaledVector(d1.clone().normalize(), dist * k);
  const c2 = p2.clone().addScaledVector(d2.clone().normalize(), dist * k);
  c1.y -= sag;
  c2.y -= sag;
  return new THREE.CubicBezierCurve3(p1.clone(), c1, c2, p2.clone());
}

export function tube(curve, r, mat, { seg, radial = 8 } = {}) {
  const n = seg ?? Math.max(16, Math.round(curve.getLength() * 70));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, n, r, radial, false), mat);
}

// strain relief / connector shell at one end of a curve (at = 0 or 1)
export function plug(curve, at, r, len, mat, seg = 12) {
  const p = curve.getPointAt(at);
  const tan = curve.getTangentAt(at);
  if (at === 0) tan.negate();
  const m = cyl(r, len, mat, seg);
  m.position.copy(p).addScaledVector(tan, -len * 0.35);
  return orient(m, tan);
}

// ribbed conduit: a tube whose rings alternate between two radii
export function corrugated(curve, r, mat, { pitch = 0.011, depth = 0.17, radial = 10 } = {}) {
  const seg = Math.max(8, Math.round(curve.getLength() / pitch) * 2);
  const g = new THREE.TubeGeometry(curve, seg, r, radial, false);
  const pos = g.attributes.position;
  const c = V();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c);
    const k = i % 2 === 0 ? 1 + depth : 1 - depth;
    for (let j = 0; j <= radial; j++) {
      const n = i * (radial + 1) + j;
      pos.setXYZ(n, c.x + (pos.getX(n) - c.x) * k, c.y + (pos.getY(n) - c.y) * k, c.z + (pos.getZ(n) - c.z) * k);
    }
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// telephone-style coiled cord wound around a base curve
class HelixCurve extends THREE.Curve {
  constructor(base, R, turns, lead) {
    super();
    this.base = base;
    this.R = R;
    this.turns = turns;
    this.lead = lead;
    this.N = 240;
    this.frames = base.computeFrenetFrames(this.N, false);
    this.arcLengthDivisions = Math.round(turns * 20);
    this._n = V();
    this._b = V();
  }

  getPoint(t, target = V()) {
    const f = t * this.N;
    const i = Math.min(Math.floor(f), this.N - 1);
    const k = f - i;
    const n = this._n.copy(this.frames.normals[i]).lerp(this.frames.normals[i + 1], k).normalize();
    const b = this._b.copy(this.frames.binormals[i]).lerp(this.frames.binormals[i + 1], k).normalize();
    const ramp = THREE.MathUtils.smoothstep(Math.min(t, 1 - t), 0, this.lead);
    const ang = t * this.turns * Math.PI * 2;
    this.base.getPointAt(t, target);
    return target.addScaledVector(n, Math.cos(ang) * this.R * ramp).addScaledVector(b, Math.sin(ang) * this.R * ramp);
  }
}

export function coil(base, { R = 0.012, r = 0.0032, pitch = 0.011, lead = 0.04, radial = 5 }, mat) {
  const turns = Math.round(base.getLength() / pitch);
  const helix = new HelixCurve(base, R, turns, lead);
  return new THREE.Mesh(new THREE.TubeGeometry(helix, turns * 14, r, radial, false), mat);
}
