import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import universityRoutes from './routes/universityRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import accessRoutes from './routes/accessRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { notFoundMiddleware, errorMiddleware } from './middleware/errorMiddleware.js';

/**
 * Create the Portfolio Express app. Pass the Socket.IO namespace for portfolio
 * so that real-time events (notifications, chat) can be emitted.
 * @param {import("socket.io").Namespace} [portfolioNamespace] - io.of('/portfolio')
 */
export default function createPortfolioApp(portfolioNamespace = null) {
  const portfolioApp = express();

  portfolioApp.set('portfolioNamespace', portfolioNamespace);

  // CORS: allow multiple origins (comma-separated) so Olympiad and Portfolio fronts can both call the API
  const corsRaw = process.env.PORTFOLIO_CORS_ORIGIN || process.env.CORS_ORIGIN || '';
  const allowedOrigins = corsRaw
    ? corsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const corsOptions = {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
  };
  portfolioApp.use(cors(corsOptions));
  portfolioApp.use(express.json());

  portfolioApp.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'portfolio' });
  });

  portfolioApp.use('/auth', authRoutes);
  portfolioApp.use('/students', studentRoutes);
  portfolioApp.use('/universities', universityRoutes);
  portfolioApp.use('/applications', applicationRoutes);
  portfolioApp.use('/access', accessRoutes);
  portfolioApp.use('/chat', chatRoutes);
  portfolioApp.use('/notifications', notificationRoutes);
  portfolioApp.use('/admin', adminRoutes);

  portfolioApp.use(notFoundMiddleware);
  portfolioApp.use(errorMiddleware);

  return portfolioApp;
}
