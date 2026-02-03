import { connectDB } from "../../../../lib/json-db.js";
import {
  findOlympiadById,
  updateOlympiad,
} from "../../../../lib/olympiad-helper.js";
import { protect } from "../../../../lib/auth.js";
import { authorize } from "../../../../lib/auth.js";
import { handleCORS } from "../../../../middleware/cors.js";
import { parseForm, saveFile, config } from "../../../../lib/upload.js";
import { getUploadBaseDir } from "../../../../lib/upload-path.js";
import fs from "fs";
import path from "path";

export { config };

/**
 * Upload Olympiad Logo
 * POST /api/admin/olympiads/upload-logo
 *
 * Accepts image file upload for olympiad logo,
 * saves it to olympiad-specific folder and updates olympiad.
 *
 * Request:
 *   Headers: Authorization: Bearer <token>
 *   Body (FormData):
 *     - logo: File (Image file - PNG, JPG, JPEG, GIF, WEBP)
 *     - olympiadId: String (required)
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Olympiad logo uploaded successfully",
 *     "fileUrl": "/api/uploads/olympiads/olympiad123/logo-xyz.jpg",
 *     "olympiadLogo": "/api/uploads/olympiads/olympiad123/logo-xyz.jpg"
 *   }
 */
export default async function handler(req, res) {
  // Handle CORS preflight
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

    // Check if user is admin or owner
    const roleError = authorize("admin", "owner")(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
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

    // Get olympiadId from query params or form fields
    const olympiadId = req.query.olympiadId || fields?.olympiadId;

    if (!olympiadId) {
      return res.status(400).json({
        success: false,
        message: "Please provide olympiadId (as query parameter or form field)",
        queryParams: req.query,
        formFields: fields ? Object.keys(fields) : [],
      });
    }

    // Verify olympiad exists
    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({
        success: false,
        message: "Olympiad not found",
        olympiadId: olympiadId,
      });
    }

    // Get the logo file - handle various ways files might be structured
    let logoFile = null;

    if (files) {
      if (files.logo) {
        logoFile = Array.isArray(files.logo) ? files.logo[0] : files.logo;
      } else if (files.image) {
        logoFile = Array.isArray(files.image) ? files.image[0] : files.image;
      } else if (files.photo) {
        logoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;
      } else if (files.file) {
        logoFile = Array.isArray(files.file) ? files.file[0] : files.file;
      }
    }

    if (!logoFile) {
      return res.status(400).json({
        success: false,
        message:
          'Please upload a logo file. Use form field name: "logo", "image", "photo", or "file"',
        receivedFiles: files ? Object.keys(files) : [],
        receivedFields: fields ? Object.keys(fields) : [],
        hasFiles: !!files,
        filesStructure: files,
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

    // Get mimetype from various possible locations
    const fileMimetype =
      logoFile.mimetype || logoFile.type || logoFile.contentType;
    const fileMimetypeLower = fileMimetype ? fileMimetype.toLowerCase() : null;

    // Also check file extension as fallback
    const originalFileName = logoFile.originalFilename || logoFile.name || "";
    const fileExtension = path.extname(originalFileName).toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    const isValidMimetype =
      fileMimetypeLower && imageMimeTypes.includes(fileMimetypeLower);
    const isValidExtension = validExtensions.includes(fileExtension);

    if (!isValidMimetype && !isValidExtension) {
      return res.status(400).json({
        success: false,
        message: "File must be an image (JPEG, PNG, GIF, or WEBP).",
        details: {
          receivedMimetype: fileMimetype || "unknown",
          receivedExtension: fileExtension || "unknown",
          fileName: originalFileName,
        },
      });
    }

    // Check file size (max 5MB for logos)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (logoFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }

    // Delete old logo file if it exists
    if (olympiad.olympiadLogo) {
      try {
        // Extract the file path from the URL
        // olympiadLogo could be: "/api/uploads/olympiads/olympiad123/logo.jpg" or "olympiads/olympiad123/logo.jpg"
        let filePath = olympiad.olympiadLogo;
        if (filePath.startsWith("/api/uploads/")) {
          filePath = filePath.replace("/api/uploads/", "");
        }
        const uploadsBaseDir = getUploadBaseDir(process.env.UPLOAD_PATH || "./uploads");
        const oldLogoPath = path.join(uploadsBaseDir, filePath);
        const normalizedOldPath = path.normalize(oldLogoPath);
        const uploadsDir = path.normalize(uploadsBaseDir);

        // Security check: ensure path is within uploads directory
        if (
          normalizedOldPath.startsWith(uploadsDir) &&
          fs.existsSync(normalizedOldPath)
        ) {
          fs.unlinkSync(normalizedOldPath);
        }
      } catch (deleteError) {
        console.warn(
          "Could not delete old olympiad logo file:",
          deleteError.message
        );
        // Continue even if deletion fails
      }
    }

    // Save the new logo file to olympiad-specific folder
    let savedFile;
    let fileUrl;
    try {
      // Create olympiad-specific folder: uploads/olympiads/{olympiadId}/
      const uploadsBasePath = getUploadBaseDir(process.env.UPLOAD_PATH || "./uploads");
      const olympiadFolder = path.join(uploadsBasePath, "olympiads", olympiadId);

      // Create directory if it doesn't exist
      if (!fs.existsSync(olympiadFolder)) {
        fs.mkdirSync(olympiadFolder, { recursive: true });
      }

      // Generate filename (use fileExtension from validation above)
      const fileExt = fileExtension || ".png";
      const baseFileName = path.basename(originalFileName, fileExt) || "logo";
      const fileName = `${Date.now()}-${baseFileName}${fileExt}`;
      const filePath = path.join(olympiadFolder, fileName);

      // Move the uploaded file to the destination
      if (fs.existsSync(logoFile.filepath)) {
        fs.renameSync(logoFile.filepath, filePath);
      } else {
        // If filepath doesn't exist, copy the file
        fs.copyFileSync(logoFile.filepath, filePath);
      }

      // Generate relative path for URL
      const relativePath = `olympiads/${olympiadId}/${fileName}`;
      fileUrl = `/api/uploads/${relativePath}`;

      savedFile = {
        name: relativePath,
        path: filePath,
        size: logoFile.size,
      };
    } catch (saveError) {
      console.error("Error saving olympiad logo:", saveError);
      return res.status(500).json({
        success: false,
        message: "Error saving logo: " + saveError.message,
      });
    }

    // Update olympiad's olympiadLogo field
    try {
      updateOlympiad(olympiadId, { olympiadLogo: fileUrl });
    } catch (updateError) {
      console.error("Error updating olympiad logo:", updateError);
      // Try to delete the uploaded file if olympiad update fails
      try {
        if (fs.existsSync(savedFile.path)) {
          fs.unlinkSync(savedFile.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up uploaded file:", cleanupError);
      }
      return res.status(500).json({
        success: false,
        message:
          "Logo uploaded but failed to update olympiad: " + updateError.message,
      });
    }

    res.json({
      success: true,
      message: "Olympiad logo uploaded successfully",
      fileUrl: fileUrl,
      olympiadLogo: fileUrl,
      filename: savedFile.name,
    });
  } catch (error) {
    console.error("Upload olympiad logo error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload olympiad logo",
    });
  }
}
