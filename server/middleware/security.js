const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config');

// The app is a same-origin SPA+API that leans heavily on inline <style> blocks
// per component (an established pattern throughout this codebase) and loads
// Google Fonts + a couple of external avatar/logo image hosts -- a stock
// "no unsafe-inline" CSP would break every page. This CSP is scoped to what
// the app actually uses instead of disabling it outright.
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://blylinks.com'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
});

// Tests fire many rapid requests against a shared in-memory limiter and don't
// need this protection anyway -- keep it out of the way there.
const disabledInTest = config.appEnv === 'test';

function makeLimiter(options) {
  if (disabledInTest) {
    return (req, res, next) => next();
  }
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    ...options
  });
}

// Unauthenticated by definition (this is what proves who you are), so this one
// has to key on IP. Call-center agents on the same office network often share
// one public IP behind NAT, and everyone tends to clock in around the same
// shift-start minute -- 30/15min per IP is still a poor brute-force rate
// (especially stacked with bcrypt's own cost) while leaving headroom for a
// login rush from a shared office connection.
const authLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });

// Mounted *after* requireAuth on every protected route group, so req.user is
// already populated -- keying on user id (not IP) means agents sharing an
// office IP never share a bucket, and it isolates one runaway browser tab from
// affecting the same user's other tabs' budget only, not everyone else's.
// The app's own background sync (App.jsx) plus the messenger widget's polling
// account for ~70-200 req/min per active tab at 8s intervals; this ceiling is
// sized to comfortably clear several simultaneous tabs per user while still
// catching a genuinely broken retry loop or scripted abuse.
const apiLimiter = makeLimiter({
  windowMs: 60 * 1000,
  limit: 400,
  // ipKeyGenerator normalizes IPv6 addresses so equivalent addresses can't be
  // used to dodge the per-key bucket -- only relevant for the unauthenticated
  // fallback, since authenticated requests key on the (unambiguous) user id.
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip)
});

module.exports = { helmetMiddleware, authLimiter, apiLimiter };
