import * as THREE from 'three';
import { canvasTex } from './materials.js';

const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

// knock random specks out of whatever is on the canvas so paint looks rolled on
function wear(g, w, h, amount) {
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < amount; i++) {
    g.globalAlpha = Math.random() * 0.8;
    const s = Math.random() * 3 + 0.5;
    g.fillRect(Math.random() * w, Math.random() * h, s * (1 + Math.random() * 3), s);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

function decal(tex, w, h, extra = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, ...extra }),
  );
  m.receiveShadow = true;
  m.userData.keep = true;
  return m;
}

// stencilled inventory number painted on the concrete next to each organ
export function stencil(no, label, width = 0.2) {
  const tex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#d9d3c4';
    g.font = `700 190px ${DISPLAY}`;
    g.textBaseline = 'alphabetic';
    g.fillText(no, 8, 170);
    g.font = `500 34px ${MONO}`;
    g.fillText(label.toUpperCase(), 12, 222);
    // stencil bridges
    g.globalCompositeOperation = 'destination-out';
    for (const x of [58, 150]) g.fillRect(x, 20, 7, 160);
    g.globalCompositeOperation = 'source-over';
    wear(g, w, h, 2600);
  });
  const m = decal(tex, width, width / 2, { opacity: 0.8 });
  return m;
}

export function hazardSticker(size = 0.05) {
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f0c419';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111';
    g.lineWidth = 12;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(128, 40); g.lineTo(222, 204); g.lineTo(34, 204); g.closePath();
    g.stroke();
    g.fillStyle = '#111';
    g.beginPath();
    g.moveTo(140, 82); g.lineTo(104, 142); g.lineTo(128, 142); g.lineTo(112, 190);
    g.lineTo(156, 126); g.lineTo(132, 126); g.closePath();
    g.fill();
    wear(g, w, h, 300);
  });
  return decal(tex, size, size, { roughness: 0.5 });
}

// engraved-looking tag plate
export function tagPlate(lines, w = 0.09, h = 0.035) {
  const tex = canvasTex(512, 200, (g, cw, ch) => {
    g.fillStyle = '#16171a';
    g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#c9c4b4';
    g.lineWidth = 4;
    g.strokeRect(10, 10, cw - 20, ch - 20);
    g.fillStyle = '#d8d3c3';
    g.font = `600 58px ${DISPLAY}`;
    g.fillText(lines[0], 28, 84);
    g.font = `400 30px ${MONO}`;
    g.fillText(lines[1] ?? '', 28, 138);
    g.fillText(lines[2] ?? '', 28, 174);
  });
  return decal(tex, w, h, { roughness: 0.4, metalness: 0.6, transparent: false, depthWrite: true });
}

// gallery wall card
export function placard(w = 0.26) {
  const h = w * 0.62;
  const tex = canvasTex(1024, 635, (g, cw, ch) => {
    g.fillStyle = '#c9c4b6';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#17181a';
    g.font = `700 92px ${DISPLAY}`;
    g.fillText('ORGAN BANK', 70, 150);
    g.font = `400 36px ${MONO}`;
    const rows = [
      'closed-circuit anatomy, 2026',
      '',
      'aluminium, acrylic, steel, rubber,',
      'copper, ten cathode-ray tubes,',
      'seven four-frame loops',
      '',
      'dimensions variable · 72 bpm',
    ];
    rows.forEach((r, i) => g.fillText(r, 72, 232 + i * 52));
  });
  const card = decal(tex, w, h, { transparent: false, depthWrite: true, roughness: 0.75 });
  return card;
}
