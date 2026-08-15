function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  appEnv: process.env.APP_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = config;
