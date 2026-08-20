const config = require('./config');
const logger = require('./logger');
const migrate = require('./db/migrate');
const buildApp = require('./app');
const pool = require('./db/pool');

async function main() {
  await migrate();

  const app = buildApp();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, appEnv: config.appEnv }, 'blylinks-crm server listening');
  });

  // Coolify sends SIGTERM before killing the container on every redeploy --
  // without this, in-flight requests get cut off mid-response and the pg
  // pool's sockets are torn down uncleanly instead of closed.
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down gracefully');

    const forceExitTimer = setTimeout(() => {
      logger.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async (err) => {
      if (err) logger.error({ err }, 'error while closing http server');
      try {
        await pool.end();
      } catch (poolErr) {
        logger.error({ err: poolErr }, 'error while closing database pool');
      }
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
  logger.error({ err }, 'failed to start server');
  process.exit(1);
});
