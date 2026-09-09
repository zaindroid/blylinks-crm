const jwt = require('jsonwebtoken');
const config = require('../config');
const { findAuthInfoById } = require('../db/usersRepo');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // A valid signature only proves the token was legitimately issued at some
  // point -- it says nothing about whether that account still exists or is
  // still Active *now*. Without this check, removing someone from the team
  // (or deactivating them) has no real effect until their token happens to
  // expire naturally (up to 12h later): they keep full access in the
  // meantime. Re-checked on every request, and role is taken from this fresh
  // row rather than the token's (point-in-time) claim, so a role change also
  // takes effect immediately rather than waiting for re-login.
  const current = await findAuthInfoById(payload.sub);
  if (!current || current.status !== 'Active') {
    return res.status(401).json({ error: 'This account is no longer active' });
  }

  req.user = { id: current.id, role: current.role, mustChangePassword: current.must_change_password === true };
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// After an admin/supervisor-mediated password reset, the account is flagged
// must_change_password so the temp password only works long enough to be
// replaced. Enforced here, not just as a frontend nudge -- a temp password
// leaking (verbally relayed, written down) shouldn't grant full standing
// access just because the client-side UI happens to show a modal. Mounted
// on every protected route except the change-password endpoint itself,
// which is the one thing this state must still allow through.
function blockIfMustChangePassword(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: 'You must set a new password before continuing', mustChangePassword: true });
  }
  next();
}

module.exports = { requireAuth, requireRole, blockIfMustChangePassword };
