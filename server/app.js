const express = require('express');
const path = require('path');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');
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
const kbRoutes = require('./routes/kb.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const adminRoutes = require('./routes/admin.routes');

function buildApp() {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Platform-required endpoints — no auth, /health never touches the DB.
  app.use(healthRoutes);
  app.get('/openapi.json', (req, res) => res.json(openapiSpec));

  app.use('/api/auth', authRoutes);

  app.use('/api/users', requireAuth, usersRoutes);
  app.use('/api/campaigns', requireAuth, campaignsRoutes);
  app.use('/api/sales', requireAuth, salesRoutes);
  app.use('/api/attendance', requireAuth, attendanceRoutes);
  app.use('/api/targets', requireAuth, targetsRoutes);
  app.use('/api/callbacks', requireAuth, callbacksRoutes);
  app.use('/api/leads', requireAuth, leadsRoutes);
  app.use('/api/payroll', requireAuth, payrollRoutes);
  app.use('/api/messages', requireAuth, messagesRoutes);
  app.use('/api/kb-articles', requireAuth, kbRoutes);
  app.use('/api/tickets', requireAuth, ticketsRoutes);
  app.use('/api/admin', requireAuth, adminRoutes);

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
