import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  olympiadId: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: [true, 'Please add a question']
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'essay'],
    required: [true, 'Please specify question type']
  },
  options: {
    type: [String],
    required: function() {
      return this.type === 'multiple-choice';
    }
  },
  correctAnswer: {
    type: String,
    required: function() {
      return this.type === 'multiple-choice';
    }
  },
  points: {
    type: Number,
    required: [true, 'Please add points'],
    default: 1
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);

export default Question;

