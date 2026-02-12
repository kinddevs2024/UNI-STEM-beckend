import crypto from "crypto";
import connectMongoDB from "../../../lib/mongodb.js";
import { handleCORS } from "../../../lib/middleware/cors.js";
import User from "../../../models/User.js";
import { generateToken } from "../../../lib/auth.js";
import { findUserByIdWithoutPassword } from "../../../lib/user-helper.js";

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, token } = req.body || {};

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: "Email and token are required",
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

    if (user.emailVerified) {
      const token = generateToken(user._id.toString());
      const safeUser = await findUserByIdWithoutPassword(user._id.toString());
      return res.json({
        success: true,
        message: "Email is already verified",
        token,
        user: safeUser,
      });
    }

    if (!user.emailVerificationTokenHash || !user.emailVerificationExpires) {
      return res.status(400).json({
        success: false,
        message: "Email verification is not available for this account",
      });
    }

    if (user.emailVerificationExpires.getTime() < Date.now()) {
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpires = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Email verification token has expired",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    if (tokenHash !== user.emailVerificationTokenHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid email verification token",
      });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    const token = generateToken(user._id.toString());
    const safeUser = await findUserByIdWithoutPassword(user._id.toString());

    res.json({
      success: true,
      message: "Email has been verified successfully",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
}
