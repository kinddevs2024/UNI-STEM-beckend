// CORS middleware helper for Next.js API routes
export function handleCORS(req, res) {
  const origin = req.headers.origin;

  // Recommended: set FRONTEND_URL in environment to the exact frontend origin
  const defaultFrontend =
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : 'https://unistem.vercel.app');
  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : [defaultFrontend, 'http://localhost:5173', 'http://localhost:3000']),
  ];

  // Allow server-to-server requests (no Origin header)
  const originAllowed =
    !origin ||
    allowedOrigins.includes('*') ||
    allowedOrigins.includes(origin);

  function setCorsHeaders() {
    // If origin is undefined (server requests), use the default frontend as Access-Control-Allow-Origin
    res.setHeader('Access-Control-Allow-Origin', origin || defaultFrontend);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    // Ensure caches vary by Origin
    res.setHeader('Vary', 'Origin');
  }

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    if (!originAllowed) {
      // Explicitly reject preflight from disallowed origins
      res.status(403).json({ message: 'CORS origin not allowed' });
      return true;
    }

    setCorsHeaders();
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
    return true;
  }

  // Set CORS headers for actual requests if allowed
  if (originAllowed) {
    setCorsHeaders();
  }

  return false;
}

