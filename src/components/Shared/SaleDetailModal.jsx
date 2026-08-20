import React from 'react';
import { X, FileText } from 'lucide-react';
import { formatPKR } from '../../utils/currency';

function Field({ label, value }) {
  return (
    <div className="sale-detail-field">
      <div className="sale-detail-label">{label}</div>
      <div className="sale-detail-value">{value || '—'}</div>
    </div>
  );
}

export default function SaleDetailModal({ sale, onClose }) {
  if (!sale) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title flex-align"><FileText size={18} className="text-cyan" /> Order Details — {sale.id}</div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body sale-detail-body">
          <div className="sale-detail-section-title">Customer Info</div>
          <div className="sale-detail-grid">
            <Field label="Date" value={sale.date} />
            <Field label="Status" value={sale.status} />
            <Field label="Name" value={sale.customerName} />
            <Field label="Agent" value={sale.agentName} />
            <Field label="Phone 1" value={sale.phone} />
            <Field label="Phone 2" value={sale.phone2} />
            <Field label="Email" value={sale.email} />
            <Field label="Campaign" value={sale.projectName} />
          </div>

          <div className="sale-detail-section-title">Address</div>
          <div className="sale-detail-grid">
            <Field label="Address" value={sale.address} />
            <Field label="APT" value={sale.apt} />
            <Field label="City" value={sale.city} />
            <Field label="State" value={sale.state} />
            <Field label="Zip Code" value={sale.zipCode} />
          </div>

          <div className="sale-detail-section-title">Order Info</div>
          <div className="sale-detail-grid">
            <Field label="Supplier Name" value={sale.supplierName} />
            <Field label="Confirmation Number" value={sale.confirmationNumber} />
            <Field label="Amount" value={formatPKR(sale.amount)} />
          </div>

          <div className="sale-detail-section-title">Electric</div>
          <div className="sale-detail-grid">
            <Field label="Utility" value={sale.electricUtility} />
            <Field label="Account Number Type" value={sale.electricAccountType} />
            <Field label="Account Number" value={sale.electricAccountNumber} />
            <Field label="Rate" value={sale.electricRate} />
          </div>

          <div className="sale-detail-section-title">Gas</div>
          <div className="sale-detail-grid">
            <Field label="Utility" value={sale.gasUtility} />
            <Field label="Account Number Type" value={sale.gasAccountType} />
            <Field label="Account Number" value={sale.gasAccountNumber} />
          </div>

          <div className="sale-detail-section-title">Notes</div>
          <div className="sale-detail-notes">{sale.agentNotes || '—'}</div>

          {sale.qaNotes && (
            <>
              <div className="sale-detail-section-title">Administrative Review Notes</div>
              <div className="sale-detail-notes">{sale.qaNotes}{sale.verifiedBy ? ` — ${sale.verifiedBy}` : ''}</div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{`
        .sale-detail-section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-subtle); margin: 1rem 0 0.5rem; }
        .sale-detail-section-title:first-child { margin-top: 0; }
        .sale-detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem 1rem; }
        .sale-detail-field { display: flex; flex-direction: column; gap: 2px; }
        .sale-detail-label { font-size: 0.65rem; color: var(--text-subtle); }
        .sale-detail-value { font-size: 0.825rem; font-weight: 600; color: var(--text-main); word-break: break-word; }
        .sale-detail-notes { font-size: 0.825rem; color: var(--text-main); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.6rem 0.75rem; }
      `}</style>
    </div>
  );
}
