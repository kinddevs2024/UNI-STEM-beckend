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
 const payload={message:{chat:{id:555111,type:'private'},from:{id:555111,first_name:'Synthetic',language_code:'ru'},text:'/start'}};
 let code;
 payload.message.chat.id=555111;payload.message.from.id=555111;payload.message.text='/start';
 assert.equal((await call(hook,payload,{'x-telegram-bot-api-secret-token':'synthetic-webhook'})).status,200);
 assert.equal(calls.at(-1).reply_markup.inline_keyboard.flat().length,1);
 code=new URL(calls.at(-1).reply_markup.inline_keyboard[0][0].url).hash.split('=')[1];assert(code);check('plain Start issues one return button without website challenge');
 const preview=await call(consume,{code});assert.equal(preview.status,200);assert.equal(preview.data.confirmationRequired,true);assert(!preview.data.token);check('standalone link previews account instead of silently switching session');
 assert.equal((await call(consume,{code,confirm:true},{origin:'https://evil.invalid'})).status,403);
 const confirmed=await call(consume,{code,confirm:true});assert.equal(confirmed.status,200);assert(confirmed.data.token);assert.equal(confirmed.data.user.role,'student');
 assert.equal((await call(consume,{code,confirm:true})).status,401);check('explicit standalone confirmation works once without original browser cookie');
 await call(hook,payload,{'x-telegram-bot-api-secret-token':'synthetic-webhook'});code=new URL(calls.at(-1).reply_markup.inline_keyboard[0][0].url).hash.split('=')[1];
 await Session.updateOne({codeHash:digest(code)},{$set:{expiresAt:new Date(0)}});assert.equal((await call(consume,{code,confirm:true})).status,401);check('standalone return links also expire');
 console.log('TOTAL '+n);
} finally {await mongoose.disconnect();}
process.exit(0);
