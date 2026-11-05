import type { DocumentProposal } from '../../../../shared/world/document';
import { simulate, type PathInput } from '../../../../shared/engine/simulate';
import { lowestCash } from '../../../../shared/engine/analysis';
import { delayPath } from '../../../../shared/swarm/engine-tools';
import { formatRand } from '../../../../shared/guard/figures';

export function documentConsequence(proposal: DocumentProposal, path: PathInput, lagMonths: number | null) {
  if (proposal.kind === 'amount') return { message: `${formatRand(proposal.value)} is a document value to check, not an engine figure.`, later: false };
  if (lagMonths === null) return { message: `This contract pays after ${proposal.value} days. This path has no assumed contract payment lag to compare.`, later: false };
  const months = Math.ceil(proposal.value / 30);
  const extra = Math.max(0, months - lagMonths);
  const introduction = `This contract pays after ${proposal.value} days. Your plan assumes ${lagMonths * 30}.`;
  if (!extra) return { message: `${introduction} The document is not later than your plan on the monthly model.`, later: false };
  if (!path.assumptions.some(a => a.role === 'contract' && a.kind === 'income')) return { message: `${introduction} This path has no contract receipts to delay.`, later: false };
  const before = lowestCash(simulate(path), 'likely').cash;
  const after = lowestCash(simulate(delayPath(path, extra)), 'likely').cash;
  return { message: `${introduction} Lowest cash moves from ${formatRand(before)} to ${formatRand(after)}.`, later: true, before, after, extra };
}

export function DocumentConsequence({ proposal, path, lagMonths, onLever, onDismiss }: {
  proposal: DocumentProposal; path: PathInput; lagMonths: number | null; onLever: () => void; onDismiss: () => void;
}) {
  const result = documentConsequence(proposal, path, lagMonths);
  return <aside className="px-studio studio-proposal" aria-label="Document consequence">
    <h3>What this changes</h3>
    <blockquote>{proposal.quote}</blockquote>
    <p className="px-consequence" role="status">{result.message}</p>
    <p className="px-disclosure">Source page {proposal.page}. Check the original. No assumptions have changed.</p>
    {proposal.kind === 'paymentDays' && <p className="px-disclosure">Days round up to whole months using thirty days per month. These are conditional engine projections.</p>}
    {result.later && <p className="px-disclosure">The room lever previews its standard late-payment stress. It does not apply this document's exact delay.</p>}
    <div className="px-actions">{result.later && <button onClick={onLever}>Show me that in the room</button>}<button className="secondary" onClick={onDismiss}>Dismiss</button></div>
  </aside>;
}
