import connectDB from "../../../lib/mongodb.js";
import CameraCapture from "../../../models/CameraCapture.js";
import { protect } from "../../../lib/auth.js";
import {
  parseForm,
  saveFile,
  config,
} from "../../../lib/upload.js";
import {
  readDB,
  writeDB,
  generateId,
  connectDB as connectJSONDB,
} from "../../../lib/json-db.js";

export { config };

/**
 * Exit Screenshot Upload Endpoint
 * POST /api/olympiads/exit-screenshot
 * 
 * Accepts screenshot images when a user leaves a tab or window,
 * saves them to user-specific folders and logs the event.
 * 
 * Request:
 *   Headers: Authorization: Bearer <token>
 *   Body (FormData):
 *     - cameraImage: File (optional)
 *     - screenImage: File (optional)
 *     - olympiadId: String
 *     - exitType: String ('tab_switch', 'close', 'navigate')
 *     - timestamp: String
 *     - username: String (optional)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "message": "Exit screenshot uploaded successfully"
 *   }
 */
export default async function handler(req, res) {
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

    // Try to connect to MongoDB, fallback to JSON DB if it fails
    let useMongoDB = false;
    try {
      await connectDB();
      useMongoDB = true;
    } catch (mongoError) {
      const isMongoConnectionError =
        mongoError.name === "MongooseServerSelectionError" ||
        mongoError.name === "MongoServerSelectionError" ||
        mongoError.message?.includes("ECONNREFUSED") ||
        mongoError.message?.includes("connect ECONNREFUSED") ||
        mongoError.message?.includes("connection skipped");

      if (isMongoConnectionError) {
        const now = Date.now();
        if (!global.lastMongoWarning || now - global.lastMongoWarning > 60000) {
          console.warn("⚠️ MongoDB unavailable, using JSON database fallback");
          global.lastMongoWarning = now;
        }
        await connectJSONDB();
        useMongoDB = false;
      } else {
        throw mongoError;
      }
    }

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

    const { olympiadId, exitType, timestamp, username } = fields || {};
    
    // Get image files
    const cameraImage = Array.isArray(files.cameraImage) ? files.cameraImage[0] : files.cameraImage;
    const screenImage = Array.isArray(files.screenImage) ? files.screenImage[0] : files.screenImage;

    if (!cameraImage && !screenImage) {
      return res.status(400).json({
        success: false,
        message: "At least one screenshot (camera or screen) is required",
      });
    }

    // Get user ID for folder organization
    const userId = authResult.user._id.toString();
    const userIdentifier = username || userId;

    // Save screenshots
    const savedFiles = [];
    
    if (cameraImage) {
      try {
        const savedCamera = await saveFile(
          cameraImage,
          process.env.UPLOAD_PATH || "./uploads",
          userId
        );
        savedFiles.push({ type: 'camera', file: savedCamera });
      } catch (err) {
        console.error("Error saving camera screenshot:", err);
      }
    }

    if (screenImage) {
      try {
        const savedScreen = await saveFile(
          screenImage,
          process.env.UPLOAD_PATH || "./uploads",
          userId
        );
        savedFiles.push({ type: 'screen', file: savedScreen });
      } catch (err) {
        console.error("Error saving screen screenshot:", err);
      }
    }

    // Store metadata in database
    if (useMongoDB) {
      // Use MongoDB
      for (const saved of savedFiles) {
        await CameraCapture.create({
          userId: authResult.user._id,
          olympiadId: olympiadId?.toString() || null,
          imagePath: saved.file.relativePath || saved.file.path,
          captureType: saved.type === 'camera' ? 'camera_exit' : 'screen_exit',
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          metadata: {
            exitType: exitType || 'unknown',
            trigger: 'exit_detection'
          }
        });
      }
    } else {
      // Use JSON DB as fallback
      const captures = readDB("cameraCaptures");
      for (const saved of savedFiles) {
        const capture = {
          _id: generateId(),
          userId: userId,
          olympiadId: olympiadId?.toString() || null,
          imagePath: saved.file.relativePath || saved.file.path,
          captureType: saved.type === 'camera' ? 'camera_exit' : 'screen_exit',
          username: userIdentifier,
          timestamp: timestamp || new Date().toISOString(),
          exitType: exitType || 'unknown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        captures.push(capture);
      }
      writeDB("cameraCaptures", captures);
    }

    // Return success response
    res.json({
      success: true,
      message: "Exit screenshots uploaded successfully",
      count: savedFiles.length,
      storage: useMongoDB ? "mongodb" : "json",
    });
  } catch (error) {
    console.error("Exit screenshot upload error:", error);
    
    // Check if it's a MongoDB connection error
    const isMongoConnectionError =
      error.name === "MongooseServerSelectionError" ||
      error.name === "MongoServerSelectionError" ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect ECONNREFUSED");

    if (isMongoConnectionError) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred",
    });
  }
}
