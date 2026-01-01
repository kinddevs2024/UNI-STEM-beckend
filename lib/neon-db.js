import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is not set in environment variables");
}

// Cache the connection
let cached = global.neon;

if (!cached) {
  cached = global.neon = {
    sql: null,
    promise: null,
    lastFailure: null,
    failureCount: 0,
    lastErrorLog: 0,
  };
}

// Check if we should skip Neon connection (after multiple failures)
const shouldSkipNeon = () => {
  if (!cached.lastFailure) return false;
  const timeSinceFailure = Date.now() - cached.lastFailure;
  // Skip for 60 seconds after 3 consecutive failures
  return cached.failureCount >= 3 && timeSinceFailure < 60000;
};

/**
 * Connect to Neon PostgreSQL database
 * @returns {Promise<NeonSql>} Neon SQL client
 */
async function connectNeonDB() {
  if (!DATABASE_URL) {
    const error = new Error(
      "DATABASE_URL is not defined in environment variables"
    );
    throw error;
  }

  // Skip if we've had recent failures to avoid unnecessary delays
  if (shouldSkipNeon()) {
    const error = new Error("Neon connection skipped due to recent failures");
    error.name = "NeonConnectionError";
    throw error;
  }

  // Return cached connection if available
  if (cached.sql) {
    return cached.sql;
  }

  // Create new connection if not cached
  if (!cached.promise) {
    cached.promise = (async () => {
      try {
        const sql = neon(DATABASE_URL);
        console.log("✅ Neon PostgreSQL Connected");
        cached.failureCount = 0; // Reset failure count on success
        cached.lastFailure = null;
        cached.sql = sql;
        return sql;
      } catch (error) {
        cached.failureCount = (cached.failureCount || 0) + 1;
        const failureTime = Date.now();
        cached.lastFailure = failureTime;
        cached.promise = null;
        // Only log error if it's the first failure or every 5 minutes
        const timeSinceLastLog = failureTime - (cached.lastErrorLog || 0);
        if (cached.failureCount === 1 || timeSinceLastLog > 300000) {
          console.error("❌ Neon Connection Error:", error.message);
          cached.lastErrorLog = failureTime;
        }
        throw error;
      }
    })();
  }

  try {
    await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.sql;
}

/**
 * Get Neon SQL client (for immediate use without async connection)
 * Use this when you know connection is already established
 * @returns {NeonSql|null} Neon SQL client or null if not connected
 */
function getNeonDB() {
  return cached.sql || null;
}

// Default export
export default connectNeonDB;

// Named exports
export { connectNeonDB, getNeonDB };
