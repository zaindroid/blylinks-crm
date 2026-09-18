import React, { useState } from 'react';
import { PhoneOff, Search, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { checkDnc } from '../../api/dnc';

const MAX_RECENT = 8;

// The agent's Do-Not-Call lookup: type a number, then press the Search button for the campaign the call is
// for. Each campaign has its own list, so there is one button per campaign the agent works on.
export default function DncCheck({ projects = [], embedded = false }) {
  const [phone, setPhone] = useState('');
  const [busyCampaign, setBusyCampaign] = useState('');
  const [result, setResult] = useState(null); // { found, campaignName, phone } | { error }
  const [recent, setRecent] = useState([]);

  const search = async (campaign) => {
    const number = phone.trim();
    if (!number || busyCampaign) return;
    setBusyCampaign(campaign.id);
    setResult(null);
    try {
      const res = await checkDnc(campaign.id, number);
      const outcome = { found: res.found, campaignName: res.campaignName || campaign.name, phone: number };
      setResult(outcome);
      setRecent(list => [outcome, ...list].slice(0, MAX_RECENT));
    } catch (err) {
      setResult({ error: err.message || 'Could not check that number. Please try again.' });
    } finally {
      setBusyCampaign('');
    }
  };

  // With a single campaign there is no ambiguity, so Enter can search; with several, the agent must choose.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (projects.length === 1) search(projects[0]);
  };

  const canSearch = phone.trim().length > 0 && !busyCampaign;

  return (
    <div className={embedded ? 'dnc-check embedded' : 'dnc-check'}>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">DNC Check</h1>
            <p className="page-subtitle">Check a phone number against a campaign&apos;s Do-Not-Call list before you dial.</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title"><PhoneOff size={16} className="text-accent" /> Is this number on the DNC list?</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="dnc-phone">Phone number</label>
            <input
              id="dnc-phone"
              type="tel"
              className="form-input dnc-phone-input"
              placeholder="e.g. 0300 1234567 or +1 555 123 4567"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setResult(null); }}
              autoComplete="off"
              autoFocus={!embedded}
            />
          </div>

          {projects.length === 0 ? (
            <div className="text-sm text-muted">You are not assigned to any campaign yet, so there is no DNC list to search.</div>
          ) : (
            <div>
              <div className="dnc-search-label">Search which campaign&apos;s list?</div>
              <div className="dnc-buttons">
                {projects.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-primary dnc-search-btn"
                    disabled={!canSearch}
                    onClick={() => search(p)}
                  >
                    {busyCampaign === p.id ? <Loader2 size={15} className="dnc-spin" /> : <Search size={15} />} Search {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <div aria-live="polite">
          {result?.error && <div className="error-alert dnc-result-gap" role="alert">{result.error}</div>}

          {result && !result.error && (
            result.found ? (
              <div className="dnc-result dnc-result-found" role="status">
                <ShieldAlert size={30} />
                <div>
                  <div className="dnc-result-title">On the DNC list &mdash; do NOT call</div>
                  <div className="dnc-result-sub">{result.phone} is on the {result.campaignName} Do-Not-Call list.</div>
                </div>
              </div>
            ) : (
              <div className="dnc-result dnc-result-clear" role="status">
                <ShieldCheck size={30} />
                <div>
                  <div className="dnc-result-title">Not on the DNC list &mdash; OK to call</div>
                  <div className="dnc-result-sub">{result.phone} was not found on the {result.campaignName} list.</div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card dnc-recent">
          <div className="card-header"><span className="card-title">Your recent checks</span></div>
          <ul className="dnc-recent-list">
            {recent.map((r, i) => (
              <li key={`${r.phone}-${r.campaignName}-${i}`}>
                <span className="font-mono">{r.phone}</span>
                <span className="text-muted text-sm">{r.campaignName}</span>
                <span className={`badge ${r.found ? 'badge-error' : 'badge-success'}`}>{r.found ? 'On DNC' : 'Clear'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .dnc-check { max-width: 720px; }
        .dnc-check.embedded { max-width: none; margin-bottom: 1.25rem; }
        .dnc-phone-input { font-size: 1.05rem; padding: 0.7rem 0.85rem; }
        .dnc-search-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 0.4rem; }
        .dnc-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .dnc-search-btn { display: inline-flex; align-items: center; gap: 0.4rem; }
        .dnc-spin { animation: dncSpin 0.8s linear infinite; }
        @keyframes dncSpin { to { transform: rotate(360deg); } }
        .dnc-result-gap { margin-top: 1rem; }
        .dnc-result { display: flex; align-items: center; gap: 0.9rem; margin-top: 1rem; padding: 1rem 1.15rem; border-radius: var(--radius-md); border: 1px solid; }
        .dnc-result-found { background: var(--status-error-bg, rgba(239,68,68,0.1)); border-color: var(--status-error); color: var(--status-error); }
        .dnc-result-clear { background: var(--status-success-bg, rgba(16,185,129,0.1)); border-color: var(--status-success); color: var(--status-success); }
        .dnc-result-title { font-weight: 800; font-size: 1.05rem; }
        .dnc-result-sub { font-size: 0.82rem; margin-top: 0.15rem; color: var(--text-main); }
        .dnc-recent { margin-top: 1rem; }
        .dnc-recent-list { list-style: none; margin: 0; padding: 0; }
        .dnc-recent-list li { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.45rem 0; border-bottom: 1px solid var(--border-color); }
        .dnc-recent-list li:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
}
