#!/usr/bin/env node
/**
 * Cleanup orphaned temp files and old proctoring/video uploads
 * Run via cron: 0 2 * * * node scripts/cleanup-uploads.js (daily at 2am)
 *
 * - Deletes .tmp files older than 1 hour
 * - Deletes proctoring/video files older than 90 days (configurable via UPLOAD_RETENTION_DAYS)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const RETENTION_DAYS = parseInt(process.env.UPLOAD_RETENTION_DAYS || "90", 10);
const TMP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

let deletedCount = 0;
let freedBytes = 0;

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full, callback);
    } else {
      callback(full, e);
    }
  }
}

function safeUnlink(filePath) {
  try {
    const stats = fs.statSync(filePath);
    fs.unlinkSync(filePath);
    deletedCount++;
    freedBytes += stats.size;
    console.log(`  Deleted: ${path.relative(UPLOADS_DIR, filePath)}`);
  } catch (err) {
    console.error(`  Error deleting ${filePath}:`, err.message);
  }
}

async function run() {
  console.log("Cleanup uploads: starting");
  console.log(`  Retention: ${RETENTION_DAYS} days`);
  console.log(`  Temp max age: 1 hour`);

  const now = Date.now();
  const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = now - retentionMs;

  walkDir(UPLOADS_DIR, (filePath, entry) => {
    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;

    if (filePath.endsWith(".tmp") && now - mtime > TMP_MAX_AGE_MS) {
      safeUnlink(filePath);
      return;
    }

    // Proctoring/video in olympiads folder - apply retention
    if (filePath.includes("olympiads") || filePath.includes("users")) {
      if (mtime < cutoffDate) {
        safeUnlink(filePath);
      }
    }
  });

  console.log(`Done. Deleted ${deletedCount} files, freed ${(freedBytes / 1024 / 1024).toFixed(2)} MB`);
}

run().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
