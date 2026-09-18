import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneOff, Upload, Trash2, Plus, Search, FileText } from 'lucide-react';
import { fetchDncSummary, fetchDncEntries, addDncEntry, bulkAddDnc, deleteDncEntry } from '../../api/dnc';
import { extractPhoneNumbers, MAX_UPLOAD_BYTES, MAX_NUMBERS_PER_UPLOAD } from '../../utils/phoneNumbers';
import DncCheck from './DncCheck';

const PAGE_SIZE = 50;

// Admin / Supervisor: maintain each campaign's Do-Not-Call list -- add one number, or upload a file of them.
export default function DncManagement() {
  const [campaigns, setCampaigns] = useState([]); // [{ campaignId, campaignName, count }]
  const [selectedId, setSelectedId] = useState('');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState(null); // { ok, text }

  const [upload, setUpload] = useState(null); // { fileName, numbers, skipped } | { error }
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const selected = campaigns.find(c => c.campaignId === selectedId);

  const loadSummary = useCallback(async () => {
    try {
      const summary = await fetchDncSummary();
      setCampaigns(summary);
      setSelectedId(prev => (summary.some(c => c.campaignId === prev) ? prev : summary[0]?.campaignId || ''));
    } catch (err) {
      setError(err.message || 'Could not load the DNC lists.');
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const loadEntries = useCallback(async ({ append = false, offset = 0 } = {}) => {
    if (!selectedId) { setEntries([]); setTotal(0); return; }
    setLoading(true);
    try {
      const res = await fetchDncEntries(selectedId, { q: query, limit: PAGE_SIZE, offset });
      setEntries(prev => (append ? [...prev, ...res.entries] : res.entries));
      setTotal(res.total);
    } catch (err) {
      setError(err.message || 'Could not load the numbers.');
    } finally {
      setLoading(false);
    }
  }, [selectedId, query]);

  // Reload the first page whenever the campaign or the search text changes (typing is debounced).
  useEffect(() => {
    const timer = setTimeout(() => loadEntries(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadEntries, query]);

  const resetForCampaign = (id) => {
    setSelectedId(id);
    setQuery('');
    setAddMessage(null);
    setUpload(null);
    setImportResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const refreshAll = async () => {
    await Promise.all([loadSummary(), loadEntries()]);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddMessage(null);
    if (!phone.trim()) return setAddMessage({ ok: false, text: 'Enter a phone number.' });
    setAdding(true);
    try {
      await addDncEntry(selectedId, phone.trim(), note.trim());
      setAddMessage({ ok: true, text: `${phone.trim()} added to the ${selected?.campaignName} DNC list.` });
      setPhone('');
      setNote('');
      await refreshAll();
    } catch (err) {
      setAddMessage({ ok: false, text: err.message || 'Could not add that number.' });
    } finally {
      setAdding(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    setImportResult(null);
    setUpload(null);
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      return setUpload({ error: `That file is too large (limit ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB). Split it into smaller files.` });
    }
    try {
      const text = await file.text();
      const { numbers, skipped } = extractPhoneNumbers(text);
      if (numbers.length === 0) return setUpload({ error: 'No phone numbers were found in that file. Use a .csv or .txt file with one number per line or column.' });
      if (numbers.length > MAX_NUMBERS_PER_UPLOAD) {
        return setUpload({ error: `That file has ${numbers.length.toLocaleString()} numbers; the limit is ${MAX_NUMBERS_PER_UPLOAD.toLocaleString()} per upload. Split it and upload in parts.` });
      }
      setUpload({ fileName: file.name, numbers, skipped });
    } catch {
      setUpload({ error: 'Could not read that file.' });
    }
  };

  const handleImport = async () => {
    if (!upload?.numbers) return;
    setImporting(true);
    setError('');
    try {
      const result = await bulkAddDnc(selectedId, upload.numbers);
      setImportResult({ ...result, skippedInFile: upload.skipped, fileName: upload.fileName });
      setUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshAll();
    } catch (err) {
      setError(err.message || 'The import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (entry) => {
    setError('');
    try {
      await deleteDncEntry(entry.id);
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Could not remove that number.');
    }
  };

  const checkableProjects = campaigns.map(c => ({ id: c.campaignId, name: c.campaignName }));

  return (
    <div className="dnc-manage">
      <div className="page-header">
        <div>
          <h1 className="page-title">DNC Lists</h1>
          <p className="page-subtitle">Each campaign has its own Do-Not-Call list. Agents search these lists before dialling.</p>
        </div>
      </div>

      {error && <div className="error-alert margin-bottom" role="alert">{error}</div>}

      {campaigns.length === 0 ? (
        <div className="card"><div className="text-muted">No campaigns available to manage yet.</div></div>
      ) : (
        <>
          <DncCheck projects={checkableProjects} embedded />

          <div className="dnc-tabs" role="tablist" aria-label="Campaign DNC lists">
            {campaigns.map(c => (
              <button
                key={c.campaignId}
                role="tab"
                aria-selected={c.campaignId === selectedId}
                className={`dnc-tab ${c.campaignId === selectedId ? 'active' : ''}`}
                onClick={() => resetForCampaign(c.campaignId)}
              >
                {c.campaignName} <span className="dnc-tab-count">{c.count.toLocaleString()}</span>
              </button>
            ))}
          </div>

          <div className="grid-2 margin-bottom">
            <form className="card" onSubmit={handleAdd}>
              <div className="card-header"><span className="card-title"><Plus size={16} className="text-accent" /> Add a number to {selected?.campaignName}</span></div>
              <div className="form-group">
                <label className="form-label" htmlFor="dnc-add-phone">Phone number</label>
                <input id="dnc-add-phone" type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0300 1234567" autoComplete="off" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="dnc-add-note">Note (optional)</label>
                <input id="dnc-add-note" type="text" className="form-input" maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. customer requested removal" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding}>Add to DNC</button>
              {addMessage && <div className={addMessage.ok ? 'dnc-msg-ok' : 'error-alert'} role={addMessage.ok ? 'status' : 'alert'} style={{ marginTop: '0.75rem' }}>{addMessage.text}</div>}
            </form>

            <div className="card">
              <div className="card-header"><span className="card-title"><Upload size={16} className="text-accent" /> Upload a file to {selected?.campaignName}</span></div>
              <div className="form-group">
                <label className="form-label" htmlFor="dnc-file">A .csv or .txt file of phone numbers</label>
                <input id="dnc-file" ref={fileInputRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="form-input" onChange={handleFile} />
              </div>
              {upload?.error && <div className="error-alert" role="alert">{upload.error}</div>}
              {upload?.numbers && (
                <div className="dnc-preview" role="status">
                  <FileText size={16} />
                  <div>
                    <div><strong>{upload.numbers.length.toLocaleString()}</strong> numbers found in {upload.fileName}</div>
                    {upload.skipped > 0 && <div className="text-xs text-subtle">{upload.skipped} other entries looked like numbers but were not valid and will be ignored.</div>}
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
                    {importing ? 'Importing…' : `Import to ${selected?.campaignName}`}
                  </button>
                </div>
              )}
              {importResult && (
                <div className="dnc-msg-ok" role="status">
                  Imported {importResult.added.toLocaleString()} new {importResult.added === 1 ? 'number' : 'numbers'} from {importResult.fileName}.
                  {importResult.duplicates > 0 && ` ${importResult.duplicates.toLocaleString()} were already on the list or repeated in the file.`}
                  {importResult.invalid > 0 && ` ${importResult.invalid.toLocaleString()} were not valid phone numbers.`}
                </div>
              )}
              <div className="text-xs text-subtle" style={{ marginTop: '0.6rem' }}>
                One number per line, or a spreadsheet exported as CSV. Numbers can be written any way (0300…, +92 300…, (555) 123-4567). Other columns are ignored.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header dnc-list-header">
              <span className="card-title"><PhoneOff size={16} className="text-accent" /> {selected?.campaignName} DNC list ({total.toLocaleString()})</span>
              <div className="dnc-search">
                <Search size={14} />
                <input type="search" className="form-input" placeholder="Search numbers…" aria-label="Search this DNC list" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Phone number</th><th>Note</th><th>Added by</th><th>Added</th><th></th></tr></thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem' }}>{loading ? 'Loading…' : query ? 'No numbers match that search.' : 'No numbers on this list yet.'}</td></tr>
                  ) : entries.map(e => (
                    <tr key={e.id}>
                      <td className="font-mono font-bold">{e.phone}</td>
                      <td className="text-sm text-muted">{e.note || '—'}</td>
                      <td className="text-sm">{e.addedBy || '—'}</td>
                      <td className="text-sm text-muted">{e.createdAt.slice(0, 10)}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e)} aria-label={`Remove ${e.phone} from the DNC list`}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {entries.length < total && (
              <div style={{ textAlign: 'center', marginTop: '0.85rem' }}>
                <button className="btn btn-secondary" onClick={() => loadEntries({ append: true, offset: entries.length })} disabled={loading}>
                  Load more ({(total - entries.length).toLocaleString()} remaining)
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        .dnc-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
        .dnc-tab { border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-muted); font-weight: 600; font-size: 0.82rem; padding: 0.45rem 0.85rem; border-radius: 9999px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; }
        .dnc-tab.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
        .dnc-tab-count { background: var(--bg-primary); border-radius: 999px; padding: 0 0.45rem; font-size: 0.7rem; font-weight: 800; }
        .dnc-msg-ok { padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); background: var(--status-success-bg, rgba(16,185,129,0.1)); color: var(--status-success); font-size: 0.82rem; font-weight: 600; margin-top: 0.75rem; }
        .dnc-preview { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.75rem; border: 1px dashed var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); font-size: 0.85rem; }
        .dnc-preview .btn { margin-left: auto; }
        .dnc-list-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
        .dnc-search { display: flex; align-items: center; gap: 0.4rem; color: var(--text-subtle); }
        .dnc-search .form-input { width: 210px; }
      `}</style>
    </div>
  );
}
