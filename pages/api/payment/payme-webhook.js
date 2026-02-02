import { handleCORS } from '../../lib/api-helpers.js';
import connectMongoDB from '../../lib/mongodb.js';
import User from '../../models/User.js';
import CoinPurchase from '../../models/CoinPurchase.js';

/**
 * POST /api/payment/payme-webhook
 * Payme Merchant API callback (JSON-RPC 2.0).
 * Register this URL in Payme Business dashboard.
 * Requires: PAYME_MERCHANT_ID, PAYME_SECRET_KEY
 */
function parseAuthHeader(auth) {
  if (!auth || !auth.startsWith('Basic ')) return null;
  try {
    const b64 = auth.slice(6);
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const [id, key] = decoded.split(':');
    return { id, key };
  } catch {
    return null;
  }
}

function sendJsonRpc(res, id, result, error) {
  const body = error
    ? { jsonrpc: '2.0', id, error }
    : { jsonrpc: '2.0', id, result };
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(body);
}

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const merchantId = process.env.PAYME_MERCHANT_ID;
  const secretKey = process.env.PAYME_SECRET_KEY;

  if (!merchantId || !secretKey) {
    return res.status(503).json({
      jsonrpc: '2.0',
      error: { code: -31008, message: 'Payme not configured' },
      id: req.body?.id ?? null,
    });
  }

  const auth = parseAuthHeader(req.headers.authorization);
  if (!auth || auth.id !== merchantId || auth.key !== secretKey) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32504, message: 'Unauthorized' },
      id: req.body?.id ?? null,
    });
  }

  const { method, params, id } = req.body || {};

  if (!method || id === undefined) {
    return sendJsonRpc(res, id, null, { code: -32600, message: 'Invalid request' });
  }

  const account = params?.account || {};
  const orderId = account.order_id;

  try {
    await connectMongoDB();

    if (method === 'CheckPerformTransaction') {
      const amount = parseInt(params?.amount, 10);
      if (!orderId || !amount) {
        return sendJsonRpc(res, id, null, { code: -31050, message: { uz: 'Invalid params', ru: 'Invalid params', en: 'Invalid params' } });
      }
      const purchase = await CoinPurchase.findOne({ orderId, status: 'pending' });
      if (!purchase) {
        return sendJsonRpc(res, id, null, { code: -31050, message: { uz: 'Order not found', ru: 'Order not found', en: 'Order not found' } });
      }
      if (purchase.amountTiyin !== amount) {
        return sendJsonRpc(res, id, null, { code: -31001, message: { uz: 'Amount mismatch', ru: 'Amount mismatch', en: 'Amount mismatch' } });
      }
      return sendJsonRpc(res, id, { allow: true });
    }

    if (method === 'PerformTransaction') {
      const amount = parseInt(params?.amount, 10);
      const transId = params?.id;
      const time = params?.time;

      if (!orderId || !amount || !transId) {
        return sendJsonRpc(res, id, null, { code: -31050, message: { uz: 'Invalid params', ru: 'Invalid params', en: 'Invalid params' } });
      }

      const purchase = await CoinPurchase.findOne({ orderId, status: 'pending' });
      if (!purchase) {
        return sendJsonRpc(res, id, null, { code: -31050, message: { uz: 'Order not found', ru: 'Order not found', en: 'Order not found' } });
      }
      if (purchase.amountTiyin !== amount) {
        return sendJsonRpc(res, id, null, { code: -31001, message: { uz: 'Amount mismatch', ru: 'Amount mismatch', en: 'Amount mismatch' } });
      }

      purchase.paymeTransactionId = String(transId);
      await purchase.save();

      return sendJsonRpc(res, id, {
        transaction: String(transId),
        state: 1,
        create_time: time || Math.floor(Date.now() / 1000),
      });
    }

    if (method === 'CompleteTransaction') {
      const transId = params?.id;

      if (!transId) {
        return sendJsonRpc(res, id, null, { code: -31050, message: { uz: 'Invalid params', ru: 'Invalid params', en: 'Invalid params' } });
      }

      const purchase = await CoinPurchase.findOne({ paymeTransactionId: String(transId), status: 'pending' });
      if (!purchase) {
        return sendJsonRpc(res, id, null, { code: -31008, message: { uz: 'Transaction not found', ru: 'Transaction not found', en: 'Transaction not found' } });
      }

      purchase.status = 'paid';
      await purchase.save();

      await User.findByIdAndUpdate(purchase.userId, {
        $inc: { coins: purchase.coins },
      });

      return sendJsonRpc(res, id, {
        transaction: String(transId),
        state: 2,
        perform_time: Math.floor(Date.now() / 1000),
      });
    }

    if (method === 'CancelTransaction') {
      const transId = params?.id;
      const reason = params?.reason;

      if (!transId) {
        return sendJsonRpc(res, id, null, { code: -31050, message: { uz: 'Invalid params', ru: 'Invalid params', en: 'Invalid params' } });
      }

      const purchase = await CoinPurchase.findOne({ paymeTransactionId: String(transId) });
      if (purchase) {
        if (purchase.status === 'paid') {
          return sendJsonRpc(res, id, null, { code: -31007, message: { uz: 'Already completed', ru: 'Already completed', en: 'Already completed' } });
        }
        purchase.status = 'cancelled';
        await purchase.save();
      }

      return sendJsonRpc(res, id, {
        transaction: String(transId),
        state: -1,
        cancel_time: Math.floor(Date.now() / 1000),
      });
    }

    return sendJsonRpc(res, id, null, { code: -32601, message: 'Method not found' });
  } catch (error) {
    console.error('[payme-webhook]', error);
    return sendJsonRpc(res, id, null, { code: -31099, message: { uz: 'Internal error', ru: 'Internal error', en: 'Internal error' } });
  }
}
