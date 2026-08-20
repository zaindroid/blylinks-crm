const { Pool } = require('pg');
const config = require('../config');
const logger = require('../logger');

const pool = new Pool({ connectionString: config.databaseUrl });

// Without this, an idle client erroring out (e.g. a transient DB blip) is an
// unhandled 'error' event and crashes the whole process -- including /health.
pool.on('error', (err) => {
  logger.error({ err }, 'idle postgres client error');
});

module.exports = pool;
