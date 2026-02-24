import connectDB from "../../../lib/mongodb.js";
import CameraCapture from "../../../models/CameraCapture.js";
import { protect } from "../../../lib/auth.js";
import { checkRateLimitByIP } from "../../../lib/rate-limiting.js";
import { handleCORS } from '../../../lib/api-helpers.js';

import {
  parseForm,
  saveFile,
  isVideoFile,
} from "../../../lib/upload.js";

export const config = { api: { bodyParser: false } };

/**
 * Video Upload Endpoint
 * POST /api/olympiads/upload-video
 *
 * Accepts WebM video files, saves them to user-specific folders,
 * and stores metadata in the database.
 *
 * Request:
 *   Headers: Authorization: Bearer <token>
 *   Body (FormData):
 *     - video: File (WebM video file, 50-500 MB)
 *     - olympiadId: String
 *     - captureType: String (optional, defaults to "both")
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Video uploaded successfully",
 *     "videoId": "video_id_123",
 *     "filename": "users/user123/recording-xyz.mp4",
 *     "size": 52428800,
 *     "fileUrl": "/api/uploads/users/user123/recording-xyz.mp4"
 *   }
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const rateLimit = checkRateLimitByIP("/upload", req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      message: "Too many uploads. Please try again later.",
      retryAfter: rateLimit.resetAt,
    });
  }

  try {
    // Verify JWT authentication
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    await connectDB();

    // Parse form data
    let fields, files;
    try {
      const parsed = await parseForm(req);
      fields = parsed.fields;
      files = parsed.files;
    } catch (parseError) {
      console.error("Error parsing form data:", parseError);
      return res.status(400).json({
        success: false,
        message: "Error parsing form data: " + parseError.message,
      });
    }

    const { olympiadId, captureType, videoType } = fields || {};

    if (!olympiadId) {
      return res.status(400).json({
        success: false,
        message: "Please provide olympiadId",
      });
    }

    // Get video file
    const videoFile = files?.video
      ? Array.isArray(files.video)
        ? files.video[0]
        : files.video
      : null;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        message: "Please upload a video file",
        receivedFiles: files ? Object.keys(files) : [],
      });
    }

    // Verify it's a video file
    if (!isVideoFile(videoFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message:
          "File must be a video (received: " +
          (videoFile.mimetype || "unknown") +
          ")",
      });
    }

    // Get user ID for folder organization
    const userId = authResult.user._id.toString();

    // Save video file to user-specific folder
    // The saveFile function will:
    // - Create folder: uploads/users/{userId}/
    // - Process video to 720p MP4
    // - Return file information
    let savedFile;
    try {
      savedFile = await saveFile(
        videoFile,
        process.env.UPLOAD_PATH || "./uploads",
        userId
      );
    } catch (saveError) {
      console.error("Error saving file:", saveError);
      return res.status(500).json({
        success: false,
        message: "Error saving video file: " + saveError.message,
        error:
          process.env.NODE_ENV === "development" ? saveError.stack : undefined,
      });
    }

    // Use relative path for database storage
    const videoPath = savedFile.relativePath || savedFile.path;

    // Determine capture type (use videoType if provided, fallback to captureType or "both")
    const finalCaptureType = videoType?.toString() || captureType?.toString() || "both";

    // Store metadata in database
    const capture = await CameraCapture.create({
      userId: authResult.user._id.toString(),
      olympiadId: olympiadId.toString(),
      imagePath: videoPath,
      captureType: finalCaptureType,
    });

    // Generate file URL for accessing the file
    const fileUrl = `/api/uploads/${savedFile.name}`;

    // Return success response
    res.json({
      success: true,
      message: "Video uploaded successfully",
      videoId: capture._id.toString(),
      filename: savedFile.name,
      size: savedFile.size,
      fileUrl: fileUrl,
      storage: "mongodb",
      processed: savedFile.processed || false,
    });
  } catch (error) {
    console.error("Video upload error:", error);
    console.error("Error stack:", error.stack);

    // Check if it's a MongoDB connection error
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
      message: error.message || "An unexpected error occurred",
      error:
        process.env.NODE_ENV === "development"
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
    });
  }
}
