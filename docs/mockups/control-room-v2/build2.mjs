// Builds Mockup 5 v2 (the founder version): one HTML file with four 1920x1080 pages, PNG previews and a PDF.
// Figures come from engine.json, written by the engine probe (engine-probe.test.ts.txt, run on feat/founder-pivot).
// Setup: npm install (puppeteer-core only; it does not download Chrome). Chrome is found at CHROME_PATH or the default path.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AVATAR_IMAGES } from './lib2.mjs';
import { page1 } from './p1.mjs';
import { page2 } from './p2.mjs';
import { page3 } from './p3.mjs';
import { page4 } from './p4.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const d = JSON.parse(readFileSync(path.join(here, 'engine.json'), 'utf8'));
// The founder's portraits, generated with Muse Image for this mockup (generate-avatars.mjs), embedded at 480 px.
for (const l of ['A', 'B', 'C']) {
  AVATAR_IMAGES[l] = `data:image/png;base64,${readFileSync(path.join(here, `avatar-${l}-480.png`)).toString('base64')}`;
}
// Charts draw from month 0 (today) to month 36, so every series starts with the starting cash.
for (const p of d.paths) {
  p.cash = {
    bad: [p.startingCash, ...p.rows.bad.map((r) => r.cash)],
    likely: [p.startingCash, ...p.rows.likely.map((r) => r.cash)],
    good: [p.startingCash, ...p.rows.good.map((r) => r.cash)],
  };
  p.lateCash = {
    likely: [p.startingCash, ...p.lateLikely],
    bad: [p.startingCash, ...p.lateBad],
  };
}

const css = [path.join(here, 'style.css'), path.join(here, 'style2.css'), path.join(here, 'style3.css')]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1920">
<title>Parallax mockup 5 v2 \u00b7 Control Room</title><style>${css}</style></head>
<body>${page1(d)}${page2(d)}${page3(d)}${page4(d)}</body></html>`;
const htmlPath = path.join(here, 'mockup5v2.html');
writeFileSync(htmlPath, html);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  // Pages clip at their edge, so report any region whose content is taller or wider than its box.
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.page')].map((pg, i) => {
      const bad = [...pg.querySelectorAll('.content, .panel, .ffield, .memo, .chatmain, .rcol')]
        .filter((el) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)
        .map((el) => `${el.className} ${el.scrollHeight}>${el.clientHeight}`);
      return { page: i + 1, bad };
    }),
  );
  console.log(JSON.stringify(clipped));
  const pages = await page.$$('.page');
  for (const [i, el] of pages.entries()) {
    const out = path.join(here, `page${i + 1}.png`);
    await el.screenshot({ path: out });
    console.log('saved', out);
  }
  const pdf = path.join(here, 'Parallax-mockup-5-v2-Control-Room.pdf');
  await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  console.log('saved', pdf);
} finally {
  await browser.close();
}
