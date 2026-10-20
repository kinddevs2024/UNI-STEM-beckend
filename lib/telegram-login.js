import crypto from 'crypto';
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const random = () => crypto.randomBytes(32).toString('base64url');
export function sameSecret(a, b) { if (!a || !b) return false; const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && crypto.timingSafeEqual(x,y); }
export function browserCookie(req) { return String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-global-tg='))?.slice('__Host-global-tg='.length) || ''; }
export function clearCookie(res) { res.setHeader('Set-Cookie','__Host-global-tg=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); }
export function trustedOrigin(req) { return req.headers.origin === 'https://www.global-olimpiads.biz'; }
export async function botCall(method, body) {
 const response=await fetch(`https://api.telegram.org/bot${process.env.GLOBAL_TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const data=await response.json(); if(!response.ok || !data.ok) throw Error('Telegram request failed'); return data.result;
}
