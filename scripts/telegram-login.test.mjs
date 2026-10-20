import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config();
assert.match(process.env.MONGODB_URI,/^mongodb:\/\/127\.0\.0\.1:27942\/global_telegram_qa_[0-9]+$/);
const {default:mongoose}=await import('mongoose');
const {default:start}=await import('../pages/api/auth/telegram/start.js');
const {default:hook}=await import('../pages/api/auth/telegram/webhook.js');
const {default:consume}=await import('../pages/api/auth/telegram/consume.js');
const {default:User}=await import('../models/User.js');
const {default:Session}=await import('../models/TelegramLogin.js');
const {digest}=await import('../lib/telegram-login.js');
const calls=[];
global.fetch=async(url,init)=>{assert(String(url).startsWith('https://api.telegram.org/botsynthetic-bot/'));calls.push(JSON.parse(init.body));return{ok:true,json:async()=>({ok:true,result:{message_id:calls.length}})}};
let requestSequence=1;
async function call(fn,body={},headers={},ip='198.51.100.'+(++requestSequence)){
 let result,status=200;const out={};
 const res={setHeader:(k,v)=>out[k]=v,status:n=>(status=n,res),json:data=>(result=data,res),end:()=>res};
 await fn({method:'POST',body,headers:{origin:'https://www.global-olimpiads.biz','x-forwarded-for':ip,...headers},socket:{remoteAddress:ip}},res);
 return{status,data:result,headers:out};
}
let n=0;function check(label){n++;console.log('PASS '+label)}
try {
 await mongoose.connect(process.env.MONGODB_URI);assert.equal(await User.countDocuments(),0);await User.init();await Session.init();
 const s=await call(start);assert.equal(s.status,200);assert(!s.data.token);const state=new URL(s.data.url).searchParams.get('start');const cookie=s.headers['Set-Cookie'].split(';')[0];check('browser-bound challenge');
 const payload={message:{chat:{id:123456789,type:'private'},from:{id:123456789,first_name:'Synthetic',last_name:'Student',username:'synthetic',language_code:'ru'},text:'/start '+state}};
 assert.equal((await call(hook,payload,{'x-telegram-bot-api-secret-token':'wrong'})).status,403);assert.equal(await User.countDocuments(),0);check('forged webhook rejected');
 assert.equal((await call(hook,payload,{'x-telegram-bot-api-secret-token':'synthetic-webhook'})).status,200);
 const user=await User.findOne({telegramId:'123456789'});assert(user);assert.equal(user.role,'student');assert.equal(user.coins,0);assert.equal(user.email,undefined);assert.equal(calls.at(-1).reply_markup.inline_keyboard.flat().length,1);check('Telegram profile creates zero-balance student and one return button');
 let code=new URL(calls.at(-1).reply_markup.inline_keyboard[0][0].url).hash.split('=')[1];
 assert.equal((await call(consume,{code},{cookie:'__Host-global-tg=foreign'})).status,401);check('foreign browser rejected');
 const outcomes=await Promise.all([call(consume,{code},{cookie}),call(consume,{code},{cookie})]);assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,401]);assert.equal(outcomes.find(x=>x.status===200).data.user._id,String(user._id));assert.equal((await call(consume,{code},{cookie})).status,401);check('atomic single-use login');
 const second=await call(start);payload.message.text='/start '+new URL(second.data.url).searchParams.get('start');await call(hook,payload,{'x-telegram-bot-api-secret-token':'synthetic-webhook'});assert.equal(await User.countDocuments(),1);check('returning identity reuses account');
 code=new URL(calls.at(-1).reply_markup.inline_keyboard[0][0].url).hash.split('=')[1];await Session.updateOne({codeHash:digest(code)},{$set:{expiresAt:new Date(0)}});assert.equal((await call(consume,{code},{cookie:second.headers['Set-Cookie'].split(';')[0]})).status,401);check('expired link rejected');
 assert.equal((await call(start,{}, {origin:'https://evil.invalid'})).status,403);check('foreign origin rejected');
 const third=await call(start);payload.message.text='/start '+new URL(third.data.url).searchParams.get('start');await call(hook,payload,{'x-telegram-bot-api-secret-token':'synthetic-webhook'});code=new URL(calls.at(-1).reply_markup.inline_keyboard[0][0].url).hash.split('=')[1];user.userBan=true;await user.save();assert.equal((await call(consume,{code},{cookie:third.headers['Set-Cookie'].split(';')[0]})).status,403);check('blocked account rejected');
 await User.create({telegramId:'987654321',name:'Other synthetic student'});assert.equal(await User.countDocuments({email:{$exists:false}}),2);check('multiple Telegram accounts without fake email');
 await assert.rejects(User.create({name:'Ordinary student with missing email'}));check('ordinary registration requires email');
 console.log('TOTAL '+n);
} finally {await mongoose.disconnect();}
process.exit(0);
