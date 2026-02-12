import crypto from "crypto";
import bcrypt from "bcryptjs";
import connectMongoDB from "../../../lib/mongodb.js";
import { handleCORS } from "../../../middleware/cors.js";
import User from "../../../models/User.js";

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, token, password } = req.body || {};

    if (!email || !token || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, token, and password are required",
      });
    }

    await connectMongoDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.passwordResetTokenHash || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: "Password reset is not available for this account",
      });
    }

    if (user.passwordResetExpires.getTime() < Date.now()) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpires = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Password reset token has expired",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    if (tokenHash !== user.passwordResetTokenHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid password reset token",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({
      success: true,
      message: "Password has been set successfully",
    });
  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set password",
    });
  }
}
