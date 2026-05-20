// Logger Middleware - Log all requests

const logger = (req, res, next) => {
  // Skip noisy high-frequency GETs for dashboards
  if (req.method === 'GET' && (req.url.startsWith('/api/bays') || req.url.startsWith('/api/technicians'))) {
    return next();
  }
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
};

module.exports = logger;
