import React, { useState, useEffect } from 'react';
import { User, Lock, CheckCircle, ArrowRight, X } from 'lucide-react';
import { login, bootstrapFirstAdmin, checkBootstrapStatus } from '../../api/auth';

const LOGO_SRC = '/blylinks-logo.png';

export default function AuthModal({ isOpen, onClose, onAuthenticated, closable = true }) {
  const [needsBootstrap, setNeedsBootstrap] = useState(null); // null while checking
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [bootstrapData, setBootstrapData] = useState({ name: '', username: '', password: '' });

  useEffect(() => {
    if (!isOpen) return;
    checkBootstrapStatus()
      .then(({ needsBootstrap }) => setNeedsBootstrap(needsBootstrap))
      .catch(() => setNeedsBootstrap(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(username, password);
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapSubmit = async (e) => {
    e.preventDefault();
    if (!bootstrapData.name || !bootstrapData.username || !bootstrapData.password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const user = await bootstrapFirstAdmin(bootstrapData);
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not set up the organization.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div className="flex-align">
            <img src={LOGO_SRC} alt="Blylinks" className="auth-modal-logo" />
            <span className="modal-title">Blylinks Operations Portal — {needsBootstrap ? 'Set Up Your Organization' : 'Account Login'}</span>
          </div>
          {closable && <button className="icon-btn" onClick={onClose}><X size={18} /></button>}
        </div>

        <div className="modal-body">
          {error && <div className="error-alert">{error}</div>}

          {needsBootstrap === null ? (
            <div className="auth-loading">Checking portal status…</div>
          ) : needsBootstrap ? (
            <form onSubmit={handleBootstrapSubmit}>
              <p className="auth-bootstrap-note">No account exists yet. Create the first Admin account to set up this workspace.</p>

              <div className="form-group">
                <label className="form-label flex-align"><User size={13} /> Your Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Full name"
                  value={bootstrapData.name}
                  onChange={e => setBootstrapData({ ...bootstrapData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><User size={13} /> Username *</label>
                <input
                  type="text"
                  className="form-input"
                  value={bootstrapData.username}
                  onChange={e => setBootstrapData({ ...bootstrapData, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><Lock size={13} /> Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={bootstrapData.password}
                  onChange={e => setBootstrapData({ ...bootstrapData, password: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                Create Organization & Sign In <CheckCircle size={15} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label flex-align"><User size={13} /> Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><Lock size={13} /> Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                Sign In To Portal <ArrowRight size={15} />
              </button>

              <p className="auth-bootstrap-note margin-top">Don't have an account? Ask your Admin or Supervisor to add you from the Team screen.</p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .btn-block { width: 100%; }
        .auth-modal-logo { width: 22px; height: 22px; object-fit: contain; }
        .auth-bootstrap-note { font-size: 0.775rem; color: var(--text-subtle); text-align: center; margin: 0 0 0.75rem; }
        .auth-loading { font-size: 0.85rem; color: var(--text-subtle); text-align: center; padding: 1rem 0; }
      `}</style>
    </div>
  );
}
