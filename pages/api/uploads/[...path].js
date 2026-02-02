import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { handleCORS } from '../../../lib/api-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Serve uploaded files (images and videos)
 * GET /api/uploads/filename.jpg
 * GET /api/uploads/filename.mp4
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get file path from query (can be array for catch-all routes)
    let filePath = req.query.path;

    if (!filePath) {
      return res.status(400).json({ message: "Invalid file path" });
    }

    // Handle array path (from [...path] catch-all route)
    if (Array.isArray(filePath)) {
      filePath = filePath.join('/');
    }

    // Decode URL-encoded path
    filePath = decodeURIComponent(filePath);

    // Construct full path to uploads directory
    const uploadsDir = path.join(process.cwd(), "uploads");
    const fullPath = path.join(uploadsDir, filePath);

    // Security: Ensure the file is within uploads directory
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(path.normalize(uploadsDir))) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ message: "File not found" });
    }

    // Get file stats
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ message: "Not a file" });
    }

    // Determine content type
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    // Set headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // For videos, enable range requests (for video seeking)
    if (contentType.startsWith("video/")) {
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(normalizedPath, { start, end });

        res.status(206); // Partial Content
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", chunksize);

        file.pipe(res);
        return;
      }
    }

    // Stream the file
    const fileStream = fs.createReadStream(normalizedPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving file:", error);
    res.status(500).json({
      success: false,
      message: "Error serving file",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
