import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { verifyToken } from './lib/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { networkInterfaces } from 'os';
import * as presenceStore from './lib/presence-store.js';
import { flushPresenceToMongo } from './lib/presence-flush.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file explicitly from multiple possible locations
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),           // Current working directory
  path.join(__dirname, '.env'),               // Same directory as server.js
  path.join(__dirname, '..', '.env'),         // Parent directory
  '.env',                                      // Default location
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  try {
    const result = dotenv.config({ path: envPath, override: true });
    if (result.parsed && result.parsed.JWT_SECRET) {
      process.env.JWT_SECRET = result.parsed.JWT_SECRET;
      envLoaded = true;
      console.log(`✅ Loaded .env from: ${envPath}`);
      break;
    }
    if (process.env.JWT_SECRET) {
      envLoaded = true;
      console.log(`✅ Loaded .env from: ${envPath}`);
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

// Also try default location as fallback
if (!envLoaded) {
  try {
    const result = dotenv.config({ override: true });
    if (result.parsed && result.parsed.JWT_SECRET) {
      process.env.JWT_SECRET = result.parsed.JWT_SECRET;
      envLoaded = true;
    }
  } catch (error) {
    // Ignore
  }
}

// Last resort: Read .env file directly and parse manually
if (!process.env.JWT_SECRET) {
  for (const envPath of possibleEnvPaths) {
    try {
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf8');
        const lines = envContent.split(/\r?\n/);
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith('#')) continue;
          
          if (trimmedLine.startsWith('JWT_SECRET=')) {
            let value = trimmedLine.substring('JWT_SECRET='.length).trim();
            // Remove comments
            const commentIndex = value.indexOf('#');
            if (commentIndex !== -1) {
              value = value.substring(0, commentIndex).trim();
            }
            // Remove surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            if (value) {
              process.env.JWT_SECRET = value;
              envLoaded = true;
              console.log(`✅ Loaded JWT_SECRET from direct file read: ${envPath}`);
              break;
            }
          }
        }
        if (envLoaded) break;
      }
    } catch (error) {
      // Continue to next path
    }
  }
}

// Verify critical environment variables are loaded
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not found in environment variables. Authentication will fail.');
  console.warn('   Make sure .env file exists in the project root with JWT_SECRET defined.');
  console.warn('   Tried paths:', possibleEnvPaths.join(', '));
} else {
  console.log('✅ JWT_SECRET loaded successfully');
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0'; // Bind to all network interfaces
const port = parseInt(process.env.PORT || '3000', 10);

// CORS: strict origins in production; '*' in dev if not set
const defaultFrontendOrigin = process.env.FRONTEND_URL || (dev ? 'http://localhost:5173' : 'http://173.249.47.147');
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : dev
    ? ['*']
    : [defaultFrontendOrigin, 'http://173.249.47.147', 'http://localhost:5173', 'http://localhost:3000'];

// Leaderboard broadcast throttle: max 1 per olympiad per 10s
const LEADERBOARD_THROTTLE_MS = 10000;
const leaderboardLastBroadcast = new Map();

// Violation throttle: max 10 per attempt per minute (prevent cheat vector abuse)
const VIOLATION_MAX_PER_MINUTE = 10;
const VIOLATION_WINDOW_MS = 60000;
const violationTimestamps = new Map();

const app = next({ dev });
const handle = app.getRequestHandler();

// Swagger UI HTML - served directly to avoid React/script loading issues
const SWAGGER_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Global Olympiad API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "/api/swagger.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`;

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    // Log incoming requests for debugging
    const startTime = Date.now();
    const urlPath = parse(req.url, true).pathname;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Serve Swagger UI HTML directly (avoids blank React page)
    if (req.method === 'GET' && (urlPath === '/api-docs' || urlPath === '/api-docs/')) {
      res.setHeader('Content-Type', 'text/html');
      res.end(SWAGGER_HTML);
      return;
    }

    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
      
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`[${new Date().toISOString()}] Error handling ${req.method} ${req.url} (${duration}ms):`, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io with CORS - strict origins in production
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        socket.userId = decoded.id;
        return next();
      }
    }
    // Allow connection without auth for now (can be made required)
    return next();
  });

  // Socket.io handlers
  io.on('connection', async (socket) => {
    console.log('User connected:', socket.id, socket.userId ? `(User: ${socket.userId})` : '(Unauthenticated)');

    let heartbeatInterval = null;
    let attemptId = null;

    // Join olympiad room and bind to attempt
    socket.on('join-olympiad', async (data) => {
      const olympiadId = typeof data === 'string' ? data : data?.olympiadId;
      const attemptIdValue = typeof data === 'object' ? data?.attemptId : null;
      
      socket.join(`olympiad-${olympiadId}`);
      attemptId = attemptIdValue;
      console.log(`User ${socket.id} joined olympiad ${olympiadId}${attemptId ? ` (attempt: ${attemptId})` : ''}`);

      // Start heartbeat tracking (in-memory only, no DB write per heartbeat)
      if (attemptId && socket.userId) {
        presenceStore.update(attemptId, socket.id, 'connected', new Date());

        // Heartbeat interval: update in-memory presence only
        heartbeatInterval = setInterval(() => {
          presenceStore.update(attemptId, socket.id, 'connected', new Date());
          socket.emit('heartbeat-ack');
        }, 3000);
      }
    });

    // Leave olympiad room
    socket.on('leave-olympiad', async (olympiadId) => {
      socket.leave(`olympiad-${olympiadId}`);
      
      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Persist disconnect immediately
      if (attemptId && socket.userId) {
        presenceStore.update(attemptId, socket.id, 'disconnected', new Date());
        try {
          await flushPresenceToMongo();
          presenceStore.remove(attemptId, socket.id);
        } catch (error) {
          console.error('Error persisting heartbeat on leave:', error);
        }
      }

      console.log(`User ${socket.id} left olympiad ${olympiadId}`);
    });

    // Client heartbeat (sent from client every 3-5 seconds) - in-memory only, no DB write
    socket.on('heartbeat', async (data) => {
      const attemptIdValue = data?.attemptId || attemptId;
      const clientNow = data?.clientNow ? new Date(data.clientNow) : null;
      
      if (attemptIdValue && socket.userId) {
        try {
          // Rate limiting for heartbeat
          const { checkWebSocketRateLimit } = await import('./lib/rate-limiting.js');
          const rateLimitResult = checkWebSocketRateLimit('heartbeat', attemptIdValue, socket.userId.toString(), socket.id);
          if (!rateLimitResult.allowed) {
            console.warn(`Rate limit exceeded for heartbeat: ${socket.id}`);
            socket.emit('rate-limit-warning', { remaining: rateLimitResult.remaining, resetAt: rateLimitResult.resetAt });
            const { default: connectMongoDB } = await import('./lib/mongodb.js');
            const Attempt = (await import('./models/Attempt.js')).default;
            await connectMongoDB();
            const attempt = await Attempt.findById(attemptIdValue);
            if (attempt) {
              attempt.violations.push({
                type: 'RATE_LIMIT_EXCEEDED',
                timestamp: new Date(),
                details: { endpoint: 'websocket:heartbeat', limit: rateLimitResult.limit },
              });
              await attempt.save();
            }
          }

          const now = new Date();
          const previousHeartbeat = presenceStore.get(attemptIdValue, socket.id);

          // Update in-memory presence only (no DB write)
          presenceStore.update(attemptIdValue, socket.id, 'connected', now);

          // Check for missed heartbeats using previous lastSeenAt (async, non-blocking)
          if (previousHeartbeat && previousHeartbeat.lastSeenAt) {
            const { detectMissedHeartbeats } = await import('./lib/heartbeat-enforcement.js');
            detectMissedHeartbeats(attemptIdValue, previousHeartbeat.lastSeenAt).catch((err) =>
              console.error('detectMissedHeartbeats error:', err)
            );
          }

          // Time drift check - DB write only on anomaly
          if (clientNow) {
            const drift = Math.abs(now - clientNow);
            const MAX_DRIFT_MS = 10000;
            if (drift > MAX_DRIFT_MS) {
              const { default: connectMongoDB } = await import('./lib/mongodb.js');
              const Attempt = (await import('./models/Attempt.js')).default;
              await connectMongoDB();
              const attempt = await Attempt.findById(attemptIdValue);
              if (attempt) {
                attempt.violations.push({
                  type: 'TIME_DRIFT_ANOMALY',
                  timestamp: now,
                  details: {
                    serverTime: now.toISOString(),
                    clientTime: clientNow.toISOString(),
                    driftMs: drift,
                  },
                });
                await attempt.save();
              }
            }
          }

          socket.emit('heartbeat-ack');
        } catch (error) {
          console.error('Heartbeat update error:', error);
        }
      }
    });

    // Timer sync request
    socket.on('timer-sync', async (data) => {
      const { attemptId: attemptIdValue } = data || {};
      if (attemptIdValue && socket.userId) {
        try {
          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const Attempt = (await import('./models/Attempt.js')).default;
          const { getTimerStatus } = await import('./lib/timer-service.js');
          await connectMongoDB();

          const attempt = await Attempt.findById(attemptIdValue);
          if (attempt && attempt.userId.toString() === socket.userId.toString()) {
            const timerStatus = getTimerStatus(attempt.endsAt);
            socket.emit('timer-sync-response', timerStatus);
          }
        } catch (error) {
          console.error('Timer sync error:', error);
        }
      }
    });

    // Violation report from client (throttled: max 10/min per attempt)
    socket.on('violation-report', async (data) => {
      const { attemptId: attemptIdValue, violationType, details } = data || {};
      if (!attemptIdValue || !violationType || !socket.userId) return;

      const key = attemptIdValue.toString();
      const now = Date.now();
      let timestamps = violationTimestamps.get(key) || [];
      timestamps = timestamps.filter((t) => now - t < VIOLATION_WINDOW_MS);
      if (timestamps.length >= VIOLATION_MAX_PER_MINUTE) {
        return; // Silently drop; no DB write
      }
      timestamps.push(now);
      violationTimestamps.set(key, timestamps);

      try {
        const { default: connectMongoDB } = await import('./lib/mongodb.js');
        const Attempt = (await import('./models/Attempt.js')).default;
        const { createAuditLog } = await import('./lib/audit-logger.js');
        await connectMongoDB();

        const attempt = await Attempt.findById(attemptIdValue);
        if (attempt && attempt.userId.toString() === socket.userId.toString()) {
          attempt.violations.push({
            type: violationType,
            timestamp: new Date(),
            details: details || {},
          });
          await attempt.save();

          await createAuditLog({
            attemptId: attempt._id,
            userId: attempt.userId,
            olympiadId: attempt.olympiadId,
            eventType: 'violation',
            metadata: { violationType, details, source: 'websocket' },
          });
        }
      } catch (error) {
        console.error('Violation report error:', error);
      }
    });

    // Timer update (broadcast)
    socket.on('timer-update', (data) => {
      socket.to(`olympiad-${data.olympiadId}`).emit('timer-update', data);
    });

    // Leaderboard update (throttled: max 1 broadcast per olympiad per 10s)
    socket.on('leaderboard-update', (data) => {
      const olympiadId = data?.olympiadId;
      if (!olympiadId) return;
      const now = Date.now();
      const last = leaderboardLastBroadcast.get(olympiadId) || 0;
      if (now - last < LEADERBOARD_THROTTLE_MS) return;
      leaderboardLastBroadcast.set(olympiadId, now);
      io.to(`olympiad-${olympiadId}`).emit('leaderboard-update', data);
    });

    // Submission notification
    socket.on('submission', (data) => {
      socket.to(`olympiad-${data.olympiadId}`).emit('submission-notification', data);
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);

      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Persist disconnect immediately, then remove from presence
      if (attemptId && socket.userId) {
        presenceStore.update(attemptId, socket.id, 'disconnected', new Date());
        try {
          await flushPresenceToMongo();
          presenceStore.remove(attemptId, socket.id);

          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const Attempt = (await import('./models/Attempt.js')).default;
          const { createAuditLog } = await import('./lib/audit-logger.js');
          await connectMongoDB();
          const attempt = await Attempt.findById(attemptId);
          if (attempt) {
            await createAuditLog({
              attemptId: attempt._id,
              userId: attempt.userId,
              olympiadId: attempt.olympiadId,
              eventType: 'disconnect',
              metadata: { socketId: socket.id },
            });
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });
  });

  // Batch flush presence to MongoDB every 20 seconds
  const PRESENCE_FLUSH_INTERVAL_MS = 20000;
  const presenceFlushInterval = setInterval(() => {
    flushPresenceToMongo().catch((err) => console.error('Presence flush error:', err));
  }, PRESENCE_FLUSH_INTERVAL_MS);

  // Clear flush interval on shutdown
  process.on('SIGTERM', () => clearInterval(presenceFlushInterval));
  process.on('SIGINT', () => clearInterval(presenceFlushInterval));

  // Function to get local IP address
  const getLocalIP = () => {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  };

  const localIP = getLocalIP();

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`========================================`);
      console.log(`✅ Backend Server Running!`);
      console.log(`========================================`);
      console.log(`🌐 Local: http://localhost:${port}`);
      console.log(`🌐 Network: http://${localIP}:${port}`);
      console.log(`📡 API Base: http://${localIP}:${port}/api`);
      console.log(`🏥 Health: http://${localIP}:${port}/api/health`);
      console.log(`📚 Swagger UI: http://${localIP}:${port}/api-docs`);
      console.log(`📋 Swagger JSON: http://${localIP}:${port}/api/swagger.json`);
      console.log(`🔌 Socket.io: http://${localIP}:${port}`);
      console.log(`📱 Frontend: ${process.env.FRONTEND_URL || (dev ? 'http://localhost:5173' : 'http://173.249.47.147')}`);
      console.log(``);
      console.log(`💡 Access from other devices using: http://${localIP}:${port}`);
      
      // Verify critical environment variables
      if (process.env.JWT_SECRET) {
        console.log(`🔐 JWT_SECRET: ✅ Loaded`);
      } else {
        console.log(`🔐 JWT_SECRET: ❌ NOT FOUND - Authentication will fail!`);
        console.log(`   Please ensure .env file exists with JWT_SECRET defined.`);
      }
      
      console.log(`========================================`);
    });
});
