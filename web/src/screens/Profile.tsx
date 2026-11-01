import { formatRange } from '../../../shared/intake/amount';
import type { Figure, MoneyKey, Profile as ProfileData } from '../../../shared/profile/profile';

// F5 "You, today": facts, assumed defaults (marked) and priorities. Every path reads from it.
const rows: { key: MoneyKey; label: string }[] = [
  { key: 'takeHome', label: 'Take-home pay a month' },
  { key: 'sideIncome', label: 'Side business profit a month' },
  { key: 'essentialExpenses', label: 'Essentials a month' },
  { key: 'familySupportMonthly', label: 'Support to family a month' },
  { key: 'debtRepayments', label: 'Debt repayments a month' },
  { key: 'savings', label: 'Savings today' },
];

export function Profile({ profile, onEdit, onContinue }: { profile: ProfileData; onEdit: () => void; onContinue: () => void }) {
  const about = [profile.ageBand, profile.province].filter(Boolean).join(' · ');
  return (
    <section className="profile" aria-labelledby="profile-title">
      <h2 id="profile-title">You, today</h2>
      <p className="muted">{profile.decision}</p>

      <div className="card">
        {about && <p className="small muted">{about}</p>}
        <dl className="heard">
          {rows.map(({ key, label }) => (
            <div className="heard-row" key={key}>
              <dt>{label}</dt>
              <dd>
                <FigureText f={profile.money[key]} />
              </dd>
            </div>
          ))}
          <div className="heard-row">
            <dt>Comfort with risk</dt>
            <dd>{profile.riskComfort ?? <span className="muted">Not given</span>}</dd>
          </div>
          <div className="heard-row">
            <dt>What matters most</dt>
            <dd>{profile.goals.length ? profile.goals.join(', ') : <span className="muted">Not given</span>}</dd>
          </div>
        </dl>
      </div>

      <div className="actions">
        <button type="button" className="primary" onClick={onContinue}>
          Show me my paths
        </button>
        <button type="button" className="quiet" onClick={onEdit}>
          Edit
        </button>
      </div>
    </section>
  );
}

function FigureText({ f }: { f: Figure }) {
  return (
    <span>
      {formatRange(f.low, f.high)}
      {f.source === 'default' && (
        <span className="chip assumed" title="We filled this in. Edit it if you know better.">
          assumed
        </span>
      )}
    </span>
  );
}
