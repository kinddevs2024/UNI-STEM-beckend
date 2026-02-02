/**
 * Disk space monitoring for uploads directory.
 * Logs warning if free space < 10% (POST_LAUNCH_STABILIZATION).
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WARN_THRESHOLD_PERCENT = 10;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 60000; // Don't log more than once per minute

/**
 * Get disk space info for the given path.
 * @param {string} dirPath - Path to check (e.g. uploads directory)
 * @returns {{ freePercent: number, freeBytes: number, totalBytes: number } | null}
 */
export function getDiskSpaceInfo(dirPath) {
  const resolvedPath = path.resolve(process.cwd(), dirPath);

  // Ensure directory exists for path resolution
  if (!fs.existsSync(resolvedPath)) {
    try {
      fs.mkdirSync(resolvedPath, { recursive: true });
    } catch {
      return null;
    }
  }

  try {
    // Node 19.6+ has fs.statfsSync
    if (typeof fs.statfsSync === "function") {
      const stats = fs.statfsSync(resolvedPath);
      const totalBytes = stats.blocks * stats.blockSize;
      const freeBytes = stats.bavail * stats.blockSize;
      const freePercent = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;
      if (
        typeof freePercent === "number" &&
        !isNaN(freePercent) &&
        totalBytes > 0
      ) {
        return { freePercent, freeBytes, totalBytes };
      }
    }
  } catch {
    // Fall through to df fallback
  }

  try {
    // Fallback: parse `df` output (Linux/macOS)
    const output = execSync(`df -k "${resolvedPath}"`, {
      encoding: "utf8",
      timeout: 2000,
    });
    const lines = output.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/).filter(Boolean);
      const totalKb = parseInt(parts[1], 10);
      const usedKb = parseInt(parts[2], 10);
      const availKb = parseInt(parts[3], 10);
      if (!isNaN(totalKb) && totalKb > 0) {
        const totalBytes = totalKb * 1024;
        const freeBytes = availKb * 1024;
        const freePercent = (freeBytes / totalBytes) * 100;
        return { freePercent, freeBytes, totalBytes };
      }
    }
  } catch {
    // Windows or unsupported - skip check
  }

  return null;
}

/**
 * Check disk space for uploads; log warning if &lt; 10% free.
 * Rate-limited to once per minute.
 * @param {string} [uploadDir] - Upload directory (default: ./uploads)
 * @returns {boolean} - true if ok or unknown, false if critically low
 */
export function checkUploadDiskSpace(uploadDir = "./uploads") {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL_MS) {
    return true;
  }

  const info = getDiskSpaceInfo(uploadDir);
  lastCheckTime = now;

  if (
    !info ||
    typeof info.freePercent !== "number" ||
    isNaN(info.freePercent) ||
    info.freePercent >= WARN_THRESHOLD_PERCENT
  ) {
    return true;
  }

  const freeGb = (info.freeBytes / (1024 ** 3)).toFixed(2);
  const totalGb = (info.totalBytes / (1024 ** 3)).toFixed(2);
  console.warn(
    `[DISK] Low disk space on uploads: ${info.freePercent.toFixed(1)}% free (${freeGb} GB / ${totalGb} GB). Consider freeing space or expanding disk.`
  );
  return false;
}
