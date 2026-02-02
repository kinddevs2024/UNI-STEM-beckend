// API helper functions for Next.js API routes

// CORS: allow listed origins; fall back to the known frontend and local dev
const defaultFrontend =
  process.env.FRONTEND_URL || "https://global-olimpiad-v2-2.vercel.app";
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [defaultFrontend, "http://localhost:5173", "http://localhost:3000"];

function getAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return allowedOrigins[0] || "*";
  if (allowedOrigins.includes("*")) return origin;
  if (allowedOrigins.includes(origin)) return origin;
  return null;
}

// Handle CORS - strict origins in production
export function handleCORS(req, res) {
  const origin = getAllowedOrigin(req);
  const originAllowed = !req.headers.origin || Boolean(origin);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    if (!originAllowed) {
      res.status(403).json({ message: "CORS origin not allowed" });
      return true;
    }

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
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
    res.status(200).end();
    return true;
  }

  // Set CORS headers for actual requests
  if (originAllowed) {
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
    res.setHeader("Vary", "Origin");
  }

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
