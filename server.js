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

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    // Log incoming requests for debugging
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
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

  // Initialize Socket.io with CORS - allow all origins
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
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

      // Start heartbeat tracking if attemptId provided
      if (attemptId && socket.userId) {
        try {
          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const SessionHeartbeat = (await import('./models/SessionHeartbeat.js')).default;
          await connectMongoDB();

          // Update or create heartbeat
          await SessionHeartbeat.findOneAndUpdate(
            { attemptId, socketId: socket.id },
            {
              attemptId,
              socketId: socket.id,
              lastSeenAt: new Date(),
              status: 'connected'
            },
            { upsert: true, new: true }
          );

          // Set up heartbeat interval (every 3 seconds)
          heartbeatInterval = setInterval(async () => {
            try {
              await SessionHeartbeat.findOneAndUpdate(
                { attemptId, socketId: socket.id },
                { lastSeenAt: new Date(), status: 'connected' },
                { upsert: true }
              );
              socket.emit('heartbeat-ack');
            } catch (error) {
              console.error('Heartbeat error:', error);
            }
          }, 3000);
        } catch (error) {
          console.error('Error setting up heartbeat:', error);
        }
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

      // Mark heartbeat as disconnected
      if (attemptId && socket.userId) {
        try {
          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const SessionHeartbeat = (await import('./models/SessionHeartbeat.js')).default;
          await connectMongoDB();

          await SessionHeartbeat.findOneAndUpdate(
            { attemptId, socketId: socket.id },
            { status: 'disconnected', lastSeenAt: new Date() }
          );
        } catch (error) {
          console.error('Error updating heartbeat on leave:', error);
        }
      }

      console.log(`User ${socket.id} left olympiad ${olympiadId}`);
    });

    // Client heartbeat (sent from client every 3-5 seconds)
    socket.on('heartbeat', async (data) => {
      const attemptIdValue = data?.attemptId || attemptId;
      const clientNow = data?.clientNow ? new Date(data.clientNow) : null;
      
      if (attemptIdValue && socket.userId) {
        try {
          // Rate limiting for heartbeat
          const { checkWebSocketRateLimit } = await import('./lib/rate-limiting.js');
          const rateLimitResult = checkWebSocketRateLimit('heartbeat', attemptIdValue, socket.userId.toString(), socket.id);
          if (!rateLimitResult.allowed) {
            // Rate limit exceeded - log but don't block (heartbeat is critical)
            console.warn(`Rate limit exceeded for heartbeat: ${socket.id}`);
            socket.emit('rate-limit-warning', { remaining: rateLimitResult.remaining, resetAt: rateLimitResult.resetAt });
            // Still process heartbeat, but log violation
            const { default: connectMongoDB } = await import('./lib/mongodb.js');
            const Attempt = (await import('./models/Attempt.js')).default;
            await connectMongoDB();
            const attempt = await Attempt.findById(attemptIdValue);
            if (attempt) {
              attempt.violations.push({
                type: 'RATE_LIMIT_EXCEEDED',
                timestamp: new Date(),
                details: {
                  endpoint: 'websocket:heartbeat',
                  limit: rateLimitResult.limit
                }
              });
              await attempt.save();
            }
          }

          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const SessionHeartbeat = (await import('./models/SessionHeartbeat.js')).default;
          const { detectMissedHeartbeats } = await import('./lib/heartbeat-enforcement.js');
          await connectMongoDB();

          const now = new Date();
          
          // Get previous heartbeat to check for missed heartbeats
          const previousHeartbeat = await SessionHeartbeat.findOne({
            attemptId: attemptIdValue,
            socketId: socket.id
          });

          // Update heartbeat record
          await SessionHeartbeat.findOneAndUpdate(
            { attemptId: attemptIdValue, socketId: socket.id },
            { lastSeenAt: now, status: 'connected' },
            { upsert: true }
          );

          // Check for missed heartbeats using previous lastSeenAt
          if (previousHeartbeat && previousHeartbeat.lastSeenAt) {
            await detectMissedHeartbeats(attemptIdValue, previousHeartbeat.lastSeenAt);
          }

          // Check time drift if client timestamp provided
          if (clientNow) {
            const drift = Math.abs(now - clientNow);
            const MAX_DRIFT_MS = 10000; // 10 seconds
            if (drift > MAX_DRIFT_MS) {
              // Log time drift anomaly
              const Attempt = (await import('./models/Attempt.js')).default;
              const attempt = await Attempt.findById(attemptIdValue);
              if (attempt) {
                attempt.violations.push({
                  type: 'TIME_DRIFT_ANOMALY',
                  timestamp: now,
                  details: {
                    serverTime: now.toISOString(),
                    clientTime: clientNow.toISOString(),
                    driftMs: drift
                  }
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

    // Violation report from client
    socket.on('violation-report', async (data) => {
      const { attemptId: attemptIdValue, violationType, details } = data || {};
      if (attemptIdValue && violationType && socket.userId) {
        try {
          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const Attempt = (await import('./models/Attempt.js')).default;
          const { createAuditLog } = await import('./lib/audit-logger.js');
          await connectMongoDB();

          const attempt = await Attempt.findById(attemptIdValue);
          if (attempt && attempt.userId.toString() === socket.userId.toString()) {
            // Add violation (validation handled in API endpoint)
            attempt.violations.push({
              type: violationType,
              timestamp: new Date(),
              details: details || {}
            });
            await attempt.save();

            // Log audit
            await createAuditLog({
              attemptId: attempt._id,
              userId: attempt.userId,
              olympiadId: attempt.olympiadId,
              eventType: 'violation',
              metadata: { violationType, details, source: 'websocket' }
            });
          }
        } catch (error) {
          console.error('Violation report error:', error);
        }
      }
    });

    // Timer update (broadcast)
    socket.on('timer-update', (data) => {
      socket.to(`olympiad-${data.olympiadId}`).emit('timer-update', data);
    });

    // Leaderboard update
    socket.on('leaderboard-update', (data) => {
      io.to(`olympiad-${data.olympiadId}`).emit('leaderboard-update', data);
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

      // Mark heartbeat as disconnected
      if (attemptId && socket.userId) {
        try {
          const { default: connectMongoDB } = await import('./lib/mongodb.js');
          const SessionHeartbeat = (await import('./models/SessionHeartbeat.js')).default;
          const Attempt = (await import('./models/Attempt.js')).default;
          const { createAuditLog } = await import('./lib/audit-logger.js');
          await connectMongoDB();

          await SessionHeartbeat.findOneAndUpdate(
            { attemptId, socketId: socket.id },
            { status: 'disconnected', lastSeenAt: new Date() }
          );

          // Log disconnect
          const attempt = await Attempt.findById(attemptId);
          if (attempt) {
            await createAuditLog({
              attemptId: attempt._id,
              userId: attempt.userId,
              olympiadId: attempt.olympiadId,
              eventType: 'disconnect',
              metadata: { socketId: socket.id }
            });
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });
  });

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
      console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
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
