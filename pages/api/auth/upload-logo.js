import { connectDB } from '../../../lib/json-db.js';
import { findUserById, updateUser } from '../../../lib/user-helper.js';
import { protect } from '../../../lib/auth.js';
import { handleCORS } from '../../../middleware/cors.js';
import {
  parseForm,
  saveFile,
  config,
} from '../../../lib/upload.js';
import fs from 'fs';
import path from 'path';

export { config };

/**
 * Upload User Logo/Photo
 * POST /api/auth/upload-logo
 * 
 * Accepts image file upload for user profile logo,
 * saves it to user-specific folder and updates user profile.
 * 
 * Request:
 *   Headers: Authorization: Bearer <token>
 *   Body (FormData):
 *     - logo: File (Image file - PNG, JPG, JPEG, GIF, WEBP)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "message": "Logo uploaded successfully",
 *     "fileUrl": "/api/uploads/users/user123/logo-xyz.jpg",
 *     "userLogo": "/api/uploads/users/user123/logo-xyz.jpg"
 *   }
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
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
      console.error('Error parsing form data:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Error parsing form data: ' + parseError.message,
      });
    }

    // Get the logo file
    const logoFile = Array.isArray(files.logo) 
      ? files.logo[0] 
      : files.logo || files.image || files.photo;

    if (!logoFile) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a logo file. Use form field name: "logo", "image", or "photo"',
        receivedFiles: files ? Object.keys(files) : [],
      });
    }

    // Verify it's an image file
    const imageMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!imageMimeTypes.includes(logoFile.mimetype?.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'File must be an image (JPEG, PNG, GIF, or WEBP). Received: ' + (logoFile.mimetype || 'unknown'),
      });
    }

    // Check file size (max 5MB for profile pictures)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (logoFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB',
      });
    }

    // Get current user
    const userId = authResult.user._id.toString();
    const currentUser = await findUserById(userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete old logo file if it exists
    if (currentUser.userLogo) {
      try {
        // Extract the file path from the URL
        // userLogo could be: "/api/uploads/users/user123/logo.jpg" or "users/user123/logo.jpg"
        let filePath = currentUser.userLogo;
        if (filePath.startsWith('/api/uploads/')) {
          filePath = filePath.replace('/api/uploads/', '');
        }
        const oldLogoPath = path.join(process.cwd(), 'uploads', filePath);
        const normalizedOldPath = path.normalize(oldLogoPath);
        const uploadsDir = path.normalize(path.join(process.cwd(), 'uploads'));
        
        // Security check: ensure path is within uploads directory
        if (normalizedOldPath.startsWith(uploadsDir) && fs.existsSync(normalizedOldPath)) {
          fs.unlinkSync(normalizedOldPath);
        }
      } catch (deleteError) {
        console.warn('Could not delete old logo file:', deleteError.message);
        // Continue even if deletion fails
      }
    }

    // Save the new logo file
    let savedFile;
    try {
      savedFile = await saveFile(
        logoFile,
        process.env.UPLOAD_PATH || './uploads',
        userId
      );
    } catch (saveError) {
      console.error('Error saving logo:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Error saving logo: ' + saveError.message,
      });
    }

    // Generate file URL for accessing the file
    const fileUrl = `/api/uploads/${savedFile.name}`;

    // Update user's userLogo field
    try {
      updateUser(userId, { userLogo: fileUrl });
    } catch (updateError) {
      console.error('Error updating user logo:', updateError);
      // Try to delete the uploaded file if user update fails
      try {
        if (fs.existsSync(savedFile.path)) {
          fs.unlinkSync(savedFile.path);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
      return res.status(500).json({
        success: false,
        message: 'Logo uploaded but failed to update user profile: ' + updateError.message,
      });
    }

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      fileUrl: fileUrl,
      userLogo: fileUrl,
      filename: savedFile.name,
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo',
    });
  }
}

