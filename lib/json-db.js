/**
 * Legacy json-db module - now uses MongoDB.
 * connectDB connects to MongoDB. readDB/writeDB are deprecated - use Mongoose models via helpers.
 */
import connectMongoDB from './mongodb.js';

// Re-export MongoDB connection for compatibility
export const connectDB = connectMongoDB;

// Generate ID for backward compatibility (used by some helpers during migration)
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Deprecated: readDB/writeDB - will throw if called (all code should use Mongoose via helpers)
export function readDB(table) {
  console.warn(`[json-db] readDB("${table}") is deprecated - use Mongoose models`);
  return [];
}

export function writeDB(table, data) {
  console.warn(`[json-db] writeDB("${table}") is deprecated - use Mongoose models`);
  return false;
}

export default { connectDB, readDB, writeDB, generateId };
