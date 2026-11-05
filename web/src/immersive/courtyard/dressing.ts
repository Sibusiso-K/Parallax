import * as THREE from 'three';
import type { RoomReadout } from './readout';

// Dresses the Blender courtyard at load, with no new asset to download. The plain cylinders on the counter become
// stainless pots, and the contract, memo board, desk papers and tablet become things worth walking up to, drawn from the
// engine's figures. Positions come from environment.glb (assets/blender/build_courtyard.py). Runs once per loaded scene.

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "'Geist Variable', 'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";
const INK = '#23202b';
const MUTE = '#6a6572';
const RED = '#a3302a';
const LAV = '#5943bd';

export const WIND_TIME = { value: 0 };

interface Sheet {
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  w: number;
  h: number;
}

export interface Displays {
  contract: Sheet;
  memo: Sheet[];
  desk: Sheet;
  tablet: Sheet;
  contractPage: THREE.Object3D | null;
  lids: THREE.Object3D[];
}

function sheet(w: number, h: number): Sheet {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { ctx: canvas.getContext('2d')!, texture, w, h };
}

const lathe = (points: readonly (readonly [number, number])[], segments = 48) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name = ''): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  return m;
}

const hidden = new THREE.MeshBasicMaterial({ visible: false });

/** Keeps an original mesh as the pointer target and for the colliders, but stops drawing it. */
function retire(scene: THREE.Object3D, name: string): THREE.Object3D | null {
  const node = scene.getObjectByName(name);
  node?.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = hidden;
  });
  return node ?? null;
}

function stockPot(radius: number, height: number, steel: THREE.Material, dark: THREE.Material, inside: THREE.Material): { pot: THREE.Group; lid: THREE.Group } {
  const r = radius;
  const pot = new THREE.Group();
  pot.add(mesh(lathe([[0, 0], [r * 0.94, 0], [r, 0.014], [r, height - 0.006], [r + 0.005, height - 0.002], [r + 0.005, height], [r - 0.004, height]]), steel));
  pot.add(mesh(lathe([[r - 0.004, height], [r - 0.006, 0.016], [0, 0.012]]), inside));
  // A band where the wall meets the base, which catches the light as a real pot does.
  pot.add(mesh(lathe([[r + 0.0015, height * 0.2], [r + 0.0015, height * 0.205]]), dark));
  for (const side of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.026, 0.0055, 8, 18, Math.PI), steel);
    handle.position.set(side * (r + 0.004), height * 0.78, 0);
    handle.rotation.set(Math.PI / 2, side * Math.PI / 2, 0);
    pot.add(handle);
  }
  const lid = new THREE.Group();
  lid.position.y = height;
  const dome = r * 0.22;
  lid.add(mesh(lathe([[r + 0.002, 0.002], [r * 0.93, 0.008], [r * 0.72, dome * 0.62], [r * 0.4, dome * 0.92], [r * 0.14, dome], [0, dome]]), steel));
  const knob = mesh(lathe([[0.012, 0], [0.01, 0.012], [0.02, 0.018], [0.022, 0.026], [0.012, 0.032], [0, 0.033]], 20), dark);
  knob.position.y = dome;
  lid.add(knob);
  pot.add(lid);
  return { pot, lid };
}

function dressCounter(scene: THREE.Object3D, lids: THREE.Object3D[]) {
  const steel = new THREE.MeshStandardMaterial({ color: '#d2d5da', metalness: 1, roughness: 0.27 });
  const brushed = new THREE.MeshStandardMaterial({ color: '#8f9298', metalness: 0.95, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1b1a1d', metalness: 0.15, roughness: 0.55 });
  retire(scene, 'pan_station_pot0');
  retire(scene, 'pan_station_pot1');
  retire(scene, 'pan_handle');
  const potAt = (x: number, bottom: number, z: number, radius: number, height: number) => {
    const { pot, lid } = stockPot(radius, height, steel, dark, brushed);
    pot.position.set(x, bottom, z);
    scene.add(pot);
    lids.push(lid);
  };
  potAt(-3.8, 0.92, 5.55, 0.14, 0.2);
  potAt(-3.8, 0.92, 5.25, 0.11, 0.15);
  // The pan: open, and a child of the interactive node so it still takes the pointer and the highlight.
  const pan = retire(scene, 'pan');
  if (pan) {
    const r = 0.15;
    const skillet = new THREE.Group();
    skillet.position.set(-3.62, 0.92, 5.85);
    skillet.rotation.y = Math.PI / 2 + 0.25; // The handle hangs out over the counter's edge, clear of the clipboard.
    skillet.add(mesh(lathe([[0, 0], [r * 0.8, 0], [r, 0.05], [r - 0.005, 0.052], [r * 0.79, 0.008], [0, 0.008]]), new THREE.MeshStandardMaterial({ color: '#3a3a3e', metalness: 0.85, roughness: 0.42 })));
    const grip = mesh(new THREE.CapsuleGeometry(0.011, 0.2, 4, 10), dark);
    grip.rotation.x = Math.PI / 2 - 0.16;
    grip.position.set(0, 0.066, r + 0.1);
    skillet.add(grip);
    pan.add(skillet);
  }
}

function dressContract(scene: THREE.Object3D, contract: Sheet): THREE.Object3D | null {
  const node = retire(scene, 'contract');
  if (!node) return null;
  const board = new THREE.Group();
  board.rotation.y = 0.32;
  const wood = new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.62, metalness: 0.05 });
  const slab = mesh(new THREE.BoxGeometry(0.25, 0.012, 0.35), wood);
  board.add(slab);
  const clip = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.03), new THREE.MeshStandardMaterial({ color: '#b7babf', metalness: 1, roughness: 0.3 }));
  clip.position.set(0, 0.012, 0.158);
  const paper = new THREE.MeshStandardMaterial({ map: contract.texture, roughness: 0.92 });
  const under = mesh(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.95 }));
  under.rotation.set(-Math.PI / 2, 0, Math.PI);
  under.position.set(0, 0.0066, 0);
  board.add(under);
  // The top page turns on the clip: selecting the contract lifts it.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.0072, 0.1485);
  const page = mesh(new THREE.PlaneGeometry(0.21, 0.297), paper);
  page.rotation.set(-Math.PI / 2, 0, Math.PI);
  page.position.z = -0.1485;
  hinge.add(page);
  board.add(hinge);
  board.add(clip);
  node.add(board);
  return hinge;
}

function dressPapers(scene: THREE.Scene | THREE.Object3D, memo: Sheet[], desk: Sheet, tablet: Sheet) {
  // The board's sheets, left to right as seen from the courtyard. Each texture lies just off the paper already there.
  const spots: [number, number][] = [[1.399, -9.458], [1.779, -9.23], [1.399, -8.96], [1.779, -8.725], [1.399, -8.459]];
  spots.forEach(([y, z], i) => {
    const m = mesh(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ map: memo[i]!.texture, roughness: 0.95 }));
    m.position.set(5.8385, y, z);
    m.rotation.y = -Math.PI / 2;
    scene.add(m);
  });
  const lying = (s: Sheet, w: number, h: number, x: number, y: number, z: number, material: THREE.Material) => {
    const m = mesh(new THREE.PlaneGeometry(w, h), material);
    m.rotation.set(-Math.PI / 2, 0, Math.PI);
    m.position.set(x, y, z);
    scene.add(m);
    return s;
  };
  lying(desk, 0.21, 0.297, -4.295, 0.8108, -0.398, new THREE.MeshStandardMaterial({ map: desk.texture, roughness: 0.95 }));
  lying(tablet, 0.155, 0.235, -4.165, 0.7885, -0.875, new THREE.MeshBasicMaterial({ map: tablet.texture, toneMapped: false }));
}

/** Plants move a little in the air. Height sets how far, so stems stay rooted. Shares one compiled program across plants. */
function addWind(scene: THREE.Object3D) {
  const seen = new Set<THREE.Material>();
  scene.traverse((o) => {
    const material = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (!material || seen.has(material) || !/shrub|fern|grass|plant|ivy|leaf/i.test(material.name)) return;
    seen.add(material);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = WIND_TIME;
      shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 windAt = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 windAt = modelMatrix * vec4(position, 1.0);
        #endif
        float windLift = clamp(position.y, 0.0, 1.2);
        float windPhase = uWindTime * 1.25 + windAt.x * 0.9 + windAt.z * 0.7;
        transformed.x += (sin(windPhase) + 0.5 * sin(windPhase * 2.3)) * 0.016 * windLift;
        transformed.z += cos(windPhase * 0.8) * 0.011 * windLift;`,
      );
    };
    material.customProgramCacheKey = () => 'courtyard-wind';
    material.needsUpdate = true;
  });
}

/** Builds the dressed objects once for a loaded scene, and hands back what can change. */
export function dressEnvironment(scene: THREE.Object3D, reduced: boolean): Displays {
  const existing = scene.userData.displays as Displays | undefined;
  if (existing) return existing;
  const lids: THREE.Object3D[] = [];
  const contract = sheet(512, 724);
  const memo = Array.from({ length: 5 }, () => sheet(420, 594));
  const desk = sheet(420, 594);
  const tablet = sheet(310, 470);
  dressCounter(scene, lids);
  const contractPage = dressContract(scene, contract);
  dressPapers(scene, memo, desk, tablet);
  if (!reduced) addWind(scene);
  const displays: Displays = { contract, memo, desk, tablet, contractPage, lids };
  scene.userData.displays = displays;
  return displays;
}

function paper(s: Sheet, tint = '#f6f3ec') {
  const { ctx, w, h } = s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  // The faintest shading, so a sheet does not read as a flat colour under real-time light.
  const shade = ctx.createLinearGradient(0, 0, w, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(1, 'rgba(90,80,60,0.08)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
}

function fit(ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, size: number, maxWidth: number): number {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && px > 12) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function lines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  let line = '';
  let at = y;
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, at);
      at += lineHeight;
      line = word;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, at);
  return at + lineHeight;
}

function chart(ctx: CanvasRenderingContext2D, r: RoomReadout, x: number, y: number, w: number, h: number, ink = LAV, zero = 'rgba(35,32,43,0.3)') {
  const all = [...r.rows, ...r.baselineRows];
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const span = max - min || 1;
  const px = (i: number) => x + (i / (r.rows.length - 1)) * w;
  const py = (v: number) => y + h - ((v - min) / span) * h;
  ctx.strokeStyle = zero;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, py(0));
  ctx.lineTo(x + w, py(0));
  ctx.stroke();
  const draw = (rows: readonly number[], color: string, width: number, dash: number[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    rows.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (r.stressed) draw(r.baselineRows, '#8d8798', 3, [8, 7]);
  draw(r.rows, ink, 5, []);
  ctx.fillStyle = r.below ? RED : ink;
  ctx.beginPath();
  ctx.arc(px(r.month - 1), py(r.rows[r.month - 1]!), 8, 0, Math.PI * 2);
  ctx.fill();
}

function bars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: number, gap: number) {
  ctx.fillStyle = 'rgba(35,32,43,0.2)';
  for (let i = 0; i < rows; i++) {
    const shorter = i === rows - 1 ? 0.55 : 1 - ((i * 37) % 11) / 60;
    ctx.fillRect(x, y + i * gap, w * shorter, 5);
  }
}

function drawContract(s: Sheet, r: RoomReadout, label: string) {
  const { ctx, w } = s;
  paper(s);
  const left = 44;
  ctx.fillStyle = INK;
  fit(ctx, label, '400', SERIF, 58, w - 2 * left);
  ctx.fillText(label, left, 92);
  ctx.fillStyle = MUTE;
  ctx.font = `20px ${SANS}`;
  ctx.fillText(`Path ${r.pathLetter}: ${r.pathName}`, left, 128);
  ctx.fillStyle = 'rgba(35,32,43,0.25)';
  ctx.fillRect(left, 148, w - 2 * left, 2);
  bars(ctx, left, 176, w - 2 * left, 6, 24);
  ctx.fillStyle = INK;
  ctx.font = `600 22px ${SANS}`;
  ctx.fillText('First payment', left, 356);
  ctx.font = `400 46px ${SERIF}`;
  ctx.fillText(r.firstPayment ? `Month ${r.firstPayment}` : 'No contract on this path', left, 406);
  bars(ctx, left, 442, w - 2 * left, 5, 24);
  ctx.fillStyle = 'rgba(35,32,43,0.5)';
  ctx.fillRect(left, 640, 200, 2);
  ctx.fillStyle = MUTE;
  ctx.font = `17px ${SANS}`;
  ctx.fillText('Not signed. Your decision.', left, 664);
  if (r.stressed && r.firstPayment) {
    ctx.save();
    ctx.translate(w * 0.62, 310);
    ctx.rotate(-0.2);
    ctx.strokeStyle = RED;
    ctx.fillStyle = RED;
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 5;
    ctx.strokeRect(-138, -42, 276, 84);
    ctx.font = `700 34px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('PAYING LATE', 0, 12);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  s.texture.needsUpdate = true;
}

function drawMemo(memo: Sheet[], r: RoomReadout) {
  const [lowest, month, plan, line, shortfall] = memo as [Sheet, Sheet, Sheet, Sheet, Sheet];
  const left = 34;
  const heading = (s: Sheet, text: string) => {
    paper(s);
    s.ctx.fillStyle = MUTE;
    s.ctx.font = `600 22px ${SANS}`;
    s.ctx.fillText(text, left, 62);
  };
  const figure = (s: Sheet, text: string, y: number, negative: boolean) => {
    s.ctx.fillStyle = negative ? RED : INK;
    fit(s.ctx, text, '600', MONO, 68, s.w - 2 * left);
    s.ctx.fillText(text, left, y);
  };

  heading(month, `Cash at month ${r.month}`);
  figure(month, r.cash, 170, r.below);
  if (r.baselineCash) {
    month.ctx.fillStyle = MUTE;
    month.ctx.font = `26px ${SANS}`;
    month.ctx.fillText(`As planned: ${r.baselineCash}`, left, 226);
  }
  month.ctx.fillStyle = MUTE;
  month.ctx.font = `22px ${SERIF}`;
  lines(month.ctx, 'One possible future, not a prediction.', left, 520, month.w - 2 * left, 28);

  heading(lowest, 'The lowest it gets');
  figure(lowest, r.lowest, 170, r.lowest.startsWith('-'));
  lowest.ctx.fillStyle = MUTE;
  lowest.ctx.font = `26px ${SANS}`;
  lowest.ctx.fillText(`in month ${r.lowestMonth}`, left, 222);
  lowest.ctx.fillText(`Month 36: ${r.end}`, left, 300);

  heading(plan, `Path ${r.pathLetter}`);
  plan.ctx.fillStyle = INK;
  plan.ctx.font = `400 50px ${SERIF}`;
  const after = lines(plan.ctx, r.pathName, left, 136, plan.w - 2 * left, 56);
  plan.ctx.fillStyle = r.stressed ? RED : MUTE;
  plan.ctx.font = `600 24px ${SANS}`;
  plan.ctx.fillText(r.stressed ? 'With the late payment' : 'As planned', left, after + 16);
  bars(plan.ctx, left, after + 70, plan.w - 2 * left, 6, 24);

  heading(line, '36 months of cash');
  chart(line.ctx, r, left, 110, line.w - 2 * left, 330);
  line.ctx.fillStyle = MUTE;
  line.ctx.font = `20px ${SANS}`;
  line.ctx.fillText('Month 1', left, 484);
  line.ctx.fillText('Month 36', line.w - left - 86, 484);

  heading(shortfall, r.shortfall ? 'Cash first runs out' : 'Cash lasts');
  shortfall.ctx.fillStyle = r.shortfall ? RED : INK;
  shortfall.ctx.font = `400 62px ${SERIF}`;
  shortfall.ctx.fillText(r.shortfall ? `Month ${r.shortfall}` : '36 months', left, 150);
  shortfall.ctx.fillStyle = MUTE;
  shortfall.ctx.font = `22px ${SANS}`;
  lines(shortfall.ctx, r.shortfall ? 'Later months are still projected. Funding and closing are not modelled.' : 'No shortfall on this scenario.', left, 214, shortfall.w - 2 * left, 30);

  memo.forEach((s) => (s.texture.needsUpdate = true));
}

function drawDesk(s: Sheet, r: RoomReadout) {
  const { ctx, w } = s;
  paper(s);
  const left = 28;
  ctx.fillStyle = INK;
  ctx.font = `400 38px ${SERIF}`;
  ctx.fillText('What you confirmed', left, 62);
  let y = 112;
  for (const a of r.assumptions) {
    ctx.fillStyle = INK;
    fit(ctx, a.label, '400', SANS, 18, w - 2 * left);
    ctx.fillText(a.label, left, y);
    ctx.fillStyle = MUTE;
    ctx.font = `600 20px ${MONO}`;
    ctx.fillText(a.amount, left, y + 24);
    y += 52;
  }
  s.texture.needsUpdate = true;
}

function drawTablet(s: Sheet, r: RoomReadout) {
  const { ctx, w, h } = s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#17141f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c9c2e8';
  ctx.font = `600 18px ${SANS}`;
  ctx.fillText(`Path ${r.pathLetter} · month ${r.month}`, 22, 40);
  ctx.fillStyle = r.below ? '#ff8a80' : '#ffffff';
  fit(ctx, r.cash, '600', MONO, 46, w - 44);
  ctx.fillText(r.cash, 22, 96);
  chart(ctx, r, 24, 130, w - 48, h - 170, '#a99bf5', 'rgba(255,255,255,0.3)');
  s.texture.needsUpdate = true;
}

/** Redraws everything the objects show. Only called when a figure changes, so it costs nothing while standing still. */
export function drawDisplays(d: Displays, r: RoomReadout, contractLabel: string) {
  drawContract(d.contract, r, contractLabel);
  drawMemo(d.memo, r);
  drawDesk(d.desk, r);
  drawTablet(d.tablet, r);
}
