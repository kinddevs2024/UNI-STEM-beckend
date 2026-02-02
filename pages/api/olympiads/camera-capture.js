import connectDB from "../../../lib/mongodb.js";
import CameraCapture from "../../../models/CameraCapture.js";
import { protect } from "../../../lib/auth.js";
import {
  parseForm,
  saveFile,
  config,
  isVideoFile,
} from "../../../lib/upload.js";
import fs from "fs";
import path from "path";

import { handleCORS } from '../../../lib/api-helpers.js';

export { config };

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
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

    const { fields, files } = await parseForm(req);
    const { olympiadId, captureType, sessionId, isSequence } = fields;

    if (!olympiadId || !captureType) {
      return res.status(400).json({
        success: false,
        message: "Please provide olympiadId and captureType",
      });
    }

    // Handle image sequence (multiple images for video conversion)
    if (isSequence === "true" && sessionId) {
      const images = Array.isArray(files.images)
        ? files.images
        : files.images
          ? [files.images]
          : [];

      if (images.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please upload at least one image",
        });
      }

      // Create session directory
      const uploadPath = process.env.UPLOAD_PATH || "./uploads";
      const sessionDir = path.join(
        process.cwd(),
        uploadPath,
        "sessions",
        sessionId.toString()
      );
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Get current frame count (to append, not overwrite)
      const existingFrames = fs.existsSync(sessionDir)
        ? fs
          .readdirSync(sessionDir)
          .filter(
            (file) => file.startsWith("frame-") && file.endsWith(".jpg")
          ).length
        : 0;

      // Save all images to session directory with sequential naming
      const savedImages = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const frameIndex = existingFrames + i;
        const fileName = `frame-${String(frameIndex).padStart(6, "0")}.jpg`;
        const filePath = path.join(sessionDir, fileName);
        fs.renameSync(image.filepath, filePath);
        savedImages.push({
          path: filePath,
          name: fileName,
          index: frameIndex,
        });
      }

      res.json({
        message: `${images.length} images uploaded successfully`,
        sessionId: sessionId.toString(),
        imagesCount: existingFrames + images.length,
        storage: "mongodb",
      });
      return;
    }

    // Handle single file upload (backward compatibility)
    const file = Array.isArray(files.image)
      ? files.image[0]
      : files.image ||
      (Array.isArray(files.video) ? files.video[0] : files.video);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image or video file",
      });
    }

    // Get user ID for folder organization
    const userId = authResult.user._id.toString();

    const savedFile = await saveFile(
      file,
      process.env.UPLOAD_PATH || "./uploads",
      userId
    );

    // Use relative path for database storage
    const imagePath = savedFile.relativePath || savedFile.path;

    const capture = await CameraCapture.create({
      userId: authResult.user._id.toString(),
      olympiadId: olympiadId.toString(),
      imagePath: imagePath,
      captureType: captureType.toString(),
    });

    // Generate file URL for accessing the file
    const fileUrl = `/api/uploads/${savedFile.name}`;
    const isVideo = isVideoFile(savedFile.type);

    res.json({
      message: `${isVideo ? "Video" : "Image"} uploaded successfully`,
      captureId: capture._id,
      storage: useMongoDB ? "mongodb" : "json",
      fileType: isVideo ? "video" : "image",
      fileUrl: fileUrl,
      processed: savedFile.processed || false,
    });
  } catch (error) {
    console.error("Camera capture error:", error);

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
    });
  }
}
