import React, { useState } from 'react';
import { User, Mail, Lock, Phone, CreditCard, Clock, CheckCircle, ArrowRight, X } from 'lucide-react';
import { login, register } from '../../api/auth';

const LOGO_SRC = '/blylinks-logo.png';

export default function AuthModal({ isOpen, onClose, onAuthenticated, closable = true }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Registration Form Data
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    cnic: '',
    shift: '08:00 AM - 04:00 PM'
  });

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regData.name || !regData.email || !regData.password || !regData.phone) {
      setError('Please fill in all required onboarding fields.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const user = await register(regData);
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not complete registration.');
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
            <span className="modal-title">Blylinks Portal — {mode === 'login' ? 'Account Login' : 'Create Account'}</span>
          </div>
          {closable && <button className="icon-btn" onClick={onClose}><X size={18} /></button>}
        </div>

        <div className="modal-body">
          {error && <div className="error-alert">{error}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label flex-align"><Mail size={13} /> Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@blylinks.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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

              <button type="submit" className="btn btn-primary btn-block margin-bottom" disabled={submitting}>
                Sign In To Portal <ArrowRight size={15} />
              </button>

              <div className="auth-switch-text">
                New here? <button type="button" className="text-btn font-bold" onClick={() => { setMode('register'); setError(''); }}>Create an Account</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label className="form-label flex-align"><User size={13} /> Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Muhammad Ali"
                  value={regData.name}
                  onChange={e => setRegData({...regData, name: e.target.value})}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label flex-align"><Mail size={13} /> Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="agent@email.com"
                    value={regData.email}
                    onChange={e => setRegData({...regData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label flex-align"><Lock size={13} /> Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={regData.password}
                    onChange={e => setRegData({...regData, password: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label flex-align"><Phone size={13} /> Phone (+92) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="+92 300 0000000"
                    value={regData.phone}
                    onChange={e => setRegData({...regData, phone: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label flex-align"><CreditCard size={13} /> CNIC / National ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="42101-0000000-0"
                    value={regData.cnic}
                    onChange={e => setRegData({...regData, cnic: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label flex-align"><Clock size={13} /> Preferred Shift</label>
                <select
                  className="form-select"
                  value={regData.shift}
                  onChange={e => setRegData({...regData, shift: e.target.value})}
                >
                  <option value="08:00 AM - 04:00 PM">Morning Shift (08:00 AM - 04:00 PM)</option>
                  <option value="04:00 PM - 12:00 AM">Evening Shift (04:00 PM - 12:00 AM)</option>
                  <option value="09:00 PM - 05:00 AM">Night Shift (09:00 PM - 05:00 AM)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary btn-block margin-bottom" disabled={submitting}>
                Create Account & Enter Portal <CheckCircle size={15} />
              </button>

              <div className="auth-switch-text">
                Already registered? <button type="button" className="text-btn font-bold" onClick={() => { setMode('login'); setError(''); }}>Sign In</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .btn-block { width: 100%; }
        .auth-modal-logo { width: 22px; height: 22px; object-fit: contain; }
        .auth-switch-text { font-size: 0.775rem; color: var(--text-subtle); text-align: center; margin-top: 0.75rem; }
      `}</style>
    </div>
  );
}
