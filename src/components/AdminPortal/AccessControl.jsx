import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Globe, Trash2, Plus, X } from 'lucide-react';
import { fetchAccess, addAccessEntry, removeAccessEntry, setAccessEnabled } from '../../api/access';

// Admin only: decide which networks may open the portal at all. Off until the Admin turns it on. The server
// refuses any change that would lock this Admin out, so the safe path is always the easy one.
export default function AccessControl() {
  const [state, setState] = useState(null); // { enabled, overrideActive, yourIp, yourIpAllowed, entries }
  const [cidr, setCidr] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingEnable, setConfirmingEnable] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await fetchAccess());
    } catch (err) {
      setError(err.message || 'Could not load the access settings.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Runs a change, shows the server's reason if it is refused, and otherwise adopts the fresh state it returns.
  const run = async (action) => {
    setError('');
    setBusy(true);
    try {
      setState(await action());
      return true;
    } catch (err) {
      setError(err.message || 'That change failed.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!cidr.trim()) return setError('Enter an IP address or range, for example 203.0.113.5 or 203.0.113.0/24.');
    if (await run(() => addAccessEntry(cidr.trim(), label.trim()))) {
      setCidr('');
      setLabel('');
    }
  };

  const addMyIp = () => run(() => addAccessEntry(state.yourIp, 'My current address'));

  const toggle = () => {
    if (state.enabled) run(() => setAccessEnabled(false));
    else { setError(''); setConfirmingEnable(true); }
  };

  const confirmEnable = async () => {
    setConfirmingEnable(false);
    await run(() => setAccessEnabled(true));
  };

  if (!state) {
    return (
      <div className="access-control">
        <div className="page-header"><div><h1 className="page-title">IP Access Control</h1></div></div>
        {error ? <div className="error-alert" role="alert">{error}</div> : <div className="text-muted">Loading…</div>}
      </div>
    );
  }

  return (
    <div className="access-control">
      <div className="page-header">
        <div>
          <h1 className="page-title">IP Access Control</h1>
          <p className="page-subtitle">Choose which networks can open the portal. Anyone else sees an “Access restricted” page — they cannot even reach the login screen.</p>
        </div>
      </div>

      {error && <div className="error-alert margin-bottom" role="alert">{error}</div>}

      {state.overrideActive && (
        <div className="access-banner warn" role="status">
          <ShieldAlert size={18} />
          <div><strong>Emergency override is active.</strong> The server was started with <code>IP_RESTRICTION_DISABLED=true</code>, so nothing is being blocked right now, whatever the switch below says.</div>
        </div>
      )}

      <div className="card margin-bottom">
        <div className="access-status">
          <div className={`access-state ${state.enabled ? 'on' : 'off'}`}>
            {state.enabled ? <ShieldCheck size={26} /> : <Globe size={26} />}
            <div>
              <div className="access-state-title">{state.enabled ? 'Restriction is ON' : 'Restriction is OFF'}</div>
              <div className="text-sm text-muted">
                {state.enabled
                  ? `Only the ${state.entries.length} listed ${state.entries.length === 1 ? 'address or range' : 'addresses and ranges'} can open the portal.`
                  : 'The portal can currently be opened from any network.'}
              </div>
            </div>
          </div>
          <button className={`btn ${state.enabled ? 'btn-secondary' : 'btn-primary'}`} onClick={toggle} disabled={busy}>
            {state.enabled ? 'Turn restriction off' : 'Turn restriction on'}
          </button>
        </div>

        <div className="access-you">
          Your current IP address: <code>{state.yourIp || 'unknown'}</code>{' '}
          {state.yourIpAllowed
            ? <span className="badge badge-success">on the list</span>
            : <span className="badge badge-warning">not on the list</span>}
          {!state.yourIpAllowed && state.yourIp && (
            <button className="btn btn-secondary btn-sm" onClick={addMyIp} disabled={busy} style={{ marginLeft: '0.6rem' }}>
              <Plus size={13} /> Add my current IP
            </button>
          )}
        </div>
      </div>

      <div className="card margin-bottom">
        <div className="card-header"><span className="card-title"><Plus size={16} className="text-accent" /> Allow an address</span></div>
        <form className="access-form" onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label" htmlFor="access-cidr">IP address or range</label>
            <input id="access-cidr" type="text" className="form-input" value={cidr} onChange={e => setCidr(e.target.value)} placeholder="203.0.113.5  or  203.0.113.0/24" autoComplete="off" spellCheck="false" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="access-label">Label (optional)</label>
            <input id="access-label" type="text" className="form-input" maxLength={100} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Lahore office" />
          </div>
          <button type="submit" className="btn btn-primary access-add" disabled={busy}>Allow</button>
        </form>
        <div className="text-xs text-subtle" style={{ marginTop: '0.5rem' }}>
          A single address allows one connection point. A range like <code>203.0.113.0/24</code> allows a whole network (256 addresses). IPv4 and IPv6 both work.
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title"><ShieldCheck size={16} className="text-accent" /> Allowed addresses ({state.entries.length})</span></div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Address / range</th><th>Label</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {state.entries.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem' }}>No addresses yet. Add your own first, then you can turn the restriction on.</td></tr>
              ) : state.entries.map(entry => (
                <tr key={entry.id}>
                  <td className="font-mono font-bold">{entry.cidr}</td>
                  <td className="text-sm text-muted">{entry.label || '—'}</td>
                  <td className="text-sm text-muted">{entry.createdAt.slice(0, 10)}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => removeAccessEntry(entry.id))} aria-label={`Remove ${entry.cidr}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmingEnable && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }} role="dialog" aria-label="Turn on IP restriction">
            <div className="modal-header">
              <span className="modal-title">Turn the IP restriction on?</span>
              <button className="icon-btn" onClick={() => setConfirmingEnable(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>From now on, only the {state.entries.length} listed {state.entries.length === 1 ? 'address or range' : 'addresses and ranges'} can open the portal. Everyone else — agents working from home included — will be locked out until you add their address.</p>
              <p className="text-sm text-muted" style={{ marginTop: '0.6rem' }}>Your own address ({state.yourIp}) is on the list, so you will not be locked out. Their connection address can change if they use mobile data or a home connection without a fixed IP.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmingEnable(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmEnable}>Turn on restriction</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .access-control { max-width: 900px; }
        .access-status { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .access-state { display: flex; align-items: center; gap: 0.8rem; }
        .access-state.on { color: var(--status-success); }
        .access-state.off { color: var(--text-muted); }
        .access-state-title { font-weight: 800; font-size: 1.05rem; color: var(--text-main); }
        .access-you { margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border-color); font-size: 0.85rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; }
        .access-you code, .access-control code { background: var(--bg-primary); padding: 0.1rem 0.4rem; border-radius: 5px; font-size: 0.82rem; }
        .access-form { display: grid; grid-template-columns: 1.3fr 1fr auto; gap: 0.75rem; align-items: end; }
        .access-add { height: 38px; }
        .access-banner { display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem; }
        .access-banner.warn { background: var(--status-warning-bg, rgba(245,158,11,0.12)); border: 1px solid var(--status-warning, #f59e0b); }
        @media (max-width: 640px) { .access-form { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
