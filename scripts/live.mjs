// Live (clock running) captures: warm-up, eye tracking, mid-loop frames.
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
const base = process.env.URL || 'http://127.0.0.1:5179';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir('logs/shots', { recursive: true }); // git-ignored, so it is missing on a fresh clone
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ob?.ready, { timeout: 30000 });
const shot = (n) => page.screenshot({ path: `logs/shots/live-${n}.jpg`, type: 'jpeg', quality: 84 });
await sleep(900); await shot('boot1');
await sleep(900); await shot('boot2');
await sleep(4500);
await page.evaluate(() => window.__ob.focus('eye'));
await page.mouse.move(1380, 60);
await sleep(2500); await shot('eye-upright');
await page.mouse.move(520, 860);
await sleep(1500); await shot('eye-downleft');
await browser.close();
