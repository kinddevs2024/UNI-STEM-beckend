// CORS middleware helper for Next.js API routes
export function handleCORS(req, res) {
  const origin = req.headers.origin || '*';

  function setCorsHeaders() {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Vary', 'Origin');
  }

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    setCorsHeaders();
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
    return true;
  }

  // Set CORS headers for all actual requests
  setCorsHeaders();

  return false;
}

