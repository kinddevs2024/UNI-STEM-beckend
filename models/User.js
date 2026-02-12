import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  secondName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  tel: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  schoolName: {
    type: String,
    trim: true
  },
  schoolId: {
    type: String,
    trim: true
  },
  dateBorn: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    trim: true
  },
  userBan: {
    type: Boolean,
    default: false
  },
    role: {
      type: String,
      enum: ['student', 'admin', 'owner', 'resolter', 'school-admin', 'school-teacher', 'university', 'checker'],
      default: 'student'
    },
  cookies: {
    type: String,
    trim: true
  },
  userLogo: {
    type: String,
    trim: true
  },
  coins: {
    type: Number,
    default: 100,
    min: 0
  },
  passwordHash: {
    type: String,
    trim: true,
    default: null
  },
  passwordResetTokenHash: {
    type: String,
    trim: true,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});


const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

