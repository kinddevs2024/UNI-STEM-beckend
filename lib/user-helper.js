import connectMongoDB from "./mongodb.js";
import User from "../models/User.js";

export async function getAllUsers() {
  await connectMongoDB();
  const users = await User.find({}).lean();
  return users.map((u) => ({ ...u, _id: u._id.toString() }));
}

export async function findUserById(id) {
  await connectMongoDB();
  const user = await User.findById(id).lean();
  if (!user) return null;
  return { ...user, _id: user._id.toString() };
}

export async function findUserByEmail(email) {
  await connectMongoDB();
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) return null;
  return { ...user, _id: user._id.toString() };
}

export async function createUser(userData) {
  await connectMongoDB();
  const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  const userRole = userData.role || "student";
  if (
    userRole !== "student" &&
    userRole !== "school-teacher" &&
    (userData.schoolName || userData.schoolId)
  ) {
    throw new Error(
      "School information (schoolName, schoolId) can only be provided for students or school-teacher"
    );
  }

  const user = await User.create({
    name: userData.name?.trim() || "",
    firstName: userData.firstName?.trim() || null,
    secondName: userData.secondName?.trim() || null,
    email: userData.email.toLowerCase().trim(),
    tel: userData.tel?.trim() || null,
    address: userData.address?.trim() || null,
    schoolName:
      userRole === "student" || userRole === "school-teacher"
        ? userData.schoolName?.trim() || null
        : null,
    schoolId:
      userRole === "student" || userRole === "school-teacher"
        ? userData.schoolId?.trim() || null
        : null,
    dateBorn: userData.dateBorn ? new Date(userData.dateBorn) : null,
    gender: userData.gender || null,
    userBan: userData.userBan || false,
    role: userRole,
    cookies: userData.cookies || null,
    userLogo: userData.userLogo?.trim() || null,
  });

  const doc = user.toObject();
  return { ...doc, _id: doc._id.toString() };
}

export async function updateUser(id, updates) {
  await connectMongoDB();
  const currentUser = await User.findById(id);
  if (!currentUser) {
    throw new Error("User not found");
  }

  const finalRole = updates.role !== undefined ? updates.role : currentUser.role;
  if (finalRole !== "student" && finalRole !== "school-teacher") {
    if (updates.schoolName !== undefined && updates.schoolName !== null) {
      throw new Error(
        "School information can only be provided for students or school-teacher"
      );
    }
    if (updates.schoolId !== undefined && updates.schoolId !== null) {
      throw new Error(
        "School information can only be provided for students or school-teacher"
      );
    }
    if (
      updates.role &&
      (currentUser.role === "student" || currentUser.role === "school-teacher")
    ) {
      updates.schoolName = null;
      updates.schoolId = null;
    }
  }

  Object.assign(currentUser, updates);
  await currentUser.save();

  const doc = currentUser.toObject();
  return { ...doc, _id: doc._id.toString() };
}

export async function findUserByIdWithoutPassword(id) {
  return findUserById(id);
}

export default {
  getAllUsers,
  findUserById,
  findUserByEmail,
  createUser,
  updateUser,
  findUserByIdWithoutPassword,
};
