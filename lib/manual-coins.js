import path from 'node:path';
import User from '../models/User.js';
import Olympiad from '../models/Olympiad.js';
import ManualCoinPayment from '../models/ManualCoinPayment.js';
import {parseEntryFee} from './coin-policy.js';
import {createOwnerAuditLog} from './owner-audit-logger.js';
export const MANUAL_PRICE={cardNumber:'4916991726796191',coinsPerPack:50,uzsPerPack:200000};
export const receiptDir=()=>process.env.COIN_RECEIPTS_DIR||path.join(process.cwd(),'private-data','coin-receipts');
export function packPrice(value){const packs=Number(value);if(!Number.isSafeInteger(packs)||packs<1||packs>200)throw Object.assign(new Error('Choose 1–200 packs of 50 coins.'),{status:400});return {packs,coins:packs*50,amountUzs:packs*200000};}
export async function entryQuote(userId,olympiadId){
 const [user,olympiad]=await Promise.all([User.findById(userId).select('coins coinEntries role').lean(),Olympiad.findById(olympiadId).select('title status entryFeeCoins endTime').lean()]);
 if(!user||user.role!=='student')throw Object.assign(new Error('Student account required.'),{status:403});
 if(!olympiad||!['visible','published'].includes(olympiad.status))throw Object.assign(new Error('Olympiad not available.'),{status:404});
 const fee=parseEntryFee(olympiad.entryFeeCoins),balance=user.coins??0,alreadyPaid=Boolean(user.coinEntries?.some(e=>e.olympiadId===String(olympiadId)&&['active','pending'].includes(e.state)));
 const ended=olympiad.endTime&&new Date(olympiad.endTime)<=new Date();
 return {olympiadId:String(olympiad._id),title:olympiad.title,entryFeeCoins:fee,balance,alreadyPaid,canEnter:alreadyPaid||balance>=fee||Boolean(ended),shortfall:alreadyPaid||ended?0:Math.max(0,fee-balance),recommendedPacks:Math.max(1,Math.ceil((fee-balance)/50))};
}
export function paymentView(p){return {_id:String(p._id),olympiadId:p.olympiadId?String(p.olympiadId):null,packs:p.packs,coins:p.coins,amountUzs:p.amountUzs,status:p.status,receiptName:p.receiptName,createdAt:p.createdAt,reviewNote:p.reviewNote};}
export function receiptType(buffer){if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['image/png','.png'];if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return ['image/jpeg','.jpg'];if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')return ['image/webp','.webp'];if(buffer.subarray(0,5).toString()==='%PDF-')return ['application/pdf','.pdf'];return null;}
export async function reviewPayment(id,decision,actor,note='',req=null){
 if(!['approve','reject'].includes(decision))throw Object.assign(new Error('Choose approve or reject.'),{status:400});
 let payment=await ManualCoinPayment.findById(id);if(!payment)throw Object.assign(new Error('Payment not found.'),{status:404});
 if(decision==='reject'){
   if(payment.status==='rejected')return payment;
   const rejected=await ManualCoinPayment.findOneAndUpdate({_id:id,status:'pending'},{$set:{status:'rejected',reviewedBy:String(actor._id),reviewedAt:new Date(),reviewNote:String(note).trim().slice(0,500)}},{new:true});
   if(!rejected)throw Object.assign(new Error('This payment is already being processed.'),{status:409});
   await createOwnerAuditLog({actorId:actor._id,actorRole:actor.role,action:'coin_receipt_rejected',targetType:'payment',targetId:String(id),req});return rejected;
 }
 if(payment.status==='approved')return payment;
 if(payment.status==='rejected')throw Object.assign(new Error('This payment was rejected.'),{status:409});
 if(payment.status==='pending')payment=await ManualCoinPayment.findOneAndUpdate({_id:id,status:'pending'},{$set:{status:'reviewing',reviewedBy:String(actor._id),reviewedAt:new Date()}},{new:true})||await ManualCoinPayment.findById(id);
 if(payment.status==='approved')return payment;
 if(payment.status!=='reviewing')throw Object.assign(new Error('Payment state changed. Refresh the page.'),{status:409});
 const key='manual-payment-'+payment._id;
 const credited=await User.findOneAndUpdate({_id:payment.userId,role:'student','coinCredits.requestId':{$ne:key}},[{$set:{coins:{$add:[{$ifNull:['$coins',0]},payment.coins]},coinCredits:{$concatArrays:[{$ifNull:['$coinCredits',[]]},[{requestId:key,coins:payment.coins,actorId:String(actor._id),createdAt:new Date()}]]}}}],{new:true}).lean();
 if(!credited){const user=await User.findById(payment.userId).select('coinCredits role').lean();if(!user?.coinCredits?.some(c=>c.requestId===key))throw Object.assign(new Error('Student account is unavailable; coins were not added.'),{status:409});}
 const approved=await ManualCoinPayment.findOneAndUpdate({_id:id,status:'reviewing'},{$set:{status:'approved',reviewNote:String(note).trim().slice(0,500)}},{new:true})||await ManualCoinPayment.findById(id);
 if(credited)await createOwnerAuditLog({actorId:actor._id,actorRole:actor.role,action:'coin_receipt_approved',targetType:'payment',targetId:String(id),metadata:{coins:payment.coins,amountUzs:payment.amountUzs,userId:String(payment.userId)},req});
 return approved;
}
