import { handleCORS } from '../../lib/api-helpers.js';
import { protect } from '../../lib/auth.js';
import connectMongoDB from '../../lib/mongodb.js';
import CoinPurchase from '../../models/CoinPurchase.js';
import crypto from 'crypto';

/**
 * POST /api/payment/create-click
 * Create a Click payment. Returns redirect URL for Click (Uzbek so'm).
 * Body: { coins, amountUzs, returnUrl }
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const merchantId = process.env.CLICK_MERCHANT_ID;
  const serviceId = process.env.CLICK_SERVICE_ID;

  if (!merchantId || !serviceId) {
    return res.status(503).json({
      success: false,
      message: 'Click is not configured. Contact support.',
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

    const url = returnUrl && typeof returnUrl === 'string' ? returnUrl : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/buy-coins?success=1`;

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
      paymentProvider: 'click',
    });
    await purchase.save();

    const params = new URLSearchParams({
      merchant_id: merchantId,
      service_id: serviceId,
      amount: (a).toFixed(2), // Amount in so'm (e.g. 125000.00)
      transaction_param: orderId,
      return_url: url,
    });
    const paymentUrl = `https://my.click.uz/services/pay?${params.toString()}`;

    res.json({
      success: true,
      paymentUrl,
      orderId,
      coins: c,
      amountUzs: a,
    });
  } catch (error) {
    console.error('[create-click]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment',
    });
  }
}
