import React, { useState } from 'react';
import { Lock, X, CheckCircle } from 'lucide-react';
import { changePassword } from '../../api/auth';

export default function ChangePasswordModal({ onClose, mandatory = false, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Could not change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <span className="modal-title flex-align"><Lock size={16} /> {mandatory ? 'Set a New Password' : 'Change Password'}</span>
          {!mandatory && <button className="icon-btn" onClick={onClose}><X size={18} /></button>}
        </div>

        {mandatory && !success && (
          <div className="mandatory-pw-notice">
            You're signing in with a temporary password. Set a new one to continue.
          </div>
        )}

        {success ? (
          <div className="modal-body">
            <div className="success-alert flex-align">
              <CheckCircle size={16} /> Password updated successfully.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="error-alert">{error}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="current-password-input">Current Password *</label>
                <input
                  id="current-password-input"
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password-input">New Password *</label>
                <input
                  id="new-password-input"
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password-input">Confirm New Password *</label>
                <input
                  id="confirm-password-input"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="modal-footer">
              {!mandatory && <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .success-alert { background: var(--status-success-bg); border: 1px solid var(--status-success-border); color: var(--status-success); padding: 0.6rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; gap: 0.5rem; }
        .mandatory-pw-notice { font-size: 0.8rem; color: var(--text-muted); padding: 0 1.25rem 0.5rem; line-height: 1.5; }
      `}</style>
    </div>
  );
}
