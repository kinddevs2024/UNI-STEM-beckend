import connect from '../../../../lib/mongodb.js';
import User from '../../../../models/User.js';
import Ticket from '../../../../models/Ticket.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {handleCORS} from '../../../../lib/api-helpers.js';
import {adminGuard,usernameBase,seal} from '../../../../lib/admin-accounts.js';
import {ticketHash,ticketView} from '../../../../lib/tickets.js';
import {createOwnerAuditLog} from '../../../../lib/owner-audit-logger.js';
export default async function handler(req,res){if(handleCORS(req,res))return;res.setHeader('Cache-Control','no-store');const actor=await adminGuard(req,res);if(!actor)return;
 try{await connect();
 if(req.method==='GET'){const page=Math.max(1,parseInt(req.query.page)||1),search=String(req.query.search||'').slice(0,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),filter=search?{$or:['firstName','secondName','schoolName','username'].map(k=>({[k]:{$regex:search,$options:'i'}}))}:{};const [tickets,total]=await Promise.all([Ticket.find(filter).sort({createdAt:-1}).skip((page-1)*20).limit(20).lean(),Ticket.countDocuments(filter)]);const users=await User.find({_id:{$in:tickets.map(t=>t.userId)}}).select('coins ticketActivatedAt').lean();return res.json({data:tickets.map(t=>ticketView(t,users.find(u=>String(u._id)===String(t.userId)))),pagination:{page,pages:Math.ceil(total/20),total}});}
 if(req.method!=='POST')return res.status(405).json({message:'Method not allowed'});
 const b=req.body||{},first=String(b.firstName||'').trim(),last=String(b.secondName||'').trim(),school=String(b.schoolName||'').trim(),coins=Number(b.coins ?? 50),requestId=String(b.requestId||'');
 if(!first||!last||first.length>60||last.length>60||school.length>120||!Number.isSafeInteger(coins)||coins<0||coins>1000000||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))return res.status(400).json({message:'Enter first name, last name and 0–1,000,000 whole coins.'});
 const prior=await Ticket.findOne({requestId}).select('+tokenEncrypted');if(prior){const user=await User.findById(prior.userId);return res.json({data:ticketView(prior,user,true)});}
 const base=usernameBase(first,last);if(base.length<3)return res.status(400).json({message:'Use a name that can be converted to a username.'});let username=base,n=1;while(await User.exists({username}))username=`${base}${++n}`;
 const token=crypto.randomBytes(32).toString('base64url');const user=await User.create({name:`${first} ${last}`,firstName:first,secondName:last,schoolName:school,username,email:`${username}@accounts.invalid`,coins,role:'student',adminCreated:true,emailVerified:true,mustChangePassword:true,passwordHash:await bcrypt.hash(crypto.randomBytes(32).toString('base64url'),12)});
 let ticket;try{ticket=await Ticket.create({userId:user._id,firstName:first,secondName:last,schoolName:school,username,initialCoins:coins,issuedBy:String(actor._id),requestId,tokenHash:ticketHash(token),tokenEncrypted:seal(token)});}catch(e){await User.deleteOne({_id:user._id});if(e.code===11000){const existing=await Ticket.findOne({requestId}).select('+tokenEncrypted');if(existing)return res.json({data:ticketView(existing,await User.findById(existing.userId),true)});}throw e;}
 await createOwnerAuditLog({actorId:String(actor._id),actorRole:actor.role,action:'ticket_issue',targetType:'user',targetId:String(user._id),metadata:{initialCoins:coins},req});return res.status(201).json({data:ticketView(ticket,user,true)});
 }catch{return res.status(400).json({message:'Could not issue a ticket. Retry this request.'});}}
