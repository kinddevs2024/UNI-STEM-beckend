/**
 * Rate Limiting Service
 * 
 * Server-side rate limiting for API endpoints and WebSocket events.
 * Tracks requests per attemptId, userId, and IP address.
 */

// Rate limit configurations (requests per time window)
const RATE_LIMITS = {
  '/answer': { windowMs: 60000, maxRequests: 10 }, // 10 per minute
  '/skip': { windowMs: 60000, maxRequests: 5 }, // 5 per minute
  '/heartbeat': { windowMs: 10000, maxRequests: 5 }, // 5 per 10 seconds
  'websocket': { windowMs: 10000, maxRequests: 10 } // 10 per 10 seconds
};

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map();

/**
 * Generate rate limit key
 * @param {String} type - Rate limit type (endpoint or 'websocket')
 * @param {String} attemptId - Attempt ID
 * @param {String} userId - User ID
 * @param {String} ip - IP address
 * @returns {String} - Rate limit key
 */
function generateRateLimitKey(type, attemptId, userId, ip) {
  return `${type}:${attemptId}:${userId}:${ip}`;
}

/**
 * Clean expired entries from rate limit store
 */
function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean expired entries every 5 minutes
setInterval(cleanExpiredEntries, 5 * 60 * 1000);

/**
 * Check if request exceeds rate limit
 * @param {String} endpoint - Endpoint path (e.g., '/answer', '/skip', '/heartbeat')
 * @param {String} attemptId - Attempt ID
 * @param {String} userId - User ID
 * @param {String} ip - IP address
 * @returns {Object} - { allowed, remaining, resetAt, limit }
 */
export function checkRateLimit(endpoint, attemptId, userId, ip) {
  const config = RATE_LIMITS[endpoint];
  if (!config) {
    // No rate limit configured for this endpoint
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity
    };
  }

  const key = generateRateLimitKey(endpoint, attemptId, userId, ip);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Clean expired entries periodically
  if (Math.random() < 0.01) { // 1% chance on each request
    cleanExpiredEntries();
  }

  // Get or create entry
  let entry = rateLimitStore.get(key);
  if (!entry || entry.expiresAt < now) {
    // Create new entry
    entry = {
      requests: [],
      expiresAt: now + config.windowMs
    };
    rateLimitStore.set(key, entry);
  }

  // Filter out requests outside the time window
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

  // Check if limit exceeded
  const requestCount = entry.requests.length;
  const allowed = requestCount < config.maxRequests;

  if (allowed) {
    // Add current request
    entry.requests.push(now);
    rateLimitStore.set(key, entry);
  }

  // Calculate remaining requests and reset time
  const remaining = Math.max(0, config.maxRequests - requestCount - (allowed ? 1 : 0));
  const resetAt = new Date(now + config.windowMs);

  return {
    allowed,
    remaining,
    limit: config.maxRequests,
    resetAt: resetAt.toISOString()
  };
}

/**
 * Middleware for rate limiting (for API routes)
 * @param {String} endpoint - Endpoint identifier
 * @returns {Function} - Express middleware
 */
export function rateLimitMiddleware(endpoint) {
  return async (req, res, next) => {
    try {
      const attemptId = req.query?.attemptId || req.body?.attemptId || req.attempt?._id?.toString();
      const userId = req.user?._id?.toString();
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                 req.headers['x-real-ip'] ||
                 req.connection?.remoteAddress ||
                 req.socket?.remoteAddress ||
                 'unknown';

      if (!attemptId || !userId) {
        // If no attempt/user context, allow (let endpoint handle auth)
        return next();
      }

      const result = checkRateLimit(endpoint, attemptId, userId, ip);

      if (!result.allowed) {
        // Add violation to attempt if exists
        if (req.attempt) {
          req.attempt.violations.push({
            type: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date(),
            details: {
              endpoint,
              limit: result.limit,
              ip
            }
          });
          await req.attempt.save();
        }

        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.resetAt
        });
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // On error, allow request (fail open for availability, but log error)
      next();
    }
  };
}

/**
 * Check rate limit for WebSocket events
 * @param {String} eventType - WebSocket event type
 * @param {String} attemptId - Attempt ID
 * @param {String} userId - User ID
 * @param {String} socketId - Socket ID (used as IP proxy)
 * @returns {Object} - { allowed, remaining, resetAt, limit }
 */
export function checkWebSocketRateLimit(eventType, attemptId, userId, socketId) {
  // Use socketId as IP proxy for WebSocket connections
  return checkRateLimit('websocket', attemptId, userId, socketId);
}
