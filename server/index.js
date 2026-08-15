const config = require('./config');
const logger = require('./logger');
const migrate = require('./db/migrate');
const buildApp = require('./app');

async function main() {
  await migrate();

  const app = buildApp();
  app.listen(config.port, () => {
    logger.info({ port: config.port, appEnv: config.appEnv }, 'blylinks-crm server listening');
  });
}

main().catch(err => {
  logger.error({ err }, 'failed to start server');
  process.exit(1);
});
