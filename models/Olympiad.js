import mongoose from 'mongoose';

const olympiadSchema = new mongoose.Schema({
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
  totalPoints: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'active', 'completed'],
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

const Olympiad = mongoose.models.Olympiad || mongoose.model('Olympiad', olympiadSchema);

export default Olympiad;

