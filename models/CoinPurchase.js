import mongoose from 'mongoose';

const coinPurchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coins: {
    type: Number,
    required: true,
    min: 1
  },
  amountUzs: {
    type: Number,
    required: true,
    min: 0
  },
  amountTiyin: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymeTransactionId: {
    type: String,
    trim: true
  },
  paymentProvider: {
    type: String,
    enum: ['payme', 'click'],
    trim: true
  },
  clickPrepareId: {
    type: Number
  },
  orderId: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true
});

coinPurchaseSchema.index({ userId: 1, status: 1 });
coinPurchaseSchema.index({ orderId: 1 });
coinPurchaseSchema.index({ paymeTransactionId: 1 });

export default mongoose.models.CoinPurchase || mongoose.model('CoinPurchase', coinPurchaseSchema);
