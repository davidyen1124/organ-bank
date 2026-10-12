// Interaction + performance checks against a running build.
import puppeteer from 'puppeteer-core';

const base = process.env.URL || 'http://127.0.0.1:5179';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: !process.env.HEADFUL, // headless Chrome composites WebGL slowly; use HEADFUL=1 for a real frame-rate reading
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
};
const cardName = (page) => page.evaluate(() => (document.querySelector('#card').hidden ? null : document.querySelector('#c-latin').textContent));
const fps = (page, ms = 3000) => page.evaluate((ms) => new Promise((res) => {
  let n = 0;
  const t0 = performance.now();
  const tick = (t) => { n++; if (t - t0 < ms) requestAnimationFrame(tick); else res(Math.round((n * 1000) / (t - t0))); };
  requestAnimationFrame(tick);
}), ms);

async function open(viewport) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.setViewport(viewport);
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ob?.ready, { timeout: 30000 });
  return { page, errors };
}

// ── desktop
{
  const { page, errors } = await open({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await sleep(5200); // tubes warm up
  check('desktop: boot overlay gone', await page.evaluate(() => getComputedStyle(document.querySelector('#boot')).opacity === '0'));
  check('desktop: frame rate', (await fps(page)) >= 50, `${await fps(page, 1500)} fps`);

  await page.click('#index button:nth-child(4)');
  await sleep(400);
  check('desktop: index opens Cor', (await cardName(page)) === 'Cor');
  const f1 = await page.evaluate(() => document.querySelector('#c-frame').textContent);
  await sleep(3600);
  const f2 = await page.evaluate(() => document.querySelector('#c-frame').textContent);
  check('desktop: heart frame counter advances', f1 !== f2, `${f1} -> ${f2}`);

  await page.keyboard.press('ArrowRight');
  await sleep(300);
  check('desktop: arrow key steps to Gaster', (await cardName(page)) === 'Gaster');
  await page.click('#prev');
  check('desktop: prev button returns to Cor', (await cardName(page)) === 'Cor');
  await page.keyboard.press('Escape');
  await sleep(300);
  check('desktop: escape returns to whole body', (await cardName(page)) === null);

  await sleep(2600); // camera settles on the overview
  for (const [id, latin] of [['brain', 'Cerebrum'], ['gut', 'Intestinum'], ['stomach', 'Gaster'], ['kidney', 'Ren']]) {
    const p = await page.evaluate((id) => window.__ob.where(id), id);
    await page.mouse.click(p.x, p.y);
    await sleep(300);
    check(`desktop: clicking the ${id} tube opens ${latin}`, (await cardName(page)) === latin);
    await page.click('#back');
    await sleep(2400);
  }
  await page.evaluate(() => window.__ob.focus('heart'));
  await sleep(2400);
  await page.mouse.click(1380, 420); // bare wall
  await sleep(300);
  check('desktop: clicking bare wall leaves the close-up', (await cardName(page)) === null);

  // drag orbits without selecting anything
  const before = await page.evaluate(() => document.querySelector('#hint').classList.contains('off'));
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(700, 430, { steps: 8 });
  await page.mouse.up();
  await sleep(200);
  check('desktop: drag does not open a card', (await cardName(page)) === null, `hint was ${before ? 'off' : 'on'}`);

  await page.click('#info');
  check('desktop: about dialog opens', await page.evaluate(() => document.querySelector('#about').open));
  await page.keyboard.press('Escape');
  check('desktop: about dialog closes', await page.evaluate(() => !document.querySelector('#about').open));

  await page.click('#snd');
  check('desktop: sound toggles on', await page.evaluate(() => document.querySelector('#snd').getAttribute('aria-pressed') === 'true'));
  await sleep(1200);
  await page.click('#snd');
  check('desktop: sound toggles off', await page.evaluate(() => document.querySelector('#snd').textContent === 'Sound off'));
  check('desktop: no console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── phone
{
  const { page, errors } = await open({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await sleep(5200);
  check('mobile: frame rate', (await fps(page)) >= 45, `${await fps(page, 1500)} fps at dpr ${await page.evaluate(() => window.__ob.dpr)}`);
  check('mobile: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollHeight <= innerHeight));
  const p = await page.evaluate(() => window.__ob.where('lungs'));
  await page.touchscreen.tap(p.x, p.y);
  await sleep(400);
  check('mobile: tapping a lung opens Pulmo', (await cardName(page)) === 'Pulmo');
  const fits = await page.evaluate(() => {
    const r = document.querySelector('#card').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top > innerHeight * 0.3;
  });
  check('mobile: card fits the lower part of the screen', fits);
  await page.tap('#next');
  check('mobile: next goes to Cor', (await cardName(page)) === 'Cor');
  await page.tap('#back');
  await sleep(300);
  check('mobile: whole body restores the index', await page.evaluate(() => getComputedStyle(document.querySelector('#index')).visibility === 'visible'));
  const targets = await page.evaluate(() => [...document.querySelectorAll('#ui button')].filter((b) => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').map((b) => [b.textContent.trim().slice(0, 14), Math.round(b.getBoundingClientRect().height)]));
  const small = targets.filter(([, h]) => h < 36);
  check('mobile: touch targets are at least 36px tall', small.length === 0, small.map((t) => t.join(':')).join(', '));
  await page.tap('#index button:nth-child(7)');
  await sleep(300);
  check('mobile: index chip opens Intestinum', (await cardName(page)) === 'Intestinum');
  check('mobile: no console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
