const express = require('express');
const path = require('path');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth, blockIfMustChangePassword } = require('./middleware/auth');
const { helmetMiddleware, authLimiter, apiLimiter } = require('./middleware/security');
const healthRoutes = require('./routes/health');
const openapiSpec = require('./openapi.json');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const salesRoutes = require('./routes/sales.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const targetsRoutes = require('./routes/targets.routes');
const callbacksRoutes = require('./routes/callbacks.routes');
const leadsRoutes = require('./routes/leads.routes');
const payrollRoutes = require('./routes/payroll.routes');
const messagesRoutes = require('./routes/messages.routes');
const messageGroupsRoutes = require('./routes/messageGroups.routes');
const kbRoutes = require('./routes/kb.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const adminRoutes = require('./routes/admin.routes');

function buildApp() {
  const app = express();

  // Required for correct client IPs (and therefore correct rate limiting) behind
  // Coolify/Traefik + Cloudflare -- without this, express-rate-limit and req.ip
  // would see the proxy's IP for every request, not the real caller's. (A
  // second, independent security pass on origin/main added its own inline
  // helmet() config here without this -- folded into server/middleware/security.js
  // instead, which also adds img-src/connect-src/script-src the inline version
  // didn't need to cover yet.)
  app.set('trust proxy', 1);

  app.use(helmetMiddleware);
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Platform-required endpoints — no auth, /health never touches the DB.
  app.use(healthRoutes);
  app.get('/openapi.json', (req, res) => res.json(openapiSpec));

  app.use('/api/auth', authLimiter, authRoutes);

  app.use('/api/users', requireAuth, blockIfMustChangePassword, apiLimiter, usersRoutes);
  app.use('/api/campaigns', requireAuth, blockIfMustChangePassword, apiLimiter, campaignsRoutes);
  app.use('/api/sales', requireAuth, blockIfMustChangePassword, apiLimiter, salesRoutes);
  app.use('/api/attendance', requireAuth, blockIfMustChangePassword, apiLimiter, attendanceRoutes);
  app.use('/api/targets', requireAuth, blockIfMustChangePassword, apiLimiter, targetsRoutes);
  app.use('/api/callbacks', requireAuth, blockIfMustChangePassword, apiLimiter, callbacksRoutes);
  app.use('/api/leads', requireAuth, blockIfMustChangePassword, apiLimiter, leadsRoutes);
  app.use('/api/payroll', requireAuth, blockIfMustChangePassword, apiLimiter, payrollRoutes);
  app.use('/api/messages', requireAuth, blockIfMustChangePassword, apiLimiter, messagesRoutes);
  app.use('/api/message-groups', requireAuth, blockIfMustChangePassword, apiLimiter, messageGroupsRoutes);
  app.use('/api/kb-articles', requireAuth, blockIfMustChangePassword, apiLimiter, kbRoutes);
  app.use('/api/tickets', requireAuth, blockIfMustChangePassword, apiLimiter, ticketsRoutes);
  app.use('/api/admin', requireAuth, blockIfMustChangePassword, apiLimiter, adminRoutes);

  const distDir = path.join(__dirname, '..', 'dist');
  // Vite's built JS/CSS filenames are content-hashed, so they're safe to cache
  // forever -- a new deploy always produces new filenames. index.html is the
  // opposite: it must NEVER be cached, since it's the only thing that points
  // at the current hashes. Caching it causes browsers to keep loading a
  // deploy's old JS bundle indefinitely against the new API.
  app.use(express.static(distDir, { index: false, maxAge: '1y', immutable: true }));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distDir, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
