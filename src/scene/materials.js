import * as THREE from 'three';

export function canvasTex(w, h, draw, { data = false, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// staggered round holes, used as an alpha map for the perforated chassis panels
function perfTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#000';
    const r = 17;
    for (const [x, y] of [[32, 32], [96, 32], [0, 96], [64, 96], [128, 96]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }, { data: true, repeat: true });
}

// fine enamelled-wire windings for the deflection yokes and the transformer
function windingTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = 120 + 90 * Math.sin((x / w) * Math.PI * 2 * 32) + (Math.random() - 0.5) * 30;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, 0, 1, h);
    }
  }, { data: true, repeat: true });
}

export function makeMaterials(tex) {
  const grunge = tex.grunge;
  const windings = windingTexture();
  windings.repeat.set(3, 1);
  const perf = perfTexture();

  const std = (o) => new THREE.MeshStandardMaterial(o);

  const m = {
    alu: std({ color: 0x92969c, metalness: 1, roughness: 0.95, roughnessMap: grunge }),
    steel: std({ color: 0xa7abb0, metalness: 1, roughness: 0.7, roughnessMap: grunge }),
    band: std({ color: 0x70757b, metalness: 1, roughness: 0.9, roughnessMap: grunge }),
    zinc: std({ color: 0x6f757b, metalness: 0.9, roughness: 1, roughnessMap: grunge }),
    perf: std({
      color: 0x767c82, metalness: 0.9, roughness: 1, roughnessMap: grunge,
      alphaMap: perf, alphaTest: 0.5, side: THREE.DoubleSide,
    }),
    black: std({ color: 0x0b0c0e, metalness: 0.75, roughness: 1, roughnessMap: grunge }),
    rubber: std({ color: 0x090909, metalness: 0, roughness: 0.5 }),
    conduit: std({ color: 0x15171a, metalness: 0.2, roughness: 0.42 }),
    red: std({ color: 0xb5140c, metalness: 0, roughness: 0.4 }),
    cap: std({ color: 0x5e1a13, metalness: 0, roughness: 0.6 }),
    graphite: std({ color: 0x18191b, metalness: 0.25, roughness: 0.62 }),
    gloss: std({ color: 0x040506, metalness: 0, roughness: 0.07 }),
    copper: std({ color: 0xc06a2c, metalness: 1, roughness: 0.55, bumpMap: windings, bumpScale: 0.6 }),
    brass: std({ color: 0xb8924a, metalness: 1, roughness: 0.35 }),
    ivory: std({ color: 0xb4ae9f, metalness: 0, roughness: 0.55 }),
    ceramic: std({ color: 0x9c988e, metalness: 0, roughness: 0.25 }),
    blue: std({ color: 0x1b3e86, metalness: 0.3, roughness: 0.35 }),
    pcb: std({ map: tex.pcb, metalness: 0.1, roughness: 0.65 }),
    acrylic: new THREE.MeshPhysicalMaterial({
      color: 0x56645f, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16,
      envMapIntensity: 1.1, side: THREE.DoubleSide, depthWrite: false,
    }),
    acrylicEdge: std({ color: 0x9fd8c6, metalness: 0, roughness: 0.25, transparent: true, opacity: 0.6, emissive: 0x2c5a4c, emissiveIntensity: 0.5 }),
    eyeball: std({ color: 0x9d968a, metalness: 0, roughness: 0.3, side: THREE.DoubleSide }),
    // additive clear coat laid over each phosphor: only its reflections show
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x000000, metalness: 0, roughness: 0.11, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, envMapIntensity: 2.2, ior: 1.52, specularIntensity: 0.3,
      roughnessMap: grunge, // fingerprints and wipe marks in the reflections
    }),
  };
  m.acrylic.userData.noShadow = true;
  m.acrylicEdge.userData.noShadow = true;
  m.glass.userData.noShadow = true;
  m.perfTexture = perf;
  return m;
}
