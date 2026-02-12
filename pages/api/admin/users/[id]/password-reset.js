import crypto from "crypto";
import connectMongoDB from "../../../../../lib/mongodb.js";
import { protect, authorize } from "../../../../../lib/auth.js";
import { handleCORS } from "../../../../../lib/api-helpers.js";
import User from "../../../../../models/User.js";

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

    const roleError = authorize("admin", "owner")(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
      });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User id is required",
      });
    }

    await connectMongoDB();
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { force } = req.body || {};
    if (user.passwordHash && !force) {
      return res.status(400).json({
        success: false,
        message: "User already has a password. Use force to reset.",
      });
    }

    const rawToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    res.json({
      success: true,
      token: rawToken,
      expiresAt: user.passwordResetExpires,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Admin password reset token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create password reset token",
    });
  }
}
