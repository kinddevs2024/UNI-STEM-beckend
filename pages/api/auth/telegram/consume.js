import connectDB from '../../../../lib/mongodb.js';
import TelegramLogin from '../../../../models/TelegramLogin.js';
import User from '../../../../models/User.js';
import { generateToken } from '../../../../lib/auth.js';
import { digest, browserCookie, clearCookie, trustedOrigin } from '../../../../lib/telegram-login.js';
import { checkRateLimitByIP } from '../../../../lib/rate-limiting.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Method not allowed'});
 if(!trustedOrigin(req))return res.status(403).json({message:'Invalid login origin.'});
 if(!checkRateLimitByIP('/auth/login',req).allowed)return res.status(429).json({message:'Please try again shortly.'});
 const code=req.body?.code,browser=browserCookie(req);
 if(typeof code!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(code))return res.status(401).json({message:'Open the return link in the browser where you started Telegram login, or try again.'});
 try { await connectDB();
 const session=await TelegramLogin.findOne({codeHash:digest(code),status:'approved',expiresAt:{$gt:new Date()}});
 if(!session)return res.status(401).json({message:'This login link has expired or has already been used. Please try again.'});
 if(!session.direct && (!browser || session.browserHash!==digest(browser)))return res.status(401).json({message:'Open this link in the browser where you started Telegram login.'});
 const user=await User.findById(session.userId);
 if(!user||user.userBan||user.mustChangePassword)return res.status(403).json({message:'This account cannot sign in.'});
 if(session.direct && req.body?.confirm!==true)return res.json({confirmationRequired:true,profile:{name:user.name,telegramUsername:user.telegramUsername}});
 const used=await TelegramLogin.findOneAndUpdate({_id:session._id,status:'approved',expiresAt:{$gt:new Date()}},{$set:{status:'consumed'},$unset:{codeHash:1}},{new:true});
 if(!used)return res.status(401).json({message:'This login link has already been used.'});
 clearCookie(res);
 return res.json({token:generateToken(String(user._id)),user:{_id:String(user._id),name:user.name,role:user.role,email:user.email,telegramUsername:user.telegramUsername,gradeCategory:user.gradeCategory}});
 } catch {return res.status(503).json({message:'Unable to complete Telegram login.'});}
}
