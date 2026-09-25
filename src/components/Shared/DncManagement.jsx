import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneOff, Upload, Plus, Pencil, Search, FileText, Check, X, Trash2, AlertTriangle } from 'lucide-react';
import { fetchDncSummary, fetchDncEntries, addDncEntry, bulkAddDnc, updateDncEntry, deleteDncEntry, bulkDeleteDnc, clearDncList } from '../../api/dnc';
import { parseDncFile, IMPORT_CHUNK_SIZE } from '../../utils/phoneNumbers';
import DncCheck from './DncCheck';

const PAGE_SIZE = 50;
const MAX_FIELD_CHIPS = 4; // how many of a row's extra sheet columns to show before collapsing the rest

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

  const [upload, setUpload] = useState(null); // { fileName, rows, skipped, columns, phoneColumn } | { error }
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null); // { done, total } while chunks are uploading
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(null); // { id, phone, note } for the row being edited
  const [editBusy, setEditBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearAllError, setClearAllError] = useState('');

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
    setEditing(null);
    setError('');
    setSelectedIds(new Set());
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
      setAddMessage({ ok: true, text: `${phone.trim()} added.` });
      setPhone('');
      setNote('');
      await refreshAll();
    } catch (err) {
      setAddMessage({ ok: false, text: err.message || 'Could not add that number.' });
    } finally {
      setAdding(false);
    }
  };

  // A file of any size is accepted: it is read once, and the import below sends it in chunks, so there is no
  // ceiling here to raise.
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    setImportResult(null);
    setUpload(null);
    if (!file) return;
    try {
      const { rows, skipped, columns, phoneColumn } = parseDncFile(await file.text());
      if (rows.length === 0) {
        return setUpload({ error: 'No phone numbers were found in that file. Use a .csv or .txt file with one number per line, or a sheet with a phone column.' });
      }
      setUpload({ fileName: file.name, rows, skipped, columns, phoneColumn });
    } catch {
      setUpload({ error: 'Could not read that file.' });
    }
  };

  // One chunk at a time, so a large file makes progress instead of sitting there, and a failure part-way
  // through leaves the parts that already landed as real rows -- the refresh below shows them for what they
  // are rather than making the whole thing look like it did nothing.
  const handleImport = async () => {
    if (!upload?.rows) return;
    setImporting(true);
    setError('');
    setImportProgress({ done: 0, total: upload.rows.length });
    const totals = { received: 0, added: 0, duplicates: 0, enriched: 0, invalid: 0 };
    try {
      for (let sent = 0; sent < upload.rows.length; sent += IMPORT_CHUNK_SIZE) {
        const result = await bulkAddDnc(selectedId, upload.rows.slice(sent, sent + IMPORT_CHUNK_SIZE));
        totals.received += result.received;
        totals.added += result.added;
        totals.duplicates += result.duplicates;
        totals.enriched += result.enriched || 0;
        totals.invalid += result.invalid;
        setImportProgress({ done: Math.min(sent + IMPORT_CHUNK_SIZE, upload.rows.length), total: upload.rows.length });
      }
      setImportResult({ ...totals, skippedInFile: upload.skipped, fileName: upload.fileName });
      setUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message || 'The import failed.');
    } finally {
      setImporting(false);
      setImportProgress(null);
      await refreshAll();
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

  // Editing a listed number: the server refuses a change that would put a number on the list twice, so the
  // message a rejected edit produces is worth showing as-is rather than flattening it into "could not save".
  const saveEdit = async (entry) => {
    if (!editing) return;
    setEditBusy(true);
    setError('');
    try {
      await updateDncEntry(entry.id, editing.phone.trim(), editing.note.trim());
      setEditing(null);
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Could not save that change.');
    } finally {
      setEditBusy(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id));
  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        entries.forEach(e => next.delete(e.id));
        return next;
      }
      return new Set([...prev, ...entries.map(e => e.id)]);
    });
  };

  // Deletes just the checked rows -- for removing a handful of specific numbers spotted while
  // browsing or searching. To wipe the whole list regardless of how many that is, use Remove All.
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setError('');
    setBulkDeleting(true);
    try {
      await bulkDeleteDnc(selectedId, [...selectedIds]);
      setSelectedIds(new Set());
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Could not delete the selected numbers.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleClearAll = async () => {
    setClearAllError('');
    setClearingAll(true);
    try {
      await clearDncList(selectedId);
      setConfirmingClearAll(false);
      setSelectedIds(new Set());
      await refreshAll();
    } catch (err) {
      setClearAllError(err.message || 'Could not clear the list.');
    } finally {
      setClearingAll(false);
    }
  };

  const checkableProjects = campaigns.map(c => ({ id: c.campaignId, name: c.campaignName }));
  const selectedCampaignName = campaigns.find(c => c.campaignId === selectedId)?.campaignName || 'this campaign';

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
              <div className="card-header"><span className="card-title"><Plus size={16} className="text-accent" /> Add a number</span></div>
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
              <div className="card-header"><span className="card-title"><Upload size={16} className="text-accent" /> Upload a file</span></div>
              <div className="form-group">
                <label className="form-label" htmlFor="dnc-file">A .csv or .txt file of phone numbers</label>
                <input id="dnc-file" ref={fileInputRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="form-input" onChange={handleFile} />
              </div>
              {upload?.error && <div className="error-alert" role="alert">{upload.error}</div>}
              {upload?.rows && (
                <div className="dnc-preview" role="status">
                  <FileText size={16} />
                  <div>
                    <div><strong>{upload.rows.length.toLocaleString()}</strong> numbers found in {upload.fileName}</div>
                    <div className="text-xs text-subtle">
                      {upload.phoneColumn ? <>Column: <strong>{upload.phoneColumn}</strong></> : 'No headers detected'}
                      {upload.columns.filter(c => c !== upload.phoneColumn).length > 0 &&
                        ` · Also: ${upload.columns.filter(c => c !== upload.phoneColumn).join(', ')}`}
                      {upload.skipped > 0 && ` · ${upload.skipped.toLocaleString()} skipped`}
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
                    {importing
                      ? `Importing… ${importProgress ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%`
                      : 'Import'}
                  </button>
                </div>
              )}
              {importResult && (
                <div className="dnc-msg-ok" role="status">
                  {importResult.added.toLocaleString()} added
                  {importResult.duplicates > 0 && `, ${importResult.duplicates.toLocaleString()} duplicate${importResult.duplicates === 1 ? '' : 's'}`}
                  {importResult.enriched > 0 && `, ${importResult.enriched.toLocaleString()} updated`}
                  {importResult.invalid > 0 && `, ${importResult.invalid.toLocaleString()} invalid`}
                </div>
              )}
              <div className="text-xs text-subtle" style={{ marginTop: '0.6rem' }}>
                CSV, TXT, or one number per line. Any format or size.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header dnc-list-header">
              <span className="card-title"><PhoneOff size={16} className="text-accent" /> DNC list ({total.toLocaleString()})</span>
              <div className="dnc-header-actions">
                <div className="dnc-search">
                  <Search size={14} />
                  <input type="search" className="form-input" placeholder="Number, name, note…" aria-label="Search this DNC list" value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => { setClearAllError(''); setConfirmingClearAll(true); }}
                  disabled={total === 0}
                  title="Delete every number on this campaign's list"
                >
                  <Trash2 size={13} /> Remove All
                </button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="dnc-bulk-bar" role="status">
                <span>{selectedIds.size.toLocaleString()} selected</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())} disabled={bulkDeleting}>
                  Clear selection
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  <Trash2 size={13} /> {bulkDeleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}
                </button>
              </div>
            )}

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '2.2rem' }}>
                      <input
                        type="checkbox"
                        aria-label="Select all loaded numbers"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        disabled={entries.length === 0}
                      />
                    </th>
                    <th>Phone number</th><th>Details</th><th>Note</th><th>Added by</th><th>Added</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem' }}>{loading ? 'Loading…' : query ? 'No numbers match that search.' : 'No numbers on this list yet.'}</td></tr>
                  ) : entries.map(e => {
                    const isEditing = editing?.id === e.id;
                    const fieldEntries = Object.entries(e.fields || {});
                    const shownFields = fieldEntries.slice(0, MAX_FIELD_CHIPS);
                    return (
                      <tr key={e.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${e.phone}`}
                            checked={selectedIds.has(e.id)}
                            onChange={() => toggleSelect(e.id)}
                          />
                        </td>
                        <td className="font-mono font-bold">
                          {isEditing
                            ? <input
                                type="tel"
                                className="form-input dnc-cell-input"
                                aria-label={`New number for ${e.phone}`}
                                value={editing.phone}
                                onChange={ev => setEditing(cur => ({ ...cur, phone: ev.target.value }))}
                              />
                            : e.phone}
                        </td>
                        <td className="text-sm text-muted">
                          {fieldEntries.length === 0 ? '—' : (
                            <span className="dnc-fields">
                              {shownFields.map(([key, value]) => (
                                <span key={key} className="dnc-field" title={`${key}: ${value}`}>
                                  <span className="dnc-field-key">{key}</span>{value}
                                </span>
                              ))}
                              {fieldEntries.length > shownFields.length && (
                                <span className="dnc-field dnc-field-more" title={fieldEntries.slice(MAX_FIELD_CHIPS).map(([k, v]) => `${k}: ${v}`).join('\n')}>
                                  +{fieldEntries.length - shownFields.length} more
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="text-sm text-muted">
                          {isEditing
                            ? <input
                                type="text"
                                className="form-input dnc-cell-input"
                                aria-label={`New note for ${e.phone}`}
                                maxLength={200}
                                value={editing.note}
                                onChange={ev => setEditing(cur => ({ ...cur, note: ev.target.value }))}
                              />
                            : (e.note || '—')}
                        </td>
                        <td className="text-sm">{e.addedBy || '—'}</td>
                        <td className="text-sm text-muted">{e.createdAt.slice(0, 10)}</td>
                        <td>
                          <div className="dnc-row-actions">
                            {isEditing ? (
                              <>
                                <button className="btn btn-primary btn-sm" onClick={() => saveEdit(e)} disabled={editBusy} aria-label={`Save changes to ${e.phone}`}>
                                  <Check size={13} />
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)} disabled={editBusy} aria-label={`Cancel changes to ${e.phone}`}>
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing({ id: e.id, phone: e.phone, note: e.note || '' }); }} aria-label={`Edit ${e.phone}`}>
                                  <Pencil size={13} />
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e)} aria-label={`Remove ${e.phone} from the DNC list`}>
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {confirmingClearAll && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }} role="dialog" aria-label="Remove all numbers">
            <div className="modal-header">
              <span className="modal-title">Remove all numbers?</span>
              <button className="icon-btn" onClick={() => setConfirmingClearAll(false)} aria-label="Close" disabled={clearingAll}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="dnc-clear-warning">
                <AlertTriangle size={18} />
                <p>
                  This deletes all <strong>{total.toLocaleString()}</strong> number{total === 1 ? '' : 's'} on the{' '}
                  <strong>{selectedCampaignName}</strong> DNC list. Agents will no longer be warned about any of them. This cannot be undone.
                </p>
              </div>
              {clearAllError && <div className="error-alert" role="alert">{clearAllError}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmingClearAll(false)} disabled={clearingAll}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleClearAll} disabled={clearingAll}>
                {clearingAll ? 'Removing…' : 'Remove All'}
              </button>
            </div>
          </div>
        </div>
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
        .dnc-header-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .dnc-bulk-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 1rem; margin: 0 0 0.75rem; background: var(--accent-light); border: 1px solid var(--accent); border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; color: var(--accent); }
        .dnc-bulk-bar .btn:first-of-type { margin-left: auto; }
        .dnc-clear-warning { display: flex; gap: 0.6rem; align-items: flex-start; color: var(--status-error); }
        .dnc-clear-warning p { color: var(--text-main); font-size: 0.88rem; line-height: 1.5; margin: 0; }
        .dnc-clear-warning svg { flex-shrink: 0; margin-top: 0.15rem; }
        .dnc-search { display: flex; align-items: center; gap: 0.4rem; color: var(--text-subtle); }
        .dnc-search .form-input { width: 210px; }
        .dnc-row-actions { display: flex; gap: 0.35rem; }
        .dnc-cell-input { min-width: 150px; padding: 0.3rem 0.5rem; font-size: 0.82rem; }
        .dnc-fields { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
        .dnc-field { display: inline-flex; align-items: baseline; gap: 0.3rem; max-width: 210px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 9999px; padding: 0.1rem 0.5rem; font-size: 0.72rem; }
        .dnc-field-key { color: var(--text-subtle); font-weight: 700; text-transform: capitalize; }
        .dnc-field-more { color: var(--text-subtle); font-style: italic; }
      `}</style>
    </div>
  );
}
