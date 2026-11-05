import { useEffect, useRef, useState } from 'react';
import type { PhotoManifest } from '../../../../shared/world/manifest';
import { buildLiveWorld, type WorldProgress } from './live-world';
import { forgetWorlds } from './cache';
import './studio.css';

export interface WorldStudioProps { story: string; onWorld: (world: PhotoManifest) => void; onProgress?: (event: WorldProgress) => void }
export function WorldStudio({ story, onWorld, onProgress }: WorldStudioProps) {
  const [draft, setDraft] = useState(story); const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [preview, setPreview] = useState<PhotoManifest | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const build = async () => {
    controller.current?.abort(); const current = new AbortController(); controller.current = current; setBusy(true);
    try {
      const result = await buildLiveWorld(draft, { signal: current.signal, saveLocally: save, onProgress: event => { setMessage(event.step); onProgress?.(event); } });
      if (current.signal.aborted) return;
      setPreview(result.manifest); setMessage(result.message); onWorld(result.manifest);
    } catch (error) { if (!current.signal.aborted) setMessage(error instanceof Error ? error.message : 'The world is unavailable.'); }
    finally { if (controller.current === current) setBusy(false); }
  };
  return <section className="px-studio" aria-label="Build your world">
    <h2>A place that feels like yours.</h2>
    <p>Describe the work, the space, and the decision ahead. Build a photographic setting you can explore.</p>
    {preview && <img className="px-world-preview" src={preview.plate} alt={`Illustrative generated setting: ${preview.title}`} />}
    <label>Your business and decision<textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} disabled={busy} /></label>
    <label className="px-consent"><input type="checkbox" checked={save} onChange={event => setSave(event.target.checked)} disabled={busy} />Save the generated world on this device.</label>
    <div className="px-actions"><button disabled={busy || !draft.trim()} onClick={() => void build()}>{busy ? 'Building your world…' : 'Build my world'}</button>
      {busy && <button className="secondary" onClick={() => { controller.current?.abort(); setBusy(false); setMessage('Cancelled. Your current world is unchanged.'); }}>Cancel</button>}
      <button className="secondary" disabled={busy} onClick={() => void forgetWorlds().then(() => setMessage('Saved worlds removed from this device.')).catch(() => setMessage('Local storage is unavailable.'))}>Forget saved worlds</button></div>
    <p role="status" aria-live="polite">{message}</p>
    <p className="px-disclosure">Build sends this description to Meta to generate illustrative imagery. People are fictional. Financial assumptions stay unchanged. Without a connection, the labelled demo world is shown.</p>
  </section>;
}
