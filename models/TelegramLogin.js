import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 stateHash: { type: String, required: true, unique: true },
 browserHash: { type: String, required: true },
 codeHash: { type: String, unique: true, sparse: true },
 userId: mongoose.Schema.Types.ObjectId,
 telegramId: String,
 status: { type: String, enum: ['pending','approved','consumed'], default: 'pending' },
 expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
export default mongoose.models.TelegramLogin || mongoose.model('TelegramLogin', schema);
