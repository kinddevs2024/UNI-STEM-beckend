import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 stateHash: { type: String, required: true, unique: true },
 direct: { type: Boolean, default: false },
 browserHash: { type: String, required: function () { return !this.direct; } },
 codeHash: { type: String, unique: true, sparse: true },
 userId: mongoose.Schema.Types.ObjectId,
 telegramId: String,
 status: { type: String, enum: ['pending','approved','consumed'], default: 'pending' },
 expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
export default mongoose.models.TelegramLogin || mongoose.model('TelegramLogin', schema);
