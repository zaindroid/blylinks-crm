import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';

const EMPTY_FORM = {
  saleDate: new Date().toISOString().slice(0, 10),
  customerName: '',
  address: '',
  apt: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  phone2: '',
  email: '',
  supplierName: '',
  electricUtility: '',
  electricAccountType: '',
  electricAccountNumber: '',
  electricRate: '',
  gasUtility: '',
  gasAccountType: '',
  gasAccountNumber: '',
  confirmationNumber: '',
  amount: '',
  agentNotes: ''
};

function TextField({ label, field, formData, setFormData, required, type = 'text', placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      <input
        type={type}
        className="form-input"
        placeholder={placeholder}
        value={formData[field]}
        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
        required={required}
      />
    </div>
  );
}

export default function SaleSubmissionModal({
  isOpen,
  onClose,
  projects,
  selectedCampaignId,
  currentUser,
  onSubmitSale
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.phone || !formData.amount) {
      setError('Please fill in all required fields (Name, Phone 1, Amount).');
      return;
    }

    onSubmitSale({
      ...formData,
      amount: Number(formData.amount)
    });
    setFormData(EMPTY_FORM);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content sale-submission-modal">
        <div className="modal-header">
          <div className="modal-title flex-align">
            <DollarSign className="text-cyan" size={20} />
            <span>Submit New Order</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body sale-submission-body">
            {error && (
              <div className="error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="sale-form-section-title">Customer Info</div>
            <div className="grid-2">
              <TextField label="Date" field="saleDate" type="date" formData={formData} setFormData={setFormData} required />
              <TextField label="Name" field="customerName" formData={formData} setFormData={setFormData} required placeholder="e.g. Johnathan Sterling" />
            </div>
            <div className="grid-2">
              <TextField label="Address" field="address" formData={formData} setFormData={setFormData} placeholder="Street address" />
              <TextField label="APT" field="apt" formData={formData} setFormData={setFormData} placeholder="Unit / Apt #" />
            </div>
            <div className="grid-3">
              <TextField label="City" field="city" formData={formData} setFormData={setFormData} />
              <TextField label="State" field="state" formData={formData} setFormData={setFormData} />
              <TextField label="Zip Code" field="zipCode" formData={formData} setFormData={setFormData} />
            </div>
            <div className="grid-2">
              <TextField label="Phone 1" field="phone" formData={formData} setFormData={setFormData} required placeholder="+1 (555) 000-0000" />
              <TextField label="Phone 2" field="phone2" formData={formData} setFormData={setFormData} placeholder="Optional" />
            </div>
            <div className="grid-2">
              <TextField label="Email" field="email" type="email" formData={formData} setFormData={setFormData} placeholder="customer@email.com" />
              <div className="form-group">
                <label className="form-label">Campaign / Project *</label>
                <input className="form-input" value={projects.find(p => p.id === selectedCampaignId)?.name || ''} disabled />
              </div>
            </div>

            <div className="sale-form-section-title">Order Info</div>
            <div className="grid-2">
              <TextField label="Supplier Name" field="supplierName" formData={formData} setFormData={setFormData} />
              <TextField label="Confirmation Number" field="confirmationNumber" formData={formData} setFormData={setFormData} />
            </div>
            <div className="grid-2">
              <TextField label="Sale Amount ($ USD)" field="amount" type="number" formData={formData} setFormData={setFormData} required placeholder="e.g. 2500" />
              <div className="form-group">
                <label className="form-label">Agent Name</label>
                <input className="form-input" value={currentUser.name} disabled />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <input className="form-input" value="Pending" disabled />
              </div>
            </div>

            <div className="sale-form-section-title">Electric</div>
            <div className="grid-2">
              <TextField label="Electric Utility" field="electricUtility" formData={formData} setFormData={setFormData} />
              <TextField label="Electric Account Number Type" field="electricAccountType" formData={formData} setFormData={setFormData} />
            </div>
            <div className="grid-2">
              <TextField label="Electric Account Number" field="electricAccountNumber" formData={formData} setFormData={setFormData} />
              <TextField label="Electric Rates" field="electricRate" formData={formData} setFormData={setFormData} />
            </div>

            <div className="sale-form-section-title">Gas</div>
            <div className="grid-2">
              <TextField label="Gas Utility" field="gasUtility" formData={formData} setFormData={setFormData} />
              <TextField label="Gas Account Number Type" field="gasAccountType" formData={formData} setFormData={setFormData} />
            </div>
            <TextField label="Gas Account Number" field="gasAccountNumber" formData={formData} setFormData={setFormData} />

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="Package terms agreed by customer, billing address confirmation, or special notes for review..."
                value={formData.agentNotes}
                onChange={(e) => setFormData({ ...formData, agentNotes: e.target.value })}
              ></textarea>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} /> Submit Order
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .sale-submission-modal { max-width: 640px; }
        .sale-submission-body { max-height: 65vh; overflow-y: auto; }
        .sale-form-section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-subtle); margin: 1rem 0 0.5rem; }
        .sale-form-section-title:first-child { margin-top: 0; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 1rem; }
      `}</style>
    </div>
  );
}
