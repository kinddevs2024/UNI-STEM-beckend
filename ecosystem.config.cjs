/**
 * PM2 Ecosystem Configuration
 *
 * Optimized for 100 concurrent users:
 * - instances: 1 (Socket.io requires single process without Redis adapter)
 * - max_memory_restart: protects against memory leaks
 *
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "olympiad-backend",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
