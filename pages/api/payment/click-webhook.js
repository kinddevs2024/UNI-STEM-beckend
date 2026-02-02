import { handleCORS } from '../../../lib/api-helpers.js';
import connectMongoDB from '../../../lib/mongodb.js';
import User from '../../../models/User.js';
import CoinPurchase from '../../../models/CoinPurchase.js';
import crypto from 'crypto';

/**
 * POST /api/payment/click-webhook
 * Click Prepare/Complete callback. Register this URL in Click dashboard.
 * Requires: CLICK_SERVICE_ID, CLICK_SECRET_KEY
 */
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function verifySignPrepare(clickTransId, serviceId, clickPaydocId, merchantTransId, amount, action, signTime, signString) {
  const secret = process.env.CLICK_SECRET_KEY;
  const str = `${clickTransId}${serviceId}${secret}${merchantTransId}${amount}${action}${signTime}`;
  return md5(str) === signString;
}

function verifySignComplete(clickTransId, serviceId, clickPaydocId, merchantTransId, merchantPrepareId, amount, action, signTime, signString) {
  const secret = process.env.CLICK_SECRET_KEY;
  const str = `${clickTransId}${serviceId}${secret}${merchantTransId}${merchantPrepareId}${amount}${action}${signTime}`;
  return md5(str) === signString;
}

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const serviceId = process.env.CLICK_SERVICE_ID;
  const secretKey = process.env.CLICK_SECRET_KEY;

  if (!serviceId || !secretKey) {
    return res.status(503).send('error=8&error_note=Click not configured');
  }

  const body = req.body || {};
  const clickTransId = body.click_trans_id;
  const serviceIdParam = parseInt(body.service_id, 10);
  const clickPaydocId = body.click_paydoc_id;
  const merchantTransId = body.merchant_trans_id;
  const merchantPrepareId = body.merchant_prepare_id;
  const amount = parseFloat(body.amount);
  const action = parseInt(body.action, 10);
  const error = parseInt(body.error, 10);
  const errorNote = body.error_note || '';
  const signTime = body.sign_time || '';
  const signString = body.sign_string || '';

  if (!merchantTransId) {
    return res.status(400).send('error=-8&error_note=Invalid params');
  }

  try {
    await connectMongoDB();

    if (action === 0) {
      // Prepare
      const valid = verifySignPrepare(clickTransId, serviceIdParam, clickPaydocId, merchantTransId, amount, action, signTime, signString);
      if (!valid) {
        return res.status(400).send('error=-1&error_note=Bad sign');
      }

      const purchase = await CoinPurchase.findOne({ orderId: merchantTransId, status: 'pending' });
      if (!purchase) {
        return res.status(200).send('error=-5&error_note=Order not found');
      }

      const expectedAmount = purchase.amountUzs;
      if (Math.abs(parseFloat(amount) - expectedAmount) > 0.01) {
        return res.status(200).send('error=-2&error_note=Incorrect amount');
      }

      purchase.clickPrepareId = Date.now();
      await purchase.save();

      return res.status(200).send(`click_trans_id=${clickTransId}&merchant_trans_id=${merchantTransId}&merchant_prepare_id=${purchase.clickPrepareId}&error=0&error_note=Success`);
    }

    if (action === 1) {
      // Complete
      const valid = verifySignComplete(clickTransId, serviceIdParam, clickPaydocId, merchantTransId, merchantPrepareId, amount, action, signTime, signString);
      if (!valid) {
        return res.status(400).send('error=-1&error_note=Bad sign');
      }

      if (error !== 0) {
        return res.status(200).send(`click_trans_id=${clickTransId}&merchant_trans_id=${merchantTransId}&merchant_confirm_id=&error=-9&error_note=Cancelled`);
      }

      const purchase = await CoinPurchase.findOne({ orderId: merchantTransId, status: 'pending' });
      if (!purchase) {
        const paid = await CoinPurchase.findOne({ orderId: merchantTransId, status: 'paid' });
        if (paid) {
          return res.status(200).send(`click_trans_id=${clickTransId}&merchant_trans_id=${merchantTransId}&merchant_confirm_id=${merchantPrepareId}&error=0&error_note=Success`);
        }
        return res.status(200).send('error=-6&error_note=Transaction not found');
      }

      purchase.status = 'paid';
      await purchase.save();

      await User.findByIdAndUpdate(purchase.userId, {
        $inc: { coins: purchase.coins },
      });

      return res.status(200).send(`click_trans_id=${clickTransId}&merchant_trans_id=${merchantTransId}&merchant_confirm_id=${merchantPrepareId}&error=0&error_note=Success`);
    }

    return res.status(400).send('error=-8&error_note=Unknown action');
  } catch (err) {
    console.error('[click-webhook]', err);
    return res.status(500).send('error=-9&error_note=Internal error');
  }
}
