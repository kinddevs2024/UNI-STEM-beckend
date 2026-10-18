import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

export async function verifyGoogleIdToken(credential, clientId, verifier = googleClient) {
  if (typeof credential !== 'string' || !credential || credential.length > 16384 || !clientId) {
    throw new Error('Invalid Google credential');
  }
  const ticket = await verifier.verifyIdToken({ idToken: credential, audience: clientId });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    throw new Error('Google email is not verified');
  }
  return profile;
}

export async function verifyGoogleAccessToken(token, clientId, request = fetch) {
  if (typeof token !== 'string' || !token || token.length > 8192) {
    throw new Error('Invalid Google token');
  }
  if (!clientId) throw new Error('Google client is not configured');

  const infoResponse = await request(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!infoResponse.ok) throw new Error('Invalid Google token');
  const info = await infoResponse.json();
  if (info.aud !== clientId || !info.sub || !(Number(info.expires_in) > 0)) {
    throw new Error('Invalid Google token');
  }

  const profileResponse = await request('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!profileResponse.ok) throw new Error('Invalid Google profile');
  const profile = await profileResponse.json();
  if (profile.sub !== info.sub || profile.email_verified !== true || !profile.email) {
    throw new Error('Google email is not verified');
  }
  return profile;
}
