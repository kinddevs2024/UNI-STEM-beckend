// CORS middleware helper for Next.js API routes

// Get allowed origins from environment variable
function getAllowedOrigins() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:5173',
    'https://global-olimpiad-v2-2.vercel.app',
    'https://kinddevs2024-global-olimpiad-v2-2-b.vercel.app', // Backend URL (if needed)
  ];
  
  // Also support comma-separated list if provided
  if (process.env.ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    allowedOrigins.push(...additionalOrigins);
  }
  
  return allowedOrigins.filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
}

// Check if origin is allowed
function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

export function handleCORS(req, res) {
  const origin = req.headers.origin;
  const defaultOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  // Determine which origin to allow
  let allowedOrigin = defaultOrigin;
  if (origin && isOriginAllowed(origin)) {
    allowedOrigin = origin;
  }

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
    return true;
  }

  // Set CORS headers for actual requests
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  return false;
}

