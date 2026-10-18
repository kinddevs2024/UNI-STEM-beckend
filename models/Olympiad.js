import mongoose from 'mongoose';

const olympiadSchema = new mongoose.Schema({
  gradePrizes: [{ _id: false, gradeCategory: { type: String, enum: ['5','6','7','8','9','10','11','student'], required: true }, place: { type: Number, required: true, min: 1 }, name: { type: String, required: true, maxlength: 160 }, photo: { type: String, default: '' } }],
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  type: {
    type: String,
    enum: ['test', 'essay', 'mixed'],
    default: 'test'
  },
  subject: {
    type: String,
    required: [true, 'Please add a subject'],
    trim: true
  },
  startTime: {
    type: Date,
    required: [true, 'Please add a start time']
  },
  endTime: {
    type: Date,
    required: [true, 'Please add an end time']
  },
  duration: {
    type: Number, // Duration in seconds
    required: [true, 'Please add duration']
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  entryFeeCoins: { type: Number, default: 50, min: 0, max: 1000000, validate: Number.isInteger },
  coinRewardsEnabled: { type: Boolean, default: true },
  coinReward: { userId: String, coins: Number, awardedAt: Date },
  totalPoints: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    // Keep backward compatibility with existing status values used across API/front-end
    enum: ['draft', 'unvisible', 'visible', 'published', 'upcoming', 'active', 'completed'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerUniversityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  olympiadLogo: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for status + startTime (admin listing, active olympiads)
olympiadSchema.index({ status: 1, startTime: 1 });

// Calculate total points before saving
olympiadSchema.pre('save', async function(next) {
  if (this.isModified('questions') && this.questions.length > 0) {
    await this.populate('questions');
    this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  }
  
  // Auto-populate ownerUniversityId if createdBy is a university user
  if (this.isModified('createdBy') && this.createdBy && !this.ownerUniversityId) {
    try {
      const User = mongoose.models.User || mongoose.model('User');
      const creator = await User.findById(this.createdBy);
      if (creator && creator.role === 'university') {
        this.ownerUniversityId = creator._id;
      }
    } catch (error) {
      // Continue if user lookup fails
      console.error('Error setting ownerUniversityId:', error);
    }
  }
  
  next();
});

// In dev, drop the cached model to allow schema updates (e.g. enum changes)
if (process.env.NODE_ENV !== 'production' && mongoose.models.Olympiad) {
  delete mongoose.models.Olympiad;
}

const Olympiad = mongoose.models.Olympiad || mongoose.model('Olympiad', olympiadSchema);

export default Olympiad;
