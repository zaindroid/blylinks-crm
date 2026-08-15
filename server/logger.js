const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
    censor: '[REDACTED]'
  }
});

module.exports = logger;
