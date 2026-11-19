import React, { useState } from 'react';
import { Search, PhoneCall, DollarSign, Users, Clock } from 'lucide-react';
import { checkLead } from '../../api/checkLead';
import { formatPKR } from '../../utils/currency';

function statusBadgeClass(status) {
  if (status === 'Approved' || status === 'Active') return 'badge-success';
  if (status === 'Pending' || status === 'Tardy' || status === 'Late') return 'badge-warning';
  if (status === 'Rejected' || status === 'Do Not Call') return 'badge-error';
  return 'badge-neutral';
}

export default function CheckLead() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null); // null = no search run yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      setResult(await checkLead(phone.trim()));
    } catch (err) {
      setResult(null);
      setError(err.message || 'Could not check this number.');
    } finally {
      setLoading(false);
    }
  };

  const totalFound = result ? result.sales.length + result.leads.length + result.callbacks.length : 0;

  return (
    <div className="check-lead-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Check Lead</h1>
          <p className="page-subtitle">
            Search a phone number across every campaign in the organization to see any sale, lead or callback already
            on record for it -- before you dial, log or submit it again.
          </p>
        </div>
      </div>

      <div className="card margin-bottom">
        <form className="check-lead-search-row" onSubmit={handleSearch}>
          <div className="search-box check-lead-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Enter a phone number, e.g. (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-label="Phone number to check"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !phone.trim()}>
            {loading ? 'Checking…' : 'Check Number'}
          </button>
        </form>
      </div>

      {error && <div className="error-alert margin-bottom" role="alert">{error}</div>}

      {result && !error && (
        <>
          {totalFound === 0 ? (
            <div className="card check-lead-empty">
              <div className="check-lead-empty-icon"><PhoneCall size={22} /></div>
              <div className="font-bold">No activity found for this number.</div>
              <div className="text-muted text-sm">It has never been submitted as a sale, lead or callback in any campaign.</div>
            </div>
          ) : (
            <>
              {result.sales.length > 0 && (
                <div className="card margin-bottom">
                  <div className="card-header"><span className="card-title flex-align"><DollarSign size={16} className="text-cyan" /> Sales ({result.sales.length})</span></div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr><th>Sale ID</th><th>Customer</th><th>Campaign</th><th>Agent</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {result.sales.map(s => (
                          <tr key={s.id}>
                            <td className="font-mono">{s.id}</td>
                            <td>{s.customerName}</td>
                            <td>{s.projectName}</td>
                            <td>{s.agentName}</td>
                            <td className="font-mono">{formatPKR(s.amount)}</td>
                            <td><span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                            <td className="text-muted">{s.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.leads.length > 0 && (
                <div className="card margin-bottom">
                  <div className="card-header"><span className="card-title flex-align"><Users size={16} className="text-cyan" /> Leads ({result.leads.length})</span></div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr><th>Name</th><th>Campaign</th><th>Assigned Agent</th><th>Status</th><th>Last Contact</th></tr>
                      </thead>
                      <tbody>
                        {result.leads.map(l => (
                          <tr key={l.id}>
                            <td>{l.name}</td>
                            <td>{l.projectName}</td>
                            <td>{l.assignedAgentName || '—'}</td>
                            <td><span className={`badge ${statusBadgeClass(l.status)}`}>{l.status}</span></td>
                            <td className="text-muted">{l.lastContact || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.callbacks.length > 0 && (
                <div className="card margin-bottom">
                  <div className="card-header"><span className="card-title flex-align"><Clock size={16} className="text-cyan" /> Callbacks ({result.callbacks.length})</span></div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr><th>Customer</th><th>Campaign</th><th>Agent</th><th>Status</th><th>Due Date</th></tr>
                      </thead>
                      <tbody>
                        {result.callbacks.map(c => (
                          <tr key={c.id}>
                            <td>{c.customerName}</td>
                            <td>{c.projectName}</td>
                            <td>{c.agentName}</td>
                            <td><span className={`badge ${statusBadgeClass(c.status)}`}>{c.status}</span></td>
                            <td className="text-muted">{new Date(c.dueDate).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        .check-lead-search-row { display: flex; gap: 0.6rem; }
        .check-lead-search-box { flex: 1; }
        .check-lead-empty { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 2.5rem 1rem; text-align: center; }
        .check-lead-empty-icon { opacity: 0.5; margin-bottom: 0.25rem; }
      `}</style>
    </div>
  );
}
