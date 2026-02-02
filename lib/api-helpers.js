// API helper functions for Next.js API routes

// CORS: strict origins in production; allow all in dev if not set
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : process.env.NODE_ENV === "production"
    ? ["http://localhost:5173", "http://localhost:3000"]
    : ["*"];

function getAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return allowedOrigins[0] || "*";
  if (allowedOrigins.includes("*")) return origin;
  if (allowedOrigins.includes(origin)) return origin;
  return allowedOrigins[0] || null;
}

// Handle CORS - strict origins in production
export function handleCORS(req, res) {
  const origin = getAllowedOrigin(req);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
    res.status(200).end();
    return true;
  }

  // Set CORS headers for actual requests
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  return false;
}

// Standard error response
export function sendError(res, status, message, error = null) {
  const response = { message };
  if (error && process.env.NODE_ENV === "development") {
    response.error = error.message || error;
  }
  return res.status(status).json(response);
}
