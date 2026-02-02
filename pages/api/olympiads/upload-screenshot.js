import connectDB from "../../../lib/mongodb.js";
import CameraCapture from "../../../models/CameraCapture.js";
import { protect } from "../../../lib/auth.js";
import { handleCORS } from '../../../lib/api-helpers.js';

import {
  parseForm,
  saveFile,
  config,
} from "../../../lib/upload.js";

export { config };

/**
 * Screenshot Upload Endpoint
 * POST /api/olympiads/upload-screenshot
 * 
 * Accepts screenshot images when a user leaves a tab,
 * saves them to user-specific folders.
 * 
 * Request:
 *   Headers: Authorization: Bearer <token>
 *   Body (FormData):
 *     - screenshot: File (Image file - PNG, JPG, etc.)
 *     - olympiadId: String (optional)
 *     - username: String (optional, for identification)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "message": "Screenshot uploaded successfully",
 *     "screenshotId": "screenshot_id_123",
 *     "filename": "users/user123/screenshot-xyz.jpg",
 *     "fileUrl": "/api/uploads/users/user123/screenshot-xyz.jpg"
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

    const { olympiadId, username } = fields || {};

    // Get screenshot file (can be 'screenshot' or 'image')
    const screenshotFile =
      files?.screenshot || files?.image
        ? Array.isArray(files.screenshot || files.image)
          ? (files.screenshot || files.image)[0]
          : files.screenshot || files.image
        : null;

    if (!screenshotFile) {
      return res.status(400).json({
        success: false,
        message: "Please upload a screenshot file",
        receivedFiles: files ? Object.keys(files) : [],
      });
    }

    // Verify it's an image file
    const imageMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!imageMimeTypes.includes(screenshotFile.mimetype?.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message:
          "File must be an image (received: " +
          (screenshotFile.mimetype || "unknown") +
          ")",
      });
    }

    // Get user ID for folder organization
    // Use username if provided, otherwise use authenticated user ID
    const userId = authResult.user._id.toString();
    const userIdentifier = username || userId;

    // Save screenshot to user-specific folder
    let savedFile;
    try {
      savedFile = await saveFile(
        screenshotFile,
        process.env.UPLOAD_PATH || "./uploads",
        userId // Always use authenticated user's folder
      );
    } catch (saveError) {
      console.error("Error saving screenshot:", saveError);
      return res.status(500).json({
        success: false,
        message: "Error saving screenshot: " + saveError.message,
        error:
          process.env.NODE_ENV === "development" ? saveError.stack : undefined,
      });
    }

    // Use relative path for database storage
    const screenshotPath = savedFile.relativePath || savedFile.path;

    const capture = await CameraCapture.create({
      userId: authResult.user._id.toString(),
      olympiadId: olympiadId?.toString() || '',
      imagePath: screenshotPath,
      captureType: "screenshot",
    });

    // Generate file URL for accessing the file
    const fileUrl = `/api/uploads/${savedFile.name}`;

    // Return success response
    res.json({
      success: true,
      message: "Screenshot uploaded successfully",
      screenshotId: capture._id.toString(),
      filename: savedFile.name,
      size: savedFile.size,
      fileUrl: fileUrl,
      username: userIdentifier,
      storage: "mongodb",
    });
  } catch (error) {
    console.error("Screenshot upload error:", error);
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

