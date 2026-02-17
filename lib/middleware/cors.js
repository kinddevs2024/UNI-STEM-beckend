// CORS middleware helper for Next.js API routes
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

function toOrigin(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseForwardedProto(req) {
  const forwarded = req.headers['x-forwarded-proto'];
  if (!forwarded || typeof forwarded !== 'string') {
    return process.env.NODE_ENV === 'production' ? 'https' : 'http';
  }
  return forwarded.split(',')[0].trim() || 'http';
}

function getAllowedOrigins(req) {
  const allowed = new Set();

  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => toOrigin(entry.trim()))
    .filter(Boolean);

  configured.forEach((entry) => allowed.add(entry));

  const frontendOrigin = toOrigin(process.env.FRONTEND_URL);
  if (frontendOrigin) {
    allowed.add(frontendOrigin);
  }

  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (forwardedHost && typeof forwardedHost === 'string') {
    const serverOrigin = `${parseForwardedProto(req)}://${forwardedHost}`;
    const normalized = toOrigin(serverOrigin);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    DEV_ORIGINS.forEach((origin) => allowed.add(origin));
  }

  return [...allowed];
}

export function handleCORS(req, res) {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins(req);
  const originAllowed =
    !requestOrigin ||
    allowedOrigins.includes('*') ||
    allowedOrigins.includes(requestOrigin);

  if (!originAllowed) {
    if (req.method === 'OPTIONS') {
      res.status(403).end();
      return true;
    }
    res.status(403).json({ message: 'CORS origin denied' });
    return true;
  }

  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return true;
  }

  return false;
}

