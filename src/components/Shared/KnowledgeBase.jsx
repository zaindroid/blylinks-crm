import React, { useMemo, useRef, useState } from 'react';
import { Copy, Check, Search, FileText, Plus, Pencil, Trash2, X, Upload } from 'lucide-react';

const MAX_IMPORT_BYTES = 200 * 1024; // a text document, not a data dump
const EMPTY_FORM = { title: '', category: '', summary: '', content: '' };

function formatUpdated(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// `canManage` is true for Admins and Supervisors -- the server enforces it too; this just shows the controls.
export default function KnowledgeBase({ articles = [], canManage = false, onCreateArticle, onUpdateArticle, onDeleteArticle }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const [editing, setEditing] = useState(null); // null | 'new' | article
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const fileInputRef = useRef(null);

  const term = searchTerm.toLowerCase();
  const filteredArticles = articles.filter(a =>
    (a.title || '').toLowerCase().includes(term) ||
    (a.category || '').toLowerCase().includes(term) ||
    (a.content || '').toLowerCase().includes(term)
  );

  const categories = useMemo(() => [...new Set(articles.map(a => a.category).filter(Boolean))].sort(), [articles]);

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard access can be blocked; the text is still on screen to select manually.
    }
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setEditing('new');
  };

  const openEdit = (article) => {
    setForm({ title: article.title || '', category: article.category || '', summary: article.summary || '', content: article.content || '' });
    setFormError('');
    setEditing(article);
  };

  const closeForm = () => {
    setEditing(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setFormError(`That file is too large (limit ${MAX_IMPORT_BYTES / 1024} KB). Paste in the part you need instead.`);
      return;
    }
    try {
      const text = await file.text();
      setForm(f => ({
        ...f,
        content: text,
        // Name the document after the file if no title has been typed yet.
        title: f.title || file.name.replace(/\.[^.]+$/, '')
      }));
      setFormError('');
    } catch {
      setFormError('Could not read that file.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setFormError('Give the document a title.');
    if (!form.content.trim()) return setFormError('Add the document text, or import it from a file.');
    setSaving(true);
    setFormError('');
    try {
      const payload = { title: form.title, category: form.category, summary: form.summary, content: form.content };
      if (editing === 'new') await onCreateArticle(payload);
      else await onUpdateArticle(editing.id, payload);
      closeForm();
    } catch (err) {
      setFormError(err.message || 'Could not save the document.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await onDeleteArticle(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete the document.');
    }
  };

  return (
    <div className="knowledge-base-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Knowledge Base & BPO Sales Script Center</h1>
          <p className="page-subtitle">Access standardized sales calling scripts, objection handling frameworks, and compliance guidelines.</p>
        </div>
        {canManage && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Document</button>
          </div>
        )}
      </div>

      <div className="card margin-bottom">
        <div className="search-box" style={{ width: '100%' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search calling scripts, objection rebuttals or TCPA compliance rules..."
            aria-label="Search the knowledge base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="card kb-empty">
          <FileText size={28} className="text-subtle" />
          <div className="font-bold">No documents yet</div>
          <div className="text-sm text-muted">
            {canManage ? 'Use “Add Document” to publish the first script or guideline.' : 'Your Admin or Supervisor has not published any documents yet.'}
          </div>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="card kb-empty"><div className="text-muted">No documents match &ldquo;{searchTerm}&rdquo;.</div></div>
      ) : (
        <div className="grid-2">
          {filteredArticles.map(art => (
            <div key={art.id} className="card">
              <div className="card-header">
                <span className="card-title"><FileText size={18} className="text-cyan" /> {art.title}</span>
                <span className="badge badge-info">{art.category}</span>
              </div>

              <p className="text-muted text-sm margin-bottom">{art.summary}</p>

              <div className="script-content-box">
                <pre>{art.content}</pre>
              </div>

              <div className="margin-top flex-between">
                <span className="text-xs text-subtle">{art.updatedAt ? `Updated ${formatUpdated(art.updatedAt)}` : ''}</span>
                <div className="btn-group-sm">
                  {canManage && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(art)} aria-label={`Edit ${art.title}`}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { setDeleteError(''); setDeleting(art); }} aria-label={`Delete ${art.title}`}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(art.id, art.content)}>
                    {copiedId === art.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    {copiedId === art.id ? 'Copied Script!' : 'Copy Script Text'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }} role="dialog" aria-label={editing === 'new' ? 'Add document' : 'Edit document'}>
            <div className="modal-header">
              <span className="modal-title">{editing === 'new' ? 'Add Document' : `Edit — ${editing.title}`}</span>
              <button className="icon-btn" onClick={closeForm} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="kb-title">Title *</label>
                    <input id="kb-title" type="text" className="form-input" maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Objection: “It's too expensive”" autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kb-category">Category</label>
                    <input id="kb-category" type="text" list="kb-categories" className="form-input" maxLength={60} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Scripts, Compliance" />
                    <datalist id="kb-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="kb-summary">Short summary (optional)</label>
                  <input id="kb-summary" type="text" className="form-input" maxLength={500} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Shown under the title. Left blank, the start of the document is used." />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="kb-content">Document text *</label>
                  <textarea id="kb-content" className="form-textarea kb-textarea" rows={10} maxLength={50000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Paste or type the script, guideline or procedure…" />
                  <div className="kb-import">
                    <Upload size={14} />
                    <label htmlFor="kb-file" className="text-sm">Or import from a text file (.txt, .md):</label>
                    <input id="kb-file" ref={fileInputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={handleImportFile} />
                  </div>
                </div>

                {formError && <div className="error-alert" role="alert">{formError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Publish Document' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }} role="dialog" aria-label="Delete document">
            <div className="modal-header">
              <span className="modal-title">Delete document?</span>
              <button className="icon-btn" onClick={() => setDeleting(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>&ldquo;{deleting.title}&rdquo; will be removed for everyone. This cannot be undone.</p>
              {deleteError && <div className="error-alert" role="alert">{deleteError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .script-content-box {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          padding: 1rem;
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.825rem;
          color: var(--text-main);
          white-space: pre-wrap;
          line-height: 1.6;
          max-height: 360px;
          overflow-y: auto;
        }
        .kb-empty { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 2.5rem 1rem; text-align: center; }
        .kb-textarea { width: 100%; font-family: var(--font-body); resize: vertical; }
        .kb-import { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
