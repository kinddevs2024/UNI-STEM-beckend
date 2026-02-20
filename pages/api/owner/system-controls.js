import { protect, authorize } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/api-helpers.js';
import {
  getSystemControlsSync,
  updateSystemControlsSync,
} from '../../../lib/system-controls.js';
import { createOwnerAuditLog } from '../../../lib/owner-audit-logger.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  const authResult = await protect(req);
  if (authResult.error) {
    return res.status(authResult.status).json({
      success: false,
      message: authResult.error,
    });
  }

  const roleError = authorize('owner')(authResult.user);
  if (roleError) {
    return res.status(roleError.status).json({
      success: false,
      message: roleError.error,
    });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: getSystemControlsSync(),
    });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const {
    emailVerificationEnabled,
    requireProfileCompletion,
    apiEnabled,
  } = req.body || {};

  const patch = {};

  if (typeof emailVerificationEnabled === 'boolean') {
    patch.emailVerificationEnabled = emailVerificationEnabled;
  }

  if (typeof requireProfileCompletion === 'boolean') {
    patch.requireProfileCompletion = requireProfileCompletion;
  }

  if (typeof apiEnabled === 'boolean') {
    patch.apiEnabled = apiEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid control fields provided',
    });
  }

  const updated = updateSystemControlsSync(patch, authResult.user._id?.toString?.() || null);

  await createOwnerAuditLog({
    actorId: authResult.user._id,
    actorRole: authResult.user.role,
    action: 'system_controls_update',
    targetType: 'system_controls',
    message: 'System controls updated by owner',
    metadata: patch,
    req,
  });

  return res.status(200).json({
    success: true,
    data: updated,
  });
}
