import { handleCORS } from '../../../lib/api-helpers.js';
import { protect } from '../../../lib/auth.js';
import connectMongoDB from '../../../lib/mongodb.js';
import User from '../../../models/User.js';
import CoinPurchase from '../../../models/CoinPurchase.js';
import crypto from 'crypto';

/**
 * POST /api/payment/create-payme
 * Create a Payme payment session. Returns checkout URL for Payme (Uzbek so'm).
 * Body: { coins, amountUzs, returnUrl }
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const merchantId = process.env.PAYME_MERCHANT_ID;
  if (!merchantId) {
    return res.status(503).json({
      success: false,
      message: 'Payme is not configured. Contact support.',
    });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ success: false, message: authResult.error });
    }

    const { coins, amountUzs, returnUrl } = req.body || {};
    const c = parseInt(coins, 10);
    const a = parseInt(amountUzs, 10);

    if (!c || c < 1 || c > 9999) {
      return res.status(400).json({ success: false, message: 'Invalid coins amount' });
    }
    if (!a || a < 1000) {
      return res.status(400).json({ success: false, message: 'Invalid amount (UZS)' });
    }

    const url = returnUrl && typeof returnUrl === 'string' ? returnUrl : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/buy-coins`;

    await connectMongoDB();

    const orderId = `coin_${authResult.user._id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const amountTiyin = a * 100;

    const purchase = new CoinPurchase({
      userId: authResult.user._id,
      coins: c,
      amountUzs: a,
      amountTiyin,
      status: 'pending',
      orderId,
    });
    await purchase.save();

    const params = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin};c=${encodeURIComponent(url)};l=uz`;
    const base64 = Buffer.from(params, 'utf8').toString('base64');
    const paymentUrl = `https://checkout.paycom.uz/${base64}`;

    res.json({
      success: true,
      paymentUrl,
      orderId,
      coins: c,
      amountUzs: a,
    });
  } catch (error) {
    console.error('[create-payme]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment',
    });
  }
}
