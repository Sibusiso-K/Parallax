import { afterEach, describe, expect, it, vi } from 'vitest';
import { photoManifestSchema, rectSchema } from './manifest';
import { worldPlanSchema } from './plan';
import { documentReadingSchema, proposalFor, readDocument } from './document';
import { readBody, providerPost } from './provider';
import { generateWorldImage } from '../providers/image';
import { parseSamText, segmentImage } from '../providers/sam';
import { encodeSegmentationMask } from './vendor/package/dist/mask-codec.js';
import { POST as worldPost } from '../../api/world';
import { POST as documentPost } from '../../api/document';
import { resetGuard } from '../http/guard';

const cfg = { apiKey: 'test-secret-do-not-return', baseUrl: 'https://model.test/v1', models: ['muse-spark-1.3'] };
const image = 'data:image/jpeg;base64,YWJj';
const rect = { x: .1, y: .1, width: .3, height: .3 };
const clause = { kind: 'payment_terms' as const, quote: 'Payment within 30 days of invoice.', page: 1, box: [10, 20, 500, 100] as [number, number, number, number] };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetGuard(); });

describe('world contract and figures boundary', () => {
  it('accepts the shared baked/generated shape and rejects unsafe URLs or geometry', () => {
    const manifest = { version: 1, id: 'demo', title: 'Kitchen', mode: 'baked', width: 1600, height: 800, plate: '/worlds/plate.jpg', night: image, people: { A: { src: image }, B: { src: image }, C: { src: image } }, objects: [{ id: 'contract', label: 'Offer', rect }], places: [], disclosure: 'Illustrative imagery. Fictional people. Synthetic images.' };
    expect(photoManifestSchema.safeParse(manifest).success).toBe(true);
    expect(photoManifestSchema.safeParse({ ...manifest, plate: 'https://untrusted.test/image' }).success).toBe(false);
    expect(photoManifestSchema.safeParse({ ...manifest, plate: '//untrusted.test/image' }).success).toBe(false);
    expect(rectSchema.safeParse({ ...rect, x: .9 }).success).toBe(false);
  });
  it('requires all five unique engine slots and disallows numeric art direction', () => {
    const plan = { title: 'Workshop', platePrompt: 'A light workshop with blank papers.', personPrompt: 'A fictional adult at work.', objects: ['contract','pan','fridge','intake_desk','memo'].map(id => ({ id, label: 'Object', concept: 'clipboard' })), rooms: [{ id: 'spawn', label: 'Workplace', rect }] };
    expect(worldPlanSchema.safeParse(plan).success).toBe(true);
    expect(worldPlanSchema.safeParse({ ...plan, platePrompt: 'R1000 on the clipboard' }).success).toBe(false);
    expect(worldPlanSchema.safeParse({ ...plan, objects: plan.objects.map(o => ({ ...o, id: 'contract' })) }).success).toBe(false);
  });
  it('reads bounded request streams even without content length', async () => {
    await expect(readBody(new Request('https://app.test', { method: 'POST', body: 'x'.repeat(100) }), 20)).rejects.toThrow('too large');
    expect(await readBody(new Request('https://app.test', { method: 'POST', body: '{"ok":true}' }))).toEqual({ ok: true });
  });
  it('never returns upstream content containing a key', async () => {
    const request = vi.fn(async () => new Response(cfg.apiKey, { status: 401 }));
    await expect(providerPost(cfg, '/responses', {}, request)).rejects.toThrow('could not complete'); expect(request).toHaveBeenCalledTimes(1);
  });
  it('image edits use one image output and reference-preserving JSON', async () => {
    const request = vi.fn(async () => Response.json({ data: [{ b64_json: 'YWJj' }] }));
    const result = await generateWorldImage(cfg, 'A quiet workshop.', [image], request);
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith('/images/edits')).toBe(true); expect(JSON.parse(String(init.body))).toMatchObject({ n: 1, images: [{ image_url: image }], output_format: 'jpeg' });
    expect(result.dataUrl).toBe(image);
  });
});

describe('SAM full-plate geometry', () => {
  const raster = new Uint8Array([1, 0, 0, 1]);
  const encoded = encodeSegmentationMask(raster, 2, 2);
  const text = `<0f>0<|box;x1=10;y1=20;x2=11;y2=21;w=100;h=100|><|mask;x=0;y=0;data=2,2,${encoded.payload}|>`;
  it('rejects oversized raster dimensions before the codec can allocate', () => {
    expect(() => parseSamText(text.replace('data=2,2,', 'data=100000,100000,'))).toThrow('too large');
  });
  it('parses an actual encoded raster and keeps the source-pixel bounds', () => {
    const masks = parseSamText(text); expect(masks).toHaveLength(1); expect(masks[0]!.bounds).toEqual({ left: 10, top: 20, right: 12, bottom: 22 });
  });
  it('sends box prompts through the approved builder and refuses out-of-image boxes', async () => {
    const request = vi.fn(async () => Response.json({ output: [{ content: [{ text }] }] }));
    const result = await segmentImage(cfg, { image, concept: 'clause', width: 100, height: 100, box: { left: 10, top: 20, right: 12, bottom: 22 } }, request);
    expect(result.masks).toHaveLength(1);
    await expect(segmentImage(cfg, { image, concept: 'clause', width: 100, height: 100, box: { left: 10, top: 20, right: 200, bottom: 22 } }, request)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('document evidence and explicit proposals', () => {
  it('parses literals from the quote, never asks the model to supply values', () => {
    expect(proposalFor(clause)).toMatchObject({ kind: 'paymentDays', value: 30, source: 'document-unverified', quote: clause.quote });
    expect(proposalFor({ ...clause, kind: 'amount', quote: 'Total ZAR 120,000.00 payable.' })).toMatchObject({ kind: 'amount', value: 120000 });
    expect(proposalFor({ ...clause, kind: 'amount', quote: 'R100 or R200 depending on delivery' })).toBeNull();
    expect(proposalFor({ ...clause, quote: 'Payment after 30 business days.' })).toBeNull();
    expect(proposalFor({ ...clause, quote: 'Pay within 30 days or 60 days.' })).toBeNull();
    expect(proposalFor({ ...clause, kind: 'penalty', quote: 'Penalty R500.' })).toBeNull();
  });
  it('requires quotes and correctly ordered page-relative boxes', () => {
    expect(documentReadingSchema.safeParse({ unreadable: false, clauses: [clause] }).success).toBe(true);
    expect(documentReadingSchema.safeParse({ unreadable: false, clauses: [{ ...clause, quote: '' }] }).success).toBe(false);
    expect(documentReadingSchema.safeParse({ unreadable: false, clauses: [{ ...clause, box: [500, 0, 100, 40] }] }).success).toBe(false);
  });
  it('reads a PDF as source data and validates JSON; unreadable means no extracted clauses', async () => {
    const request = vi.fn(async () => Response.json({ output: [{ content: [{ text: JSON.stringify({ unreadable: true, clauses: [clause] }) }] }] }));
    const result = await readDocument(cfg, 'data:application/pdf;base64,YWJj', request);
    expect(result.clauses).toEqual([]);
    const init = (request.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init?.body)).input[0].content[1].type).toBe('input_file');
  });
});

describe('routes', () => {
  const req = (body: unknown, origin?: string) => new Request('https://app.test/api/world', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
  it('no key provides an honest demo, never a fake document extraction', async () => {
    vi.stubEnv('META_MODEL_ENABLED', 'false'); const request = vi.fn(); vi.stubGlobal('fetch', request);
    expect(await (await worldPost(req({ action: 'plan', story: 'A hire decision' }))).json()).toMatchObject({ mode: 'fixture', manifestUrl: '/worlds/photo-demo/manifest.json' });
    expect(await (await documentPost(req({ document: image, consent: true }))).json()).toMatchObject({ mode: 'fixture', reading: null }); expect(request).not.toHaveBeenCalled();
  });
  it('requires document consent and refuses cross-site paid requests before fetching', async () => {
    vi.stubEnv('META_MODEL_ENABLED', 'true'); vi.stubEnv('META_API_KEY', 'test-only'); const request = vi.fn(); vi.stubGlobal('fetch', request);
    expect((await documentPost(req({ document: image, consent: false }))).status).toBe(400);
    expect((await documentPost(req({ document: image, consent: true }, 'https://other.test'))).status).toBe(403);
    expect((await worldPost(req({ action: 'draw', prompt: 'A workshop' }, 'https://other.test'))).status).toBe(403); expect(request).not.toHaveBeenCalled();
  });
});

import { findWorldObjects, visibleObjectsSchema } from './objects';
describe('visible object grounding', () => {
  const objects = ['contract','pan','fridge','intake_desk','memo'].map(id=>({id,label:'Work surface',concept:'wooden counter',box:[10,20,300,400]}));
  it('requires five distinct slots, safe labels and ordered boxes',()=>{
    expect(visibleObjectsSchema.safeParse({objects}).success).toBe(true);
    expect(visibleObjectsSchema.safeParse({objects:objects.map(o=>({...o,id:'contract'}))}).success).toBe(false);
    expect(visibleObjectsSchema.safeParse({objects:objects.map(o=>({...o,label:'R500 profit'}))}).success).toBe(false);
    expect(visibleObjectsSchema.safeParse({objects:objects.map(o=>({...o,box:[900,0,100,100]}))}).success).toBe(false);
  });
  it('uses image input with minimal reasoning and bounded output',async()=>{
    const request=vi.fn(async()=>Response.json({output:[{content:[{text:JSON.stringify({objects})}]}]}));
    expect((await findWorldObjects(cfg,image,'A salon',request)).objects).toHaveLength(5);
    const [url,init]=request.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toContain('/responses');
    expect(JSON.parse(String(init.body))).toMatchObject({reasoning:{effort:'minimal'},max_output_tokens:3000,input:[{content:[{type:'input_text'},{type:'input_image',image_url:image}]}]});
  });
});
