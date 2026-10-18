export function normalizeProctoringMode(req, requested) {
  const status = { ...(requested || {}), mode: 'desktop' };
  if (requested?.mode === 'mobile_camera') {
    const ua = String(req.headers?.['user-agent'] || '');
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && req.body?.deviceFingerprint?.touchSupport === true);
    if (!mobile) { const error = new Error('Camera-only mode is available only on mobile devices. Desktop screen sharing is required.'); error.status=400; throw error; }
    status.mode = 'mobile_camera'; status.screenShareActive = false; status.displaySurface = null;
  }
  return status;
}