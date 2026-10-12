// Turns the raw Codex-generated frames in assets-src/ into web-ready
// slide atlases (2x2, greyscale) and scene textures in public/assets/.
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (...p) => path.join(root, 'assets-src', ...p);
const out = (...p) => path.join(root, 'public', 'assets', ...p);

const ORGANS = ['brain', 'eye', 'lungs', 'heart', 'stomach', 'kidney', 'gut'];
const CELL = 768;

const exists = (f) => access(f).then(() => true, () => false);

async function slide(file, { crush = true } = {}) {
  let img = sharp(file).resize(CELL, CELL, { fit: 'cover' }).greyscale();
  // pull the "black" video background all the way down so tubes go dark between frames
  if (crush) img = img.linear(1.12, -14);
  return img.png().toBuffer();
}

async function atlas(organ) {
  const cells = [];
  for (let i = 1; i <= 4; i++) {
    const f = src(organ, `${i}.png`);
    if (!(await exists(f))) throw new Error(`missing ${f}`);
    cells.push(await slide(f, { crush: organ !== 'eye' }));
  }
  await sharp({ create: { width: CELL * 2, height: CELL * 2, channels: 3, background: '#000' } })
    .composite(cells.map((input, i) => ({ input, left: (i % 2) * CELL, top: Math.floor(i / 2) * CELL })))
    .webp({ quality: 82 })
    .toFile(out('slides', `${organ}.webp`));
  console.log('atlas', organ);
}

async function texture(name, size, opts = {}) {
  const f = src('tex', `${name}.png`);
  if (!(await exists(f))) { console.warn('skip texture', name); return; }
  let img = sharp(f).resize(size, size, { fit: 'cover' });
  if (opts.grey) img = img.greyscale();
  if (opts.modulate) img = img.modulate(opts.modulate);
  await img.webp({ quality: opts.quality ?? 80 }).toFile(out('tex', `${name}.webp`));
  console.log('texture', name);
}

await mkdir(out('slides'), { recursive: true });
await mkdir(out('tex'), { recursive: true });
for (const o of ORGANS) await atlas(o);
await texture('concrete', 2048, { quality: 78 });
await texture('floor', 2048, { quality: 78 });
await texture('pcb', 1024);
await texture('grunge', 1024, { grey: true });
