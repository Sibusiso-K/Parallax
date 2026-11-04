import { useEffect, useRef, useState } from 'react';
import { documentReadingSchema, proposalFor, type DocumentProposal, type DocumentReading } from '../../../../shared/world/document';
import type { SamMask } from '../../../../shared/providers/sam';
import { compactImage, maskDataUrl } from './masks';
import { callWorld } from './live-world';
import './studio.css';

const fileData = (file: File): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not open that file.')); reader.readAsDataURL(file); });
export interface ContractDropProps { onApply: (proposal: DocumentProposal) => void }
export function ContractDrop({ onApply }: ContractDropProps) {
  const [source, setSource] = useState(''); const [name, setName] = useState(''); const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [consent, setConsent] = useState(false); const [confirmed, setConfirmed] = useState(false); const [reading, setReading] = useState<DocumentReading | null>(null);
  const [selected, setSelected] = useState(0); const [mask, setMask] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null); const fileRevision = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  const choose = async (file?: File) => {
    if (!file) return;
    controller.current?.abort(); const revision = ++fileRevision.current;
    setBusy(false); setReading(null); setMask(''); setConfirmed(false); setConsent(false); setSource(''); setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { setMessage('Choose a JPEG, PNG, WebP or PDF.'); return; }
    if (file.size > (file.type === 'application/pdf' ? 2_800_000 : 12_000_000)) { setMessage('Choose a PDF under 2.8 MB or an image under 12 MB.'); return; }
    try {
      const data = await fileData(file); const image = file.type === 'application/pdf' ? { dataUrl: data, width: 0, height: 0 } : await compactImage(data);
      if (revision !== fileRevision.current) return;
      setSource(image.dataUrl); setDimensions(image); setName(file.name); setSelected(0);
    } catch { if (revision === fileRevision.current) setMessage('That file could not be opened.'); }
  };
  const read = async () => {
    const current = new AbortController(); controller.current?.abort(); controller.current = current; setBusy(true); setMessage('Reading the clauses…');
    try {
      const response = await fetch('/api/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document: source, consent }), signal: AbortSignal.any([current.signal, AbortSignal.timeout(55_000)]) });
      const data = await response.json(); if (current.signal.aborted) return;
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be read.');
      if (data.mode !== 'model') { setMessage('Document reading is not connected. Nothing was extracted or changed.'); return; }
      const result = documentReadingSchema.parse(data.reading); setReading(result); setSelected(0); setConfirmed(false); setMask('');
      setMessage(result.unreadable || !result.clauses.length ? 'No readable clauses were found. Try a clearer photograph.' : 'Check each quote against the original before applying a proposal.');
    } catch (error) { if (!current.signal.aborted) setMessage(error instanceof Error ? error.message : 'The document could not be read.'); }
    finally { if (controller.current === current) setBusy(false); }
  };
  const clause = reading?.clauses[selected]; const proposal = clause ? proposalFor(clause) : null; const pdf = source.startsWith('data:application/pdf');
  const refine = async () => {
    if (!clause || pdf) return;
    const current = new AbortController(); controller.current = current; setBusy(true); setMessage('Locating this clause on the page…');
    try {
      const [l, t, r, b] = clause.box;
      const result = await callWorld({ action: 'segment', image: source, concept: 'text clause', ...dimensions, box: { left: Math.floor(l * dimensions.width / 1000), top: Math.floor(t * dimensions.height / 1000), right: Math.ceil(r * dimensions.width / 1000), bottom: Math.ceil(b * dimensions.height / 1000) } }, current.signal);
      const found = (result.masks as SamMask[] | undefined)?.[0];
      if (found && !current.signal.aborted) { setMask(maskDataUrl(found, dimensions.width, dimensions.height)); setMessage('SAM region shown. Check it against the quote; segmentation does not verify the terms.'); }
      else setMessage('No precise region was found. The approximate reading box is still shown.');
    } catch { if (!current.signal.aborted) setMessage('Precise highlighting is unavailable. The approximate box is still shown.'); }
    finally { if (controller.current === current) setBusy(false); }
  };
  return <section className="px-studio" aria-label="Read a contract">
    <h2>Read the small print. See the consequence.</h2>
    <p>Bring the actual contract or invoice. Review the words in context, then choose what becomes an assumption.</p>
    <div className="px-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
      <label>Drop a document or choose a file<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => void choose(event.target.files?.[0])} /></label>
      <label>Photograph a page<input type="file" accept="image/*" capture="environment" onChange={event => void choose(event.target.files?.[0])} /></label>
      <span>{name}</span>
    </div>
    {source && <><label className="px-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />Send this document to Meta for reading. It is not saved by this studio.</label>
      <div className="px-actions"><button disabled={!consent || busy} onClick={() => void read()}>Read document</button><button className="secondary" onClick={() => { fileRevision.current++; controller.current?.abort(); setSource(''); setReading(null); setMask(''); setName(''); setBusy(false); setMessage('Document removed from this studio.'); }}>Remove document</button></div></>}
    <p role="status">{message}</p>
    {source && <div className="px-document-layout"><div className="px-document-source">
      {pdf ? <iframe title="Original PDF document" src={`${source}#page=${clause?.page ?? 1}`} /> : <><img src={source} alt="Your original document" />
        {mask ? <div className="px-clause-mask" style={{ maskImage: `url(${mask})`, maskSize: '100% 100%', WebkitMaskImage: `url(${mask})`, WebkitMaskSize: '100% 100%' }} /> : clause && <div className="px-clause-box" style={{ left: `${clause.box[0] / 10}%`, top: `${clause.box[1] / 10}%`, width: `${(clause.box[2] - clause.box[0]) / 10}%`, height: `${(clause.box[3] - clause.box[1]) / 10}%` }} />}</>}
    </div><div className="px-clauses">
      <div className="px-clause-nav">{reading?.clauses.map((item, index) => <button className="secondary" key={index} disabled={busy} aria-pressed={selected === index} onClick={() => { setSelected(index); setMask(''); setConfirmed(false); }}>{item.kind.replace('_', ' ')} · {index + 1}</button>)}</div>
      {clause && <><p className="px-disclosure">Unverified transcription · page {clause.page}</p><blockquote>“{clause.quote}”</blockquote>
        {pdf ? <p className="px-disclosure">Open the indicated PDF page to check the quote. For a precise visual highlight, photograph that page and upload it as an image.</p> : <button className="secondary" disabled={busy} onClick={() => void refine()}>Highlight exact region</button>}
        {proposal ? <><p>Proposed {proposal.kind === 'paymentDays' ? 'payment delay in calendar days' : 'amount in ZAR'}: <strong>{proposal.value.toLocaleString('en-ZA')}</strong></p>
          <p className="px-disclosure">Document value, not an engine result. Confirm the meaning and destination assumption before applying.</p>
          <label className="px-consent"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked this quote and value against the original.</label>
          <div className="px-actions"><button disabled={!confirmed || busy} onClick={() => { onApply(proposal); setConfirmed(false); setMessage('Proposal sent to assumption review.'); }}>Use in assumption review</button></div></> : <p>No unambiguous amount or calendar-day term could be parsed. Keep this clause as evidence and enter the assumption yourself.</p>}</>}
    </div></div>}
    <p className="px-disclosure">Machine reading can miss or misread clauses. Check the entire document. This is not legal advice. No assumptions change automatically.</p>
  </section>;
}
