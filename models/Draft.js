import mongoose from 'mongoose';

const draftSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  olympiadId: {
    type: String,
    required: true,
    index: true
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

draftSchema.index({ userId: 1, olympiadId: 1 }, { unique: true });

const Draft = mongoose.models.Draft || mongoose.model('Draft', draftSchema);

export default Draft;
