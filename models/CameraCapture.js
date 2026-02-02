import mongoose from 'mongoose';

const cameraCaptureSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  olympiadId: {
    type: String,
    required: true
  },
  imagePath: {
    type: String,
    required: true
  },
  captureType: {
    type: String,
    enum: ['camera', 'screen', 'camera_exit', 'screen_exit', 'screenshot', 'both'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
cameraCaptureSchema.index({ userId: 1, olympiadId: 1, timestamp: -1 });

const CameraCapture = mongoose.models.CameraCapture || mongoose.model('CameraCapture', cameraCaptureSchema);

export default CameraCapture;

