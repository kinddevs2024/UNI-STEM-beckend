import connectDB from '../../../../lib/mongodb.js';
import TelegramLogin from '../../../../models/TelegramLogin.js';
import { digest, random, trustedOrigin } from '../../../../lib/telegram-login.js';
import { checkRateLimitByIP } from '../../../../lib/rate-limiting.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Method not allowed'});
 if(!trustedOrigin(req))return res.status(403).json({message:'Start Telegram login from this website.'});
 if(!checkRateLimitByIP('/auth/login',req).allowed)return res.status(429).json({message:'Please try again shortly.'});
 if(!process.env.GLOBAL_TELEGRAM_BOT_TOKEN || !process.env.GLOBAL_TELEGRAM_BOT_USERNAME)return res.status(503).json({message:'Telegram login is unavailable.'});
 try {await connectDB(); const state=random(),browser=random(); await TelegramLogin.create({stateHash:digest(state),browserHash:digest(browser),expiresAt:new Date(Date.now()+600000)});
 res.setHeader('Set-Cookie',`__Host-global-tg=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
 return res.json({url:`https://t.me/${process.env.GLOBAL_TELEGRAM_BOT_USERNAME}?start=${state}`});
 } catch {return res.status(503).json({message:'Unable to start Telegram login.'});}
}
