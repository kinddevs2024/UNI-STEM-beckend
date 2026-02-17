// API helper functions for Next.js API routes
import { handleCORS as handleStrictCORS } from './middleware/cors.js';

export function handleCORS(req, res) {
  return handleStrictCORS(req, res);
}

// Standard error response
export function sendError(res, status, message, error = null) {
  const response = { message };
  if (error && process.env.NODE_ENV === "development") {
    response.error = error.message || error;
  }
  return res.status(status).json(response);
}
