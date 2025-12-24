import { handleCORS } from "../../../lib/api-helpers.js";
import { protect } from "../../../lib/auth.js";
import { parseForm, saveFile } from "../../../lib/upload.js";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * @swagger
 * /api/upload/portfolio-logo:
 *   post:
 *     summary: Upload portfolio logo/image
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  // Set cache-control headers
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Check authentication
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    const user = authResult.user;

    // Check if user is a student
    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can upload portfolio logos",
      });
    }

    // Parse form data
    let fields, files;
    try {
      const parsed = await parseForm(req, "./uploads/portfolio-logos");
      fields = parsed.fields;
      files = parsed.files;
    } catch (parseError) {
      console.error("Form parsing error:", parseError);
      return res.status(400).json({
        success: false,
        message: `Error parsing form data: ${parseError.message}`,
      });
    }

    // Get file (handle both single file and array)
    // Try different common field names
    let file =
      files.file ||
      files.logo ||
      files.image ||
      files.upload ||
      files.portfolioLogo;

    // Handle array
    if (Array.isArray(file)) {
      file = file[0];
    }

    if (!file) {
      console.error("No file found in upload. Available files:", Object.keys(files));
      return res.status(400).json({
        success: false,
        message:
          'No file provided. Please ensure the file is sent in a field named "file", "logo", "image", "upload", or "portfolioLogo".',
        debug: process.env.NODE_ENV === "development" ? {
          receivedFields: Object.keys(files),
        } : undefined,
      });
    }

    // Validate file type (images only for logos)
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    // Get mimetype (handle different formidable versions)
    const mimetype = file.mimetype || file.type;
    
    if (!mimetype || !allowedMimeTypes.includes(mimetype)) {
      // Clean up uploaded file
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed for portfolio logos.",
      });
    }

    // Validate file size (5MB max for logos)
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    // Get file size (handle different formidable versions)
    const fileSize = file.size || (file.filepath && fs.existsSync(file.filepath) ? fs.statSync(file.filepath).size : 0);

    if (fileSize > maxSize) {
      // Clean up uploaded file
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      return res.status(400).json({
        success: false,
        message: `File size exceeds limit. Maximum size: ${maxSize / (1024 * 1024)}MB`,
      });
    }

    // Ensure file has required properties
    const fileToSave = {
      filepath: file.filepath || file.path,
      originalFilename: file.originalFilename || file.name,
      mimetype: file.mimetype || file.type,
      size: file.size || (file.filepath && fs.existsSync(file.filepath) ? fs.statSync(file.filepath).size : 0),
    };
    
    // Save file
    const savedFile = await saveFile(
      fileToSave,
      "./uploads/portfolio-logos",
      user._id.toString()
    );

    // Generate file URL - include the full path from uploads directory
    // savedFile.name is like "users/{userId}/{fileName}"
    // But file is actually at "portfolio-logos/users/{userId}/{fileName}"
    // So we need to include "portfolio-logos" in the URL
    const fileUrl = `/api/uploads/portfolio-logos/${savedFile.name}`;

    res.json({
      success: true,
      message: "Portfolio logo uploaded successfully",
      data: {
        fileUrl,
        logoUrl: fileUrl, // Alias for compatibility
        url: fileUrl, // Alias for compatibility
        fileName: savedFile.name,
        fileType: savedFile.type,
        size: savedFile.size,
      },
    });
  } catch (error) {
    console.error("Upload portfolio logo error:", error);

    // Handle MongoDB connection errors
    const isMongoConnectionError =
      error.name === "MongooseServerSelectionError" ||
      error.name === "MongoServerSelectionError" ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect ECONNREFUSED") ||
      error.message?.includes("connection skipped");

    if (isMongoConnectionError) {
      return res.status(503).json({
        success: false,
        message:
          "Database service is currently unavailable. Please ensure MongoDB is running and try again.",
      });
    }

    // Handle form parsing errors
    if (error.message?.includes("parse") || error.message?.includes("form")) {
      return res.status(400).json({
        success: false,
        message:
          'Error parsing form data. Please ensure you are sending a file in the "file" field.',
      });
    }

    // If error already has a status code, use it
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message || "Error uploading portfolio logo",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Error uploading portfolio logo",
    });
  }
}

