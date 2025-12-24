import formidable from "formidable";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  api: {
    bodyParser: false,
  },
};

export const parseForm = (req, uploadDir = "./uploads") => {
  return new Promise((resolve, reject) => {
    // Create upload directory if it doesn't exist
    const uploadPath = path.join(process.cwd(), uploadDir);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const form = formidable({
      uploadDir: uploadPath,
      keepExtensions: true,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "104857600"), // 100MB default (for videos)
      multiples: true, // Allow multiple files for image sequences
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error("Formidable parse error:", err);
        reject(err);
        return;
      }
      
      // Handle formidable v3+ structure where files might be File objects
      // Convert File objects to the expected format
      const normalizedFiles = {};
      for (const [key, value] of Object.entries(files)) {
        if (Array.isArray(value)) {
          normalizedFiles[key] = value.map(file => {
            // If it's already a File object with the expected structure, use it
            if (file.filepath || file.path) {
              return file;
            }
            // Otherwise, it might be a File object from formidable v3
            return {
              filepath: file.filepath || file.path,
              originalFilename: file.originalFilename || file.name,
              mimetype: file.mimetype || file.type,
              size: file.size,
            };
          });
        } else if (value) {
          // Single file
          if (value.filepath || value.path) {
            normalizedFiles[key] = value;
          } else {
            // File object from formidable v3
            normalizedFiles[key] = {
              filepath: value.filepath || value.path,
              originalFilename: value.originalFilename || value.name,
              mimetype: value.mimetype || value.type,
              size: value.size,
            };
          }
        }
      }
      
      resolve({ fields, files: normalizedFiles });
    });
  });
};

/**
 * Process video file: resize to 720p and convert to MP4
 */
export const processVideo = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .videoBitrate("1000k")
      .audioBitrate("128k")
      .format("mp4")
      .outputOptions([
        "-preset fast",
        "-crf 23",
        "-movflags +faststart", // Enable fast start for web playback
        "-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", // Resize to 720p maintaining aspect ratio
      ])
      .on("start", (commandLine) => {
        console.log("Video processing started:", commandLine);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${Math.round(progress.percent)}% done`);
        }
      })
      .on("end", () => {
        console.log("Video processing finished");
        resolve();
      })
      .on("error", (err) => {
        console.error("Video processing error:", err);
        reject(err);
      })
      .save(outputPath);
  });
};

/**
 * Check if file is a video
 */
export const isVideoFile = (mimetype) => {
  return mimetype && mimetype.startsWith("video/");
};

export const saveFile = async (file, destination, userId = null) => {
  let uploadPath = path.join(process.cwd(), destination);

  // If userId is provided, create user-specific folder
  if (userId) {
    uploadPath = path.join(uploadPath, "users", userId.toString());
  }

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const originalFileName = file.originalFilename || file.name;
  const fileExtension = path.extname(originalFileName);
  const baseFileName = path.basename(originalFileName, fileExtension);

  // For videos, always use .mp4 extension
  const finalExtension = isVideoFile(file.mimetype) ? ".mp4" : fileExtension;
  const fileName = `${Date.now()}-${baseFileName}${finalExtension}`;
  const filePath = path.join(uploadPath, fileName);

  // If it's a video file, process it first
  if (isVideoFile(file.mimetype)) {
    try {
      // Move uploaded file to temp location
      const tempPath = filePath + ".tmp";
      if (fs.existsSync(file.filepath)) {
        fs.renameSync(file.filepath, tempPath);
      } else {
        throw new Error("Uploaded file not found at: " + file.filepath);
      }

      // Process video: resize to 720p and convert to MP4
      await processVideo(tempPath, filePath);

      // Delete temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      // Verify processed file exists
      if (!fs.existsSync(filePath)) {
        throw new Error("Processed video file was not created");
      }

      // Get file size after processing
      const stats = fs.statSync(filePath);

      // Return relative path for database storage (relative to base uploads directory)
      const baseUploadsPath = path.join(process.cwd(), destination);
      const relativePath = path
        .relative(baseUploadsPath, filePath)
        .replace(/\\/g, "/");

      return {
        path: filePath,
        relativePath: relativePath,
        name: userId ? `users/${userId}/${fileName}` : fileName,
        size: stats.size,
        type: "video/mp4",
        processed: true,
      };
    } catch (error) {
      console.error("Error processing video:", error);
      // If processing fails, save original file as fallback
      try {
        if (fs.existsSync(file.filepath)) {
          fs.renameSync(file.filepath, filePath);
        } else if (fs.existsSync(filePath + ".tmp")) {
          // If original was moved to temp, restore it
          fs.renameSync(filePath + ".tmp", filePath);
        }
        
        // If file exists now, return it even though processing failed
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const baseUploadsPath = path.join(process.cwd(), destination);
          const relativePath = path
            .relative(baseUploadsPath, filePath)
            .replace(/\\/g, "/");
          
          console.warn("Video processing failed, saved original file instead");
          return {
            path: filePath,
            relativePath: relativePath,
            name: userId ? `users/${userId}/${fileName}` : fileName,
            size: stats.size,
            type: file.mimetype,
            processed: false,
          };
        }
      } catch (fallbackError) {
        console.error("Error in fallback file save:", fallbackError);
      }
      
      throw new Error(`Video processing failed: ${error.message}`);
    }
  } else {
    // For non-video files, just move to destination
    fs.renameSync(file.filepath, filePath);

    // Return relative path for database storage (relative to base uploads directory)
    const baseUploadsPath = path.join(process.cwd(), destination);
    const relativePath = path
      .relative(baseUploadsPath, filePath)
      .replace(/\\/g, "/");

    return {
      path: filePath,
      relativePath: relativePath,
      name: userId ? `users/${userId}/${fileName}` : fileName,
      size: file.size,
      type: file.mimetype,
      processed: false,
    };
  }
};
