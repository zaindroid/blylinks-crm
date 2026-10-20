import React, { useState } from 'react';
import { X, Pencil } from 'lucide-react';

const TEXT_FIELDS = [
  ['customerName', 'Name'],
  ['phone', 'Phone 1'],
  ['phone2', 'Phone 2'],
  ['email', 'Email'],
  ['address', 'Address'],
  ['apt', 'APT'],
  ['city', 'City'],
  ['state', 'State'],
  ['zipCode', 'Zip Code'],
  ['supplierName', 'Supplier Name'],
  ['confirmationNumber', 'Confirmation Number'],
  ['electricUtility', 'Electric Utility'],
  ['electricAccountType', 'Electric Account Type'],
  ['electricAccountNumber', 'Electric Account Number'],
  ['electricRate', 'Electric Rate'],
  ['gasUtility', 'Gas Utility'],
  ['gasAccountType', 'Gas Account Type'],
  ['gasAccountNumber', 'Gas Account Number']
];

export default function SaleEditModal({ sale, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const initial = { status: sale.status, amount: sale.amount, agentNotes: sale.agentNotes || '' };
    for (const [key] of TEXT_FIELDS) initial[key] = sale[key] || '';
    return initial;
  });
  const [error, setError] = useState('');

  if (!sale) return null;

  const setFieldValue = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Amount must be a non-negative number.');
      return;
    }
    onSave(sale.id, { ...form, amount });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title flex-align"><Pencil size={18} className="text-cyan" /> Edit Sale — {sale.id}</div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body sale-edit-body">
            {error && <div className="form-error margin-bottom">{error}</div>}

            <div className="sale-detail-section-title">Status</div>
            <div className="sale-edit-grid margin-bottom">
              <div className="form-group">
                <label className="form-label">Sale Status</label>
                <select className="form-select" aria-label="Sale Status" value={form.status} onChange={(e) => setFieldValue('status', e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  value={form.amount}
                  onChange={(e) => setFieldValue('amount', e.target.value)}
                />
              </div>
            </div>

            <div className="sale-detail-section-title">Order Details</div>
            <div className="sale-edit-grid margin-bottom">
              {TEXT_FIELDS.map(([key, label]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form[key]}
                    onChange={(e) => setFieldValue(key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="sale-detail-section-title">Agent Notes</div>
            <div className="form-group">
              <textarea
                className="form-textarea"
                rows="3"
                value={form.agentNotes}
                onChange={(e) => setFieldValue('agentNotes', e.target.value)}
              ></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>

      <style>{`
        .sale-detail-section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-subtle); margin: 1rem 0 0.5rem; }
        .sale-detail-section-title:first-child { margin-top: 0; }
        .sale-edit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem 1rem; }
        .sale-edit-body { max-height: 70vh; overflow-y: auto; }
        .form-error { color: var(--color-danger, #e5484d); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
