// Screenshot QA with the locally installed Chrome.
//   node scripts/qa.mjs                 -> default desktop + mobile set
//   node scripts/qa.mjs desktop:heart   -> one shot (<device>:<focus|overview>[:t])
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const base = process.env.URL || 'http://127.0.0.1:5179';
const outDir = process.env.OUT || 'logs/shots';
const DEVICES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  wide: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  og: { width: 1200, height: 630, deviceScaleFactor: 1 },
  laptop: { width: 1280, height: 720, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  small: { width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true },
  landscape: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const DEFAULT = ['desktop:overview', 'mobile:overview', 'desktop:heart', 'mobile:heart'];

const jobs = (process.argv.length > 2 ? process.argv.slice(2) : DEFAULT).map((s) => {
  const [device, focus = 'overview', t = '21.3', yaw = '', pitch = ''] = s.split(':');
  return { device, focus, t, yaw, pitch };
});

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio'],
});

let failed = false;
for (const { device, focus, t, yaw, pitch } of jobs) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  await page.setViewport(DEVICES[device]);
  const q = new URLSearchParams({ t });
  if (focus !== 'overview') q.set('focus', focus);
  if (yaw) q.set('yaw', yaw);
  if (pitch) q.set('pitch', pitch);
  await page.goto(`${base}/?${q}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__ob?.ready, { timeout: 30000 });
  } catch {
    errors.push('timeout waiting for app');
  }
  if (device === 'og') await page.addStyleTag({ content: '#ui{display:none}' });
  await new Promise((r) => setTimeout(r, 1800));
  const file = `${outDir}/${device}-${focus}${yaw ? `-y${yaw}` : ''}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
  const overflow = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('#ui *, dialog[open] *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('#index') && matchMedia('(max-width: 720px), (max-aspect-ratio: 5/6)').matches) continue; // scroller
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(`${el.tagName}.${el.className || el.id} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    }
    return out;
  });
  console.log(`${file}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}${overflow.length ? `\n  off-screen: ${overflow.join(' | ')}` : ''}`);
  if (errors.some((e) => !e.startsWith('warn'))) failed = true;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
