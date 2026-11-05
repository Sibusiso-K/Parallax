// Films the real app in real Edge over the DevTools protocol. No packages.
//   node capture.mjs start                 launch headless Edge (blocks; run in the background)
//   node capture.mjs record                run the live flows once and save every API reply to rec/
//   node capture.mjs shoot <scene> [...]   film a scene, replaying saved replies, frames to raw/<scene>/
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'C:/Users/USER/Desktop/Parallax-film';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9444;
const APP = 'http://localhost:5199';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const [mode, ...args] = process.argv.slice(2);

if (mode === 'start') {
  const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${DIR}/edge-profile`, '--window-size=1600,900', '--no-first-run', '--no-default-browser-check', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'inherit', windowsHide: true });
  child.on('exit', (c) => process.exit(c ?? 0));
  await new Promise(() => {});
}

// ----- The DevTools connection -----
let ws, seq = 0;
const waiting = new Map(), handlers = new Map();
async function connect() {
  let tabs;
  for (let i = 0; i < 80; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch {}
    await delay(250);
  }
  const page = tabs.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { const { ok, no } = waiting.get(d.id); waiting.delete(d.id); d.error ? no(new Error(JSON.stringify(d.error))) : ok(d.result); }
    else if (d.method && handlers.has(d.method)) handlers.get(d.method)(d.params);
  };
}
const send = (method, params = {}) => new Promise((ok, no) => { const id = ++seq; waiting.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page: ${JSON.stringify(r.exceptionDetails).slice(0, 400)}`);
  return r.result.value;
}

// ----- What goes into every page before it loads -----
const BOOT = `
window.__marks = [];
window.__mark = (name) => window.__marks.push({ name, at: Date.now() });
window.__rec = [];
window.__replay = null;
(() => {
  const real = window.fetch.bind(window);
  const count = {};
  const label = (url, init) => {
    if (!/\\/api\\/(swarm|world|document|intake)/.test(url)) return null;
    const kind = url.match(/\\/api\\/(\\w+)/)[1];
    let action = kind;
    try { const body = JSON.parse(init?.body ?? '{}'); if (body.action) action = kind + ':' + body.action; } catch {}
    return action;
  };
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const action = label(url, init);
    if (!action) return real(input, init);
    const n = (count[action] = (count[action] ?? 0) + 1);
    const id = action + '#' + n;
    const replay = window.__replay?.[id];
    window.__mark('fetch:' + id);
    if (replay) {
      const speed = window.__speed ?? 1;
      if (action === 'swarm') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({ async start(c) {
          let last = 0;
          for (const chunk of replay.chunks) {
            await new Promise(r => setTimeout(r, (chunk.at - last) / speed));
            last = chunk.at;
            c.enqueue(encoder.encode(chunk.text));
          }
          c.close();
        } });
        return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
      }
      const wait = replay.chunks.at(-1)?.at ?? 0;
      await new Promise(r => setTimeout(r, wait / speed));
      return new Response(replay.chunks.map(c => c.text).join(''), { status: replay.status, headers: { 'content-type': 'application/json' } });
    }
    const t0 = performance.now();
    const res = await real(input, init);
    const copy = res.clone();
    const entry = { id, status: res.status, chunks: [] };
    window.__rec.push(entry);
    (async () => {
      const reader = copy.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        entry.chunks.push({ at: Math.round(performance.now() - t0), text: dec.decode(value, { stream: true }) });
      }
      entry.done = true;
    })();
    return res;
  };
  // The voice in the film is rendered from the same words. The page sees the timings a real voice reports.
  const plan = () => window.__speechPlan ?? {};
  const normal = (s) => s.replace(/\\s+/g, ' ').trim();
  const shim = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [], addEventListener() {}, removeEventListener() {},
    _timers: [],
    cancel() { this._timers.forEach(clearTimeout); this._timers = []; this.speaking = false; },
    pause() {}, resume() {},
    speak(u) {
      this.cancel();
      const line = plan()[normal(u.text)];
      window.__spoken = window.__spoken ?? [];
      window.__spoken.push(u.text);
      const total = line ? line.duration * 1000 : 0;
      const start = () => {
        this.speaking = true;
        window.__mark('speech:' + (line?.key ?? 'unplanned'));
        u.onstart?.({});
        if (line) {
          let cursor = 0;
          for (const w of line.words) {
            const at = u.text.indexOf(w.text, cursor);
            if (at >= 0) cursor = at + w.text.length;
            this._timers.push(setTimeout(() => u.onboundary?.({ name: 'word', charIndex: at >= 0 ? at : cursor }), w.at * 1000));
          }
        }
        this._timers.push(setTimeout(() => { this.speaking = false; u.onend?.({}); }, total || 400));
      };
      this._timers.push(setTimeout(start, 40));
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: shim, configurable: true });
  // A soft cursor, so people can follow the founder's hand.
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = 'film-cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:1.5px solid rgba(20,24,40,.65);box-shadow:0 3px 14px rgba(0,0,0,.35);z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:scale .12s,opacity .2s;';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { c.style.scale = '.72'; }, true);
    addEventListener('mouseup', () => { c.style.scale = '1'; }, true);
  });
})();
`;

// ----- Hands -----
let mouse = { x: 800, y: 500 };
const ease = (t) => t * t * (3 - 2 * t);
async function moveTo(x, y, ms = 700) {
  const from = { ...mouse };
  const steps = Math.max(4, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    mouse = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x, y: mouse.y });
    await delay(ms / steps);
  }
}
async function rectOf(selector, text) {
  const expr = `(() => { const list=[...document.querySelectorAll(${JSON.stringify(selector)})]; const el=${text ? `list.find(e=>e.innerText&&e.innerText.toLowerCase().includes(${JSON.stringify(text)}.toLowerCase()))` : 'list[0]'}; if(!el) return null; el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`;
  return js(expr);
}
async function click(selector, text, moveMs = 650) {
  let r = null;
  for (let i = 0; i < 60 && !r; i++) { r = await rectOf(selector, text); if (!r) await delay(250); }
  if (!r) throw new Error(`no element ${selector} ${text ?? ''}`);
  await moveTo(r.x, r.y, moveMs);
  await delay(120);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await delay(70);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await delay(120);
}
async function hover(selector, text, ms = 700) { const r = await rectOf(selector, text); if (r) await moveTo(r.x, r.y, ms); }
async function typeText(text, cps = 60) {
  const chunk = 3;
  for (let i = 0; i < text.length; i += chunk) {
    await send('Input.insertText', { text: text.slice(i, i + chunk) });
    await delay(1000 * chunk / cps);
  }
}
const waitFor = async (expr, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(`!!(${expr})`)) return true; await delay(200); } throw new Error(`timed out: ${expr}`); };
const setValue = (selector, value) => js(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);

// ----- Filming -----
async function film(name, run) {
  const out = `${DIR}/raw/${name}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const frames = [];
  handlers.set('Page.screencastFrame', (p) => {
    const file = `${String(frames.length).padStart(6, '0')}.jpg`;
    writeFileSync(`${out}/${file}`, Buffer.from(p.data, 'base64'));
    frames.push({ file, t: p.metadata.timestamp });
    send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
  });
  await send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const began = Date.now() / 1000;
  const marks = [];
  const mark = (m) => marks.push({ name: m, t: Date.now() / 1000 - began });
  await run(mark);
  await delay(400);
  await send('Page.stopScreencast');
  handlers.delete('Page.screencastFrame');
  const pageMarks = await js('JSON.stringify(window.__marks ?? [])').then(JSON.parse).catch(() => []);
  for (const m of pageMarks) marks.push({ name: m.name, t: m.at / 1000 - began });
  marks.sort((a, b) => a.t - b.t);
  const first = frames[0]?.t ?? began;
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? (f.t + 0.05)) - f.t).toFixed(4)}`).join('\n');
  writeFileSync(`${out}/list.txt`, list + `\nfile '${frames.at(-1).file}'\n`);
  const offset = first - began;
  writeFileSync(`${DIR}/raw/${name}.json`, JSON.stringify({ frames: frames.length, seconds: frames.at(-1).t - first, offset, marks: marks.map((m) => ({ ...m, t: +(m.t - offset).toFixed(3) })) }, null, 1));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${out}/list.txt`, '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', `${DIR}/raw/${name}.mp4`]);
  rmSync(out, { recursive: true, force: true });
  console.log(name, 'frames', frames.length, 'seconds', (frames.at(-1).t - first).toFixed(1), 'fps', (frames.length / (frames.at(-1).t - first)).toFixed(1));
  for (const m of marks) console.log('  ', (m.t - offset).toFixed(2), m.name);
}
async function open(path, { replay = true, speed = 1 } = {}) {
  await send('Page.navigate', { url: `${APP}${path}` });
  await waitFor('document.readyState === "complete"');
  if (replay) {
    const rec = existsSync(`${DIR}/rec/replies.json`) ? JSON.parse(readFileSync(`${DIR}/rec/replies.json`, 'utf8')) : {};
    await js(`window.__replay = ${JSON.stringify(rec)}; window.__speed = ${speed}; 0`);
  }
  await js(`window.__speechPlan = ${JSON.stringify(speechPlan())}; 0`);
}
function speechPlan() {
  const plan = {};
  for (const key of ['s3', 's4', 's4b', 's7', 's8']) {
    const p = `${DIR}/audio/${key}.json`;
    if (!existsSync(p)) continue;
    const line = JSON.parse(readFileSync(p, 'utf8'));
    plan[line.text.replace(/\s+/g, ' ').trim()] = { key, duration: line.duration, words: line.words };
  }
  return plan;
}
async function saveRec(file) {
  await waitFor('window.__rec.every(e => e.done)', 60000);
  const rec = JSON.parse(await js('JSON.stringify(window.__rec)'));
  mkdirSync(`${DIR}/rec`, { recursive: true });
  const path = `${DIR}/rec/${file}`;
  const all = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  for (const e of rec) all[e.id] = e;
  writeFileSync(path, JSON.stringify(all));
  console.log('saved', file, rec.map((e) => `${e.id}:${e.chunks.length}`).join(' '));
}

// ----- The scenes -----
const SALON = "I'm Nomsa, a Black woman in my thirties, and I run a two-chair hair salon in Soweto. A hotel group wants me to do bridal parties every weekend and pay after 60 days. I would need to hire a junior stylist and buy a second basin. I am scared of running out of cash before they pay.";
const scenes = {
  // Everything below runs through the same buttons a founder presses.
  async room(mark) {
    await open('/?world');
    await waitFor('document.querySelector(".photo-plate")?.complete');
    await delay(1500);
    mark('golden');
    for (const [label, ms] of [['The contract', 900], ['Cost of each meal', 800], ['Equipment', 800], ['Your decision', 900]]) {
      const r = await js(`(() => { const nav=[...document.querySelectorAll('.photo-object-nav button')].find(b=>b.innerText.includes(${JSON.stringify(label)})); return nav ? nav.innerText : null; })()`);
      if (!r) continue;
    }
    // Hover the real objects in the photograph, so SAM's masks light up under the cursor.
    for (const [x, y, name] of [[345, 690, 'hover-contract'], [640, 650, 'hover-pots'], [125, 300, 'hover-fridge'], [255, 500, 'hover-desk'], [1120, 300, 'hover-board']]) {
      await moveTo(x, y, 900); mark(name); await delay(700);
    }
    await click('.photo-dialogue button', 'Meet my future self');
    mark('she-speaks');
    await waitFor('window.speechSynthesis.speaking', 4000);
    await waitFor('!window.speechSynthesis.speaking', 15000);
    mark('she-stops');
    await delay(1200);
  },
  async lever(mark) {
    await open('/?world', { speed: 2 });
    await waitFor('document.querySelector(".photo-plate")?.complete');
    await moveTo(360, 720, 300);
    await delay(1600);
    mark('before-lever');
    await click('.switch');
    mark('lever');
    await delay(3200);
    await moveTo(330, 700, 900);
    mark('paper');
    await delay(1800);
    await click('.mc-launch');
    mark('board-open');
    await delay(1300);
    await click('.mc-question button[type=submit]');
    mark('review-start');
    await waitFor('document.querySelector(".mc-node[aria-label^=\\"Conductor: Specialists\\"]")', 15000);
    mark('dispatched');
    await delay(900);
    await click('.mc-node[aria-label^="Cash Forensics"]');
    mark('inspect-cash');
    await waitFor('document.querySelector(".mc-node[aria-label^=\\"Cash Forensics: Review\\"]")', 40000);
    await delay(1400);
    await waitFor('document.querySelector(".mc-brief")', 60000);
    mark('brief');
    await waitFor('window.speechSynthesis.speaking', 5000).catch(() => {});
    mark('she-speaks');
    await delay(2600);
    await js(`document.querySelector('.mc').scrollTo({top:0,behavior:'smooth'}); 0`);
    mark('graph-again');
    await waitFor('document.querySelector(".mc-node[aria-label^=\\"Art Director: Passed\\"]")', 60000).catch(() => {});
    mark('art-passed');
    await click('.mc-node[aria-label^="Art Director"]', undefined, 500).catch(() => {});
    await delay(1800);
    await waitFor('document.querySelector(".mc-sources blockquote")', 45000).catch(() => {});
    mark('sources');
    await js(`document.querySelector('.mc-sources')?.scrollIntoView({block:'center',behavior:'smooth'}); 0`);
    await delay(2800);
    await waitFor('!window.speechSynthesis.speaking', 25000).catch(() => {});
    mark('she-stops');
    await waitFor('document.querySelector(".photo-repaint")', 60000).catch(() => {});
    mark('repainted');
    await delay(1500);
    await click('.mc-close');
    mark('board-closed');
    await delay(3400);
    await moveTo(1250, 300, 1200);
    await delay(800);
    mark('look');
    await click('.mc-launch');
    await delay(1000);
    await js(`(() => { const b=document.querySelector('.mc-brief'); document.querySelector('.mc').scrollTo({top:b.offsetTop-12}); })()`);
    await delay(500);
    await click('.mc-proposal button');
    mark('apply');
    await delay(3200);
    mark('daylight');
    await waitFor('document.querySelector(".mc-brief")', 70000).catch(() => {});
    mark('brief2');
    await delay(2500);
    await waitFor('document.querySelector(".photo-repaint")', 60000).catch(() => {});
    mark('repainted2');
    await delay(2600);
    await click('.mc-close');
    mark('closed2');
    await delay(3000);
  },
  async pathc(mark) {
    await open('/?world');
    await waitFor('document.querySelector(".photo-plate")?.complete');
    await delay(800);
    await click('.pathchip--C');
    await delay(800);
    await click('.switch');
    mark('c-lever');
    await delay(3500);
    mark('c-end');
  },
  async intake(mark) {
    await open('/');
    await waitFor('document.querySelector(".agree input")');
    await delay(1200);
    await click('.agree input');
    await delay(300);
    await click('button', 'Tell my own story');
    mark('tell');
    await waitFor('document.querySelector("textarea")');
    await delay(600);
    await click('textarea');
    await typeText("I run a meal-prep and catering business in Johannesburg with three staff. We sell about R90,000 a month, anywhere from R75k to R105k. Ingredients and packaging cost R36,000 a month. Rent, power, fuel and software come to R16,000, and I pay myself R12,000. We repay R3,500 a month on the delivery van, and there is R120,000 in the business account. A corporate client has offered us a 12-month contract for staff lunches worth R60,000 a month, but they pay 60 days after each invoice. I would need another cook at R8,500 a month and a second fridge for R25,000. Should I take the contract? I'm careful with risk. What matters most is cash safety and growth.", 200);
    mark('typed');
    await delay(500);
    await click('button', 'Continue');
    mark('reading');
    await waitFor('[...document.querySelectorAll("h1")].some(h => /quick questions|Is this right/.test(h.innerText))', 60000);
    mark('heard');
    for (let i = 0; i < 8; i++) {
      if (!await js('[...document.querySelectorAll("h1")].some(h => /quick questions/.test(h.innerText))')) break;
      await delay(600);
      const q = await js('document.querySelector("main")?.innerText ?? document.body.innerText');
      if (/wage|staff|pay yourself|salary/i.test(q.split('NEXT')[0].slice(-220))) {
        await click('input:not([type=checkbox])');
        await typeText('21000', 14);
        await delay(200);
        await click('button', 'NEXT');
      } else {
        await click('button', "I don't know");
      }
      await delay(700);
    }
    await waitFor('[...document.querySelectorAll("h1")].some(h => /Is this right/.test(h.innerText))', 8000);
    mark('quotes');
    await delay(1200);
    await hover('button', 'R60 000', 800);
    await delay(1600);
    await hover('button', '60 days', 700);
    await delay(1800);
    await click('button', 'SHOW MY FUTURES');
    mark('futures');
    await delay(2600);
    await js(`scrollTo({top:220,behavior:'smooth'}); 0`);
    await delay(1400);
    await click('label', 'A big client pays').catch(() => {});
    mark('what-if');
    await delay(2600);
    await click('button', 'STEP INSIDE →').catch(async () => { await js(`[...document.querySelectorAll('button')].filter(b=>/STEP INSIDE/.test(b.innerText)).at(-1).click(); 0`); });
    mark('inside');
    await delay(4500);
  },
  async salon(mark) {
    await open('/?world', { replay: false });
    await waitFor('document.querySelector(".photo-plate")?.complete');
    await delay(800);
    await click('.studio-dock button', 'Build my world');
    mark('studio');
    await waitFor('document.querySelector(".px-studio textarea")');
    await click('.px-studio textarea');
    await js(`(() => { const t=document.querySelector('.px-studio textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,''); t.dispatchEvent(new Event('input',{bubbles:true})); t.focus(); })()`);
    await typeText(SALON, 90);
    mark('typed');
    await delay(400);
    await click('.px-actions button', 'Build my world');
    mark('build');
    await waitFor('document.querySelector(".px-world-preview")', 400000);
    mark('built');
    await delay(1500);
    await click('.studio-sheet__close');
    mark('world');
    await delay(3200);
    await click('.photo-dialogue button');
    mark('she-speaks');
    await delay(6000);
    mark('end');
  },
  async contract(mark) {
    await open('/?world');
    await waitFor('document.querySelector(".photo-plate")?.complete');
    await delay(800);
    await click('.studio-dock button', 'Read my contract');
    mark('studio');
    await delay(900);
    await click('button', 'Try a sample contract');
    mark('sample');
    await delay(1400);
    await click('.px-consent input');
    await delay(500);
    await click('.px-actions button', 'Read document');
    mark('reading');
    await waitFor('document.querySelector(".px-clause-nav button")', 70000);
    mark('read');
    await delay(1200);
    const has = await js(`[...document.querySelectorAll('.px-clause-nav button')].find(b=>/payment/i.test(b.innerText))?.innerText ?? ''`);
    if (has) await click('.px-clause-nav button', has);
    await delay(1200);
    await click('button', 'Highlight exact region').catch(() => {});
    mark('highlight');
    await delay(5000);
    await click('.px-clauses .px-consent input').catch(() => {});
    await delay(500);
    await click('.px-actions button', 'Use in assumption review').catch(() => {});
    mark('consequence');
    await delay(800);
    await js(`[...document.querySelectorAll('.studio-sheet *')].filter(e=>/Lowest cash moves|pays after/.test(e.textContent||'')).at(-1)?.scrollIntoView({block:'center',behavior:'smooth'}); 0`);
    await delay(3500);
    mark('end');
  },
  async filmstudio(mark) {
    await open('/?world');
    await waitFor('document.querySelector(".photo-plate")?.complete');
    await delay(800);
    await click('.studio-dock button', 'Your future, the film');
    mark('studio');
    await waitFor('document.querySelector(".px-film-preview")', 20000);
    await delay(1600);
    await click('.px-actions button', 'Play preview');
    mark('play');
    await delay(9000);
    mark('end');
  },
};

await connect();
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1.2, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: BOOT });

if (mode === 'record') {
  // One real, live pass with the key: no replay, no filming. Every reply is saved so the takes can be repeated.
  await open('/?world', { replay: false });
  await waitFor('document.querySelector(".photo-plate")?.complete');
  await delay(1000);
  await js(`document.querySelector('.switch').click(); 0`);
  await delay(600);
  await js(`document.querySelector('.mc-launch').click(); 0`);
  await delay(600);
  await js(`document.querySelector('.mc-question button[type=submit]').click(); 0`);
  console.log('run 1 started');
  await waitFor('document.querySelector(".mc-brief")', 90000);
  await waitFor('document.querySelector(".photo-repaint")', 150000).catch(() => console.log('no repaint in run 1'));
  await waitFor('[...document.querySelectorAll(".mc-node")].every(n => !/Searching|Opening/.test(n.getAttribute("aria-label")))', 60000).catch(() => {});
  await delay(2000);
  const report1 = await js(`JSON.stringify({ speech: document.querySelector('.mc-speech p')?.innerText, nodes:[...document.querySelectorAll('.mc-node')].map(n=>n.getAttribute('aria-label')), sources:[...document.querySelectorAll('.mc-sources blockquote')].map(b=>b.innerText), proposals:[...document.querySelectorAll('.mc-proposal')].map(p=>p.innerText.slice(0,200)), spoken: window.__spoken ?? [] })`);
  console.log(report1);
  writeFileSync(`${DIR}/rec/run1.json`, report1);
  await saveRec('replies.json');
  await js(`document.querySelector('.mc-proposal button').click(); 0`);
  console.log('applied; run 2 started');
  await delay(2000);
  await waitFor('document.querySelector(".mc-brief")', 90000);
  await waitFor('document.querySelector(".photo-repaint")', 150000).catch(() => console.log('no repaint in run 2'));
  await waitFor('[...document.querySelectorAll(".mc-node")].every(n => !/Searching|Opening/.test(n.getAttribute("aria-label")))', 60000).catch(() => {});
  await delay(2000);
  const report2 = await js(`JSON.stringify({ speech: document.querySelector('.mc-speech p')?.innerText, nodes:[...document.querySelectorAll('.mc-node')].map(n=>n.getAttribute('aria-label')), sources:[...document.querySelectorAll('.mc-sources blockquote')].map(b=>b.innerText), breakLine: document.querySelector('.mc-break')?.innerText, spoken: window.__spoken ?? [] })`);
  console.log(report2);
  writeFileSync(`${DIR}/rec/run2.json`, report2);
  await saveRec('replies.json');
  process.exit(0);
}
if (mode === 'shoot') {
  for (const name of args) await film(name, scenes[name]);
  process.exit(0);
}
