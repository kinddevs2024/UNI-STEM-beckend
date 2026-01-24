import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  olympiadId: {
    type: String,
    required: true
  },
  totalScore: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number, // Time in minutes
    default: 0
  },
  visible: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'pending', 'under-review', 'checked'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for faster queries
resultSchema.index({ userId: 1, olympiadId: 1 });
resultSchema.index({ olympiadId: 1, totalScore: -1 });

// Hook to trigger portfolio rating recalculation when result is created/updated
resultSchema.post('save', async function() {
  try {
    const { recalculatePortfolioRating } = await import('../lib/portfolio-rating.js');
    const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio');
    
    // Find all portfolios for this user
    const portfolios = await Portfolio.find({ 
      studentId: this.userId 
    }).select('_id');
    
    // Recalculate rating for each portfolio
    for (const portfolio of portfolios) {
      try {
        await recalculatePortfolioRating(portfolio._id);
      } catch (error) {
        console.error(`Error recalculating rating for portfolio ${portfolio._id}:`, error);
        // Continue with other portfolios even if one fails
      }
    }
  } catch (error) {
    console.error('Error in Result post-save hook:', error);
    // Don't throw - this is a background operation
  }
});

// Hook for findOneAndUpdate, updateOne, etc.
resultSchema.post('findOneAndUpdate', async function(doc) {
  if (!doc) return;
  
  try {
    const { recalculatePortfolioRating } = await import('../lib/portfolio-rating.js');
    const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio');
    
    const portfolios = await Portfolio.find({ 
      studentId: doc.userId 
    }).select('_id');
    
    for (const portfolio of portfolios) {
      try {
        await recalculatePortfolioRating(portfolio._id);
      } catch (error) {
        console.error(`Error recalculating rating for portfolio ${portfolio._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in Result post-findOneAndUpdate hook:', error);
  }
});

const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);

export default Result;

