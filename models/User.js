import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  gradeCategory: { type: String, enum: ['5','6','7','8','9','10','11','student',null], default: null },
  ticketActivatedAt: {type:Date,default:null},
  username: {type:String, lowercase:true, trim:true, unique:true, sparse:true},
  adminCreated: {type:Boolean, default:false},
  mustChangePassword: {type:Boolean, default:false},
  temporaryPasswordEncrypted: {type:String, select:false},
  googleId: { type: String, unique: true, sparse: true },
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
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
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
  coinEntries: [{ _id: false, olympiadId: String, chargeId: String, coins: Number, chargedAt: Date, state: String }],
  coinRewards: [{ _id: false, olympiadId: String, coins: Number, awardedAt: Date }],
  coinCredits: [{ _id: false, requestId: String, coins: Number, actorId: String, createdAt: Date }],
  coins: {
    type: Number,
    default: 0,
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
  },
  passwordResetCodeSentAt: {
    type: Date,
    default: null
  },
  passwordResetFailedAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationTokenHash: {
    type: String,
    trim: true,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  emailVerificationCodeSentAt: {
    type: Date,
    default: null
  },
  emailVerificationFailedAttempts: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});


const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

