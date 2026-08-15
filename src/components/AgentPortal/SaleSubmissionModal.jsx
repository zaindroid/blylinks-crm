import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, FileText, DollarSign, User, Phone, Mail, Briefcase } from 'lucide-react';

export default function SaleSubmissionModal({ 
  isOpen, 
  onClose, 
  projects, 
  currentUser, 
  onSubmitSale 
}) {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    email: '',
    projectName: projects[0]?.name || 'US Solar Direct',
    amount: '',
    verificationRef: '',
    agentNotes: ''
  });

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.phone || !formData.amount) {
      setError('Please fill in all required fields (Customer Name, Phone, Sale Amount).');
      return;
    }

    const newSale = {
      id: `SALE-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: formData.customerName,
      phone: formData.phone,
      email: formData.email || 'N/A',
      projectName: formData.projectName,
      agentId: currentUser.id,
      agentName: currentUser.name,
      amount: Number(formData.amount),
      status: 'Pending', // Default status upon agent submission
      date: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
      agentNotes: formData.agentNotes || 'No notes provided.',
      qaNotes: '',
      verifiedBy: ''
    };

    onSubmitSale(newSale);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title flex-align">
            <DollarSign className="text-cyan" size={20} />
            <span>Submit New Sale Record</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label flex-align"><User size={14} /> Customer Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Johnathan Sterling"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><Phone size={14} /> Contact Phone *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label flex-align"><Mail size={14} /> Customer Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="customer@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><Briefcase size={14} /> Campaign / Project *</label>
                <select 
                  className="form-select"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                >
                  {projects.filter(p => p.status === 'Active').map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label flex-align"><DollarSign size={14} /> Sale Amount ($ USD) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 2500"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><FileText size={14} /> Audio / Recording Ref ID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. AUD-90421"
                  value={formData.verificationRef}
                  onChange={(e) => setFormData({ ...formData, verificationRef: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mandatory Agent Notes & Sale Details *</label>
              <textarea 
                className="form-textarea" 
                rows="3"
                placeholder="Include package terms agreed by customer, billing address confirmation, or special notes for QA review..."
                value={formData.agentNotes}
                onChange={(e) => setFormData({ ...formData, agentNotes: e.target.value })}
              ></textarea>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} /> Submit To QA Queue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
