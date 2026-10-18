import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogleAccessToken, verifyGoogleIdToken } from '../lib/google-auth.js';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const info = { aud: 'our-client', sub: 'google-user', expires_in: '3600' };
const profile = { sub: 'google-user', email: 'test@gmail.com', email_verified: true };
function mock(tokenInfo = info, user = profile) {
  let count = 0;
  return async () => ({ ok: true, json: async () => count++ === 0 ? tokenInfo : user });
}
test('accepts a valid token only for our client and matching verified identity', async () => {
  assert.deepEqual(await verifyGoogleAccessToken('token', 'our-client', mock()), profile);
});
test('rejects a token issued for another client', async () => {
  await assert.rejects(verifyGoogleAccessToken('token', 'our-client', mock({ ...info, aud: 'other-client' })));
});
test('rejects an expired token', async () => {
  await assert.rejects(verifyGoogleAccessToken('token', 'our-client', mock({ ...info, expires_in: 0 })));
});
test('rejects mismatched identities and unverified email', async () => {
  await assert.rejects(verifyGoogleAccessToken('token', 'our-client', mock(info, { ...profile, sub: 'other-user' })));
  await assert.rejects(verifyGoogleAccessToken('token', 'our-client', mock(info, { ...profile, email_verified: false })));
});
test('fails closed for malformed tokens and Google failures', async () => {
  await assert.rejects(verifyGoogleAccessToken({}, 'our-client', mock()));
  await assert.rejects(verifyGoogleAccessToken('token', '', mock()));
  await assert.rejects(verifyGoogleAccessToken('token', 'our-client', async () => ({ok: false})));
  await assert.rejects(verifyGoogleAccessToken('token', 'our-client', async () => { throw new Error('network'); }));
});

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const verifier = new OAuth2Client();
verifier.getFederatedSignonCertsAsync = async () => ({
  certs: { 'test-key': keys.publicKey.export({type: 'spki', format: 'pem'}) },
  format: 'PEM',
});
const signedCredential = (payload = {}, options = {}, key = keys.privateKey) => jwt.sign(
  { sub: 'google-user', email: 'test@gmail.com', email_verified: true, ...payload }, key,
  { algorithm: 'RS256', keyid: 'test-key', audience: 'our-client', issuer: 'https://accounts.google.com', expiresIn: '1h', ...options }
);

test('One Tap accepts a signed ID token with verified email', async () => {
  const profile = await verifyGoogleIdToken(signedCredential(), 'our-client', verifier);
  assert.equal(profile.sub, 'google-user');
});
test('One Tap rejects wrong audience, issuer and expired credentials', async () => {
  await assert.rejects(verifyGoogleIdToken(signedCredential({}, {audience: 'other-client'}), 'our-client', verifier));
  await assert.rejects(verifyGoogleIdToken(signedCredential({}, {issuer: 'https://attacker.example'}), 'our-client', verifier));
  await assert.rejects(verifyGoogleIdToken(signedCredential({}, {expiresIn: '-1h'}), 'our-client', verifier));
});
test('One Tap rejects forged signatures and unverified email', async () => {
  const other = generateKeyPairSync('rsa', {modulusLength: 2048});
  await assert.rejects(verifyGoogleIdToken(signedCredential({}, {}, other.privateKey), 'our-client', verifier));
  await assert.rejects(verifyGoogleIdToken(signedCredential({email_verified: false}), 'our-client', verifier));
});
test('One Tap rejects malformed credentials', async () => {
  await assert.rejects(verifyGoogleIdToken({}, 'our-client', verifier));
  await assert.rejects(verifyGoogleIdToken('not-a-jwt', 'our-client', verifier));
  await assert.rejects(verifyGoogleIdToken(signedCredential(), '', verifier));
});
