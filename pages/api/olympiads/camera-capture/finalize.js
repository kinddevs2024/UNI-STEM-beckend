import connectDB from "../../../../lib/mongodb.js";
import CameraCapture from "../../../../models/CameraCapture.js";
import { protect } from "../../../../lib/auth.js";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { enqueue } from "../../../../lib/ffmpeg-queue.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert image sequence to video
 * POST /api/olympiads/camera-capture/finalize
 * Body: { olympiadId, sessionId }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    await connectDB();

    const { olympiadId, sessionId } = req.body;

    if (!olympiadId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Please provide olympiadId and sessionId",
      });
    }

    // Find session directory
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    const sessionDir = path.join(process.cwd(), uploadPath, "sessions", sessionId.toString());

    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Get all frame images, sorted by index
    let files = fs.readdirSync(sessionDir)
      .filter((file) => file.startsWith("frame-") && file.endsWith(".jpg"))
      .sort();

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images found in session",
      });
    }


    // Renumber files to start from 0 for ffmpeg pattern matching
    // Extract numbers from filenames and renumber sequentially
    const renumberedFiles = [];
    files.forEach((file, index) => {
      const newFileName = `frame-${String(index).padStart(6, '0')}.jpg`;
      if (file !== newFileName) {
        const oldPath = path.join(sessionDir, file);
        const newPath = path.join(sessionDir, newFileName);
        fs.renameSync(oldPath, newPath);
      }
      renumberedFiles.push(newFileName);
    });
    files = renumberedFiles;

    // Create output video path
    const outputFileName = `video-${sessionId}-${Date.now()}.mp4`;
    const outputPath = path.join(process.cwd(), uploadPath, outputFileName);

    // Use image2 demuxer with pattern
    const inputPattern = path.join(sessionDir, "frame-%06d.jpg");

    // Convert image sequence to video at 2 fps (2 frames per second = 0.5 seconds per frame)
    // Note: Since we capture every 1 second, 2 fps means video plays 2x faster than real-time
    // Uses FFmpeg queue to limit concurrent processing
    await enqueue(
      () =>
        new Promise((resolve, reject) => {
          ffmpeg()
            .input(inputPattern)
            .inputOptions(["-framerate", "2"]) // Input frame rate: 2 fps
            .videoCodec("libx264")
            .audioCodec("aac")
            .videoBitrate("1000k")
            .format("mp4")
            .outputOptions([
              "-preset fast",
              "-crf 23",
              "-movflags +faststart",
              "-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
              "-r 2", // Output frame rate: 2 fps (0.5 seconds per frame)
            ])
            .on("end", () => {
              resolve();
            })
            .on("error", (err) => {
              console.error("Video conversion error:", err);
              reject(err);
            })
            .save(outputPath);
        })
    );

    // Get video file stats
    const stats = fs.statSync(outputPath);

    // Save capture record (store relative path)
    const relativePath = path.relative(process.cwd(), outputPath);
    let capture;
    if (useMongoDB) {
      capture = await CameraCapture.create({
        userId: authResult.user._id,
        olympiadId: olympiadId.toString(),
        imagePath: relativePath,
        captureType: "both",
      });
    } else {
      const captures = readDB("cameraCaptures");
      capture = {
        _id: generateId(),
        userId: authResult.user._id.toString(),
        olympiadId: olympiadId.toString(),
        imagePath: relativePath,
        captureType: "both",
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      captures.push(capture);
      writeDB("cameraCaptures", captures);
    }

    // Clean up session directory (optional - you may want to keep it for debugging)
    // fs.rmSync(sessionDir, { recursive: true, force: true });

    const fileUrl = `/api/uploads/${outputFileName}`;

    res.json({
      success: true,
      message: "Video created successfully",
      captureId: capture._id,
      videoUrl: fileUrl,
      storage: "mongodb",
      fileType: "video",
      fileSize: stats.size,
      framesCount: files.length,
      duration: files.length / 2, // 2 fps = 0.5 seconds per frame (video plays 2x faster than capture rate)
    });
  } catch (error) {
    console.error("Finalize error:", error);

    const isMongoConnectionError =
      error.name === "MongooseServerSelectionError" ||
      error.name === "MongoServerSelectionError" ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect ECONNREFUSED");

    if (isMongoConnectionError) {
      return res.status(503).json({
        success: false,
        message:
          "Database service is currently unavailable. Please ensure MongoDB is running or check your connection settings.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
    });
  }
}

