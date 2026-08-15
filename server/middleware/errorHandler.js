function errorHandler(err, req, res, next) {
  req.log?.error({ err }, 'request failed');
  const status = err.status || 500;
  res.status(status).json({ error: err.publicMessage || 'Internal server error' });
}

module.exports = errorHandler;
