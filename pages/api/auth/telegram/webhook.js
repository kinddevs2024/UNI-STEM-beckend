import connectDB from '../../../../lib/mongodb.js';
import TelegramLogin from '../../../../models/TelegramLogin.js';
import User from '../../../../models/User.js';
import { digest, random, sameSecret, botCall } from '../../../../lib/telegram-login.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 if(!sameSecret(req.headers['x-telegram-bot-api-secret-token'],process.env.GLOBAL_TELEGRAM_WEBHOOK_SECRET))return res.status(403).end();
 const m=req.body?.message;
 if(!m||m.chat?.type!=='private'||String(m.chat.id)!==String(m.from?.id)||m.from?.is_bot)return res.json({ok:true});
 const state=/^\/start(?:@\w+)?\s+([-_a-zA-Z0-9]{43})$/.exec(m.text||'')?.[1];
 const ru=m.from.language_code?.startsWith('ru');
 try {
  if(!state){if(/^\/start/.test(m.text||''))await botCall('sendMessage',{chat_id:m.chat.id,text:ru?'Добро пожаловать! Начните регистрацию кнопкой Telegram на сайте.':'Welcome! Start by choosing Telegram on our website.',reply_markup:{inline_keyboard:[[{text:ru?'Открыть сайт':'Open website',url:'https://www.global-olimpiads.biz/auth'}]]}});return res.json({ok:true});}
  await connectDB();const session=await TelegramLogin.findOne({stateHash:digest(state),status:{$in:['pending','approved']},expiresAt:{$gt:new Date()}});
  if(!session || session.telegramId && session.telegramId!==String(m.from.id)){await botCall('sendMessage',{chat_id:m.chat.id,text:ru?'Ссылка устарела. Нажмите Telegram на сайте ещё раз.':'This request has expired. Choose Telegram on the website again.'});return res.json({ok:true});}
  let user=await User.findOne({telegramId:String(m.from.id)});
  if(!user){try{user=await User.create({telegramId:String(m.from.id),telegramUsername:m.from.username,name:[m.from.first_name,m.from.last_name].filter(Boolean).join(' ').slice(0,120)||'Telegram user',firstName:m.from.first_name,secondName:m.from.last_name,role:'student',coins:0,emailVerified:false});}catch(error){if(error.code!==11000)throw error;user=await User.findOne({telegramId:String(m.from.id)});if(!user)throw error;}}
  if(user.userBan){await botCall('sendMessage',{chat_id:m.chat.id,text:ru?'Этот аккаунт заблокирован.':'This account is blocked.'});return res.json({ok:true});}
  const code=random();const approved=await TelegramLogin.findOneAndUpdate({_id:session._id,status:{$in:['pending','approved']},$or:[{telegramId:{$exists:false}},{telegramId:String(m.from.id)}],expiresAt:{$gt:new Date()}},{$set:{telegramId:String(m.from.id),userId:user._id,codeHash:digest(code),status:'approved',expiresAt:new Date(Date.now()+300000)}},{new:true});
  if(approved)await botCall('sendMessage',{chat_id:m.chat.id,text:ru?'Добро пожаловать! Ваш профиль готов. Вернитесь на сайт, чтобы войти. Ссылка действует 5 минут и только один раз.':'Welcome! Your profile is ready. Return to the website to sign in. This link works once and expires in 5 minutes.',reply_markup:{inline_keyboard:[[{text:ru?'Вернуться на сайт':'Return to website',url:`https://www.global-olimpiads.biz/auth#telegram_code=${code}`}]]}});
  return res.json({ok:true});
 }catch {return res.status(503).json({ok:false});}
}
