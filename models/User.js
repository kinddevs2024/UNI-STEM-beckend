import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
  gmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid Gmail address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
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
  profile: {
    avatar: String,
    phone: String,
    institution: String
  },
  userLogo: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

