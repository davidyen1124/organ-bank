import * as THREE from 'three';
import { V, box, cyl, orient, roundedPlate, bolt } from './hardware.js';

const TAU = Math.PI * 2;

// superellipse: n = 2 is a circle, higher n squares the corners
function squircle(th, a, b, n) {
  const c = Math.cos(th), s = Math.sin(th), e = 2 / n;
  return [a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(s) * Math.abs(s) ** e];
}

// skin stretched over a stack of superellipse rings, front (high z) to back
function loft(rings, seg = 80) {
  const n = rings.length, row = seg + 1;
  const pos = new Float32Array(n * row * 3), uv = new Float32Array(n * row * 2);
  for (let i = 0; i < n; i++) {
    const r = rings[i];
    for (let j = 0; j <= seg; j++) {
      const [x, y] = squircle((j / seg) * TAU, r.a, r.b, r.n);
      const k = i * row + j;
      pos.set([x, y, r.z], k * 3);
      uv.set([j / seg, i / (n - 1)], k * 2);
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the normals across the seam
  const nr = g.attributes.normal, v = V();
  for (let i = 0; i < n; i++) {
    const a = i * row, b = a + seg;
    v.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, v.x, v.y, v.z);
    nr.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

// the bulged phosphor face, uv 0..1 across its bounding box
function faceGeometry(a, b, n, bulge, rings = 12, seg = 80) {
  const pos = [0, 0, 0], uv = [0.5, 0.5], idx = [], row = seg + 1;
  for (let i = 1; i <= rings; i++) {
    const r = i / rings;
    for (let j = 0; j <= seg; j++) {
      const [x, y] = squircle((j / seg) * TAU, a * r, b * r, n);
      pos.push(x, y, -bulge * r * r);
      uv.push(x / (2 * a) + 0.5, y / (2 * b) + 0.5);
    }
  }
  for (let j = 0; j < seg; j++) idx.push(0, 1 + j, 2 + j);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) {
    const p0 = 1 + i * row + j, p1 = p0 + row;
    idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A bare picture tube: face, tension band with mounting ears, graphite funnel,
// copper deflection yoke, neck, neck board and anode cap. Faces +Z, origin at
// the centre of the screen.
export function createCRT({ w, h, depth, round = false, anodeSide = 1, mats, screenMat }) {
  const a = w / 2, b = h / 2;
  const n = round ? 2 : 4.4;
  const S = Math.max(w, h);
  const bulge = S * 0.055;
  const t = S * 0.05;        // dark glass margin around the phosphor
  const e = S * 0.01;        // tension band thickness
  const g = new THREE.Group();

  const fg = faceGeometry(a, b, n, bulge);
  const screen = new THREE.Mesh(fg, screenMat);
  screen.userData.keep = true;
  const coat = new THREE.Mesh(fg, mats.glass);
  coat.position.z = 0.0012;
  coat.renderOrder = 2;
  coat.userData.keep = true;
  g.add(screen, coat);

  const z0 = -bulge;
  const zb = z0 - t * 0.9;
  g.add(new THREE.Mesh(loft([
    { a, b, n, z: z0 },
    { a: a + t * 0.55, b: b + t * 0.55, n, z: z0 - t * 0.2 },
    { a: a + t * 0.9, b: b + t * 0.9, n, z: z0 - t * 0.55 },
    { a: a + t, b: b + t, n, z: zb },
  ]), mats.gloss));

  const bd = S * 0.1;
  const A = a + t, B = b + t;
  g.add(new THREE.Mesh(loft([
    { a: A, b: B, n, z: zb },
    { a: A + e, b: B + e, n, z: zb }, { a: A + e, b: B + e, n, z: zb },
    { a: A + e, b: B + e, n, z: zb - bd }, { a: A + e, b: B + e, n, z: zb - bd },
    { a: A, b: B, n, z: zb - bd },
  ]), mats.band));

  // funnel: shoulder, cone, then a smooth blend into the neck
  const rn = S * 0.07 + 0.004;
  const zf = zb - bd * 0.5;
  const zn = -depth * 0.66;
  const fun = (u) => {
    const f = Math.cos((u * Math.PI) / 2) ** 1.4;
    return { a: rn + (A - rn) * f, b: rn + (B - rn) * f, n: 2 + (n - 2) * (1 - u) ** 1.6, z: zf + (zn - zf) * u };
  };
  const rings = [];
  for (let i = 0; i <= 20; i++) rings.push(fun(i / 20));
  g.add(new THREE.Mesh(loft(rings), mats.graphite));

  // neck and base
  const neck = cyl(rn, depth + zn, mats.gloss, 20);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = (zn - depth) / 2;
  g.add(neck);
  const base = cyl(rn * 1.12, S * 0.05, mats.black, 20);
  base.rotation.x = Math.PI / 2;
  base.position.z = -depth + S * 0.01;
  g.add(base);

  // deflection yoke hugging the back of the funnel
  const pts = [new THREE.Vector2(rn * 1.3, 0), new THREE.Vector2(rn * 1.7, S * 0.03)];
  for (let i = 0; i <= 8; i++) {
    const r = fun(1 - (i / 8) * 0.3);
    pts.push(new THREE.Vector2(Math.max(r.a, r.b) + S * 0.022, S * 0.03 + (r.z - zn) + S * 0.015));
  }
  const yoke = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mats.copper);
  yoke.rotation.x = Math.PI / 2;
  yoke.position.z = zn - S * 0.045;
  g.add(yoke);
  const last = pts[pts.length - 1];
  const collar = new THREE.Mesh(new THREE.TorusGeometry(last.x, S * 0.014, 8, 40), mats.ivory);
  collar.position.z = yoke.position.z + last.y;
  g.add(collar);
  const clamp = cyl(rn * 1.75, S * 0.045, mats.ivory, 24);
  clamp.rotation.x = Math.PI / 2;
  clamp.position.z = zn - S * 0.06;
  g.add(clamp);

  // neck board
  const board = box(S * 0.24, S * 0.2, 0.003, mats.pcb);
  board.position.z = -depth - S * 0.02;
  g.add(board);
  for (const [x, y, r, l, m] of [[0.07, 0.05, 0.03, 0.08, mats.blue], [-0.07, -0.04, 0.022, 0.06, mats.black], [-0.05, 0.06, 0.018, 0.04, mats.brass]]) {
    const c = cyl(S * r, S * l, m, 12);
    c.rotation.x = Math.PI / 2;
    c.position.set(S * x, S * y, board.position.z - (S * l) / 2);
    g.add(c);
  }

  // anode cap on the upper flank of the funnel
  const ca = fun(0.34);
  const th = anodeSide > 0 ? (round ? 0.9 : 1.05) : Math.PI - 1.05;
  const [cx, cy] = squircle(th, ca.a, ca.b, ca.n);
  const anodeDir = V(Math.cos(th), Math.sin(th), -0.55).normalize();
  const anode = V(cx, cy, ca.z);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(S * 0.075, 20, 12), mats.cap);
  cap.scale.set(1, 0.34, 1);
  cap.position.copy(anode);
  orient(cap, anodeDir);
  g.add(cap);

  // mounting ears on the band corners
  const ears = [];
  const ez = zb - bd * 0.5;
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const [ex, ey] = squircle(ang, A + e, B + e, n);
    const dir = V(Math.cos(ang), Math.sin(ang), 0);
    const p = V(ex, ey, ez).addScaledVector(dir, S * 0.035);
    const ear = box(S * 0.11, S * 0.075, 0.003, mats.band);
    ear.position.copy(V(ex, ey, ez).addScaledVector(dir, S * 0.02));
    ear.rotation.z = ang;
    g.add(ear);
    ears.push(p);
  }

  g.userData = {
    S, a, b, depth, rn,
    ears,
    anode: anode.clone().addScaledVector(anodeDir, S * 0.02),
    anodeDir,
    neck: V(0, -S * 0.07, -depth - S * 0.03),
    neckDir: V(0, -0.5, -1).normalize(),
    screen,
  };
  return g;
}

// Four threaded rods from the ears back to a plate behind the neck.
export function addCage(crt, mats, { gap = 0.035, plate = 'acrylic', pad = 0.03 } = {}) {
  const { ears, depth, S } = crt.userData;
  const zp = -(depth + gap);
  const rodR = Math.max(0.0028, S * 0.011);
  let mx = 0, my = 0;
  for (const p of ears) {
    mx = Math.max(mx, Math.abs(p.x));
    my = Math.max(my, Math.abs(p.y));
    const len = p.z + 0.012 - zp + 0.012;
    const rod = cyl(rodR, len, mats.steel, 8);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(p.x, p.y, zp - 0.012 + len / 2);
    crt.add(rod);
    crt.add(bolt(V(p.x, p.y, p.z + 0.0015), V(0, 0, 1), rodR * 2.1, mats.brass));
    crt.add(bolt(V(p.x, p.y, p.z - 0.0015), V(0, 0, -1), rodR * 2.1, mats.brass));
    crt.add(bolt(V(p.x, p.y, zp), V(0, 0, 1), rodR * 2.1, mats.brass));
    crt.add(bolt(V(p.x, p.y, zp - 0.006), V(0, 0, -1), rodR * 2.1, mats.brass));
  }
  const pw = (mx + pad) * 2, ph = (my + pad) * 2;
  const pl = roundedPlate(pw, ph, Math.min(pw, ph) * 0.12, 0.006, plate === 'acrylic' ? mats.acrylic : mats.alu);
  pl.position.z = zp;
  crt.add(pl);
  if (plate === 'acrylic') {
    // cut acrylic catches light along its edge
    const edge = roundedPlate(pw, ph, Math.min(pw, ph) * 0.12, 0.0064, mats.acrylicEdge, 0.0028);
    edge.position.z = zp + 0.0002;
    crt.add(edge);
  }
  crt.userData.plate = { w: pw, h: ph, z: zp };
  return crt;
}
