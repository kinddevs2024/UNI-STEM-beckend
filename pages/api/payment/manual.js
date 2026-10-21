import mongoose from 'mongoose';import formidable from 'formidable';import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {protect} from '../../../lib/auth.js';import {handleCORS} from '../../../lib/api-helpers.js';import connectDB from '../../../lib/mongodb.js';import ManualCoinPayment from '../../../models/ManualCoinPayment.js';import {MANUAL_PRICE,receiptDir,packPrice,entryQuote,paymentView,receiptType} from '../../../lib/manual-coins.js';
export const config={api:{bodyParser:false}};
const first=x=>Array.isArray(x)?x[0]:x;
export default async function handler(req,res){
 if(handleCORS(req,res))return;res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Method not allowed'});
 const auth=await protect(req);if(auth.error)return res.status(auth.status).json({message:auth.error});if(auth.user.role!=='student')return res.status(403).json({message:'Student account required.'});
 let temporary=[],permanent=null,stored=false;
 try{
  await connectDB();
  if(req.method==='GET'){
   let quote=null;if(req.query.olympiadId){if(!mongoose.isValidObjectId(req.query.olympiadId))return res.status(400).json({message:'Invalid olympiad.'});quote=await entryQuote(auth.user._id,req.query.olympiadId);}
   const payments=await ManualCoinPayment.find({userId:auth.user._id}).sort({createdAt:-1}).limit(20).lean();return res.json({pricing:MANUAL_PRICE,quote,payments:payments.map(paymentView)});
  }
  if(Number(req.headers['content-length']||0)>6*1024*1024)return res.status(413).json({message:'Receipt must be at most 5 MB.'});
  const dir=receiptDir();await fs.mkdir(dir,{recursive:true,mode:0o700});const form=formidable({uploadDir:dir,maxFiles:1,maxFileSize:5*1024*1024,maxTotalFileSize:5*1024*1024,maxFieldsSize:8192,allowEmptyFiles:false});form.on('fileBegin',(_,file)=>temporary.push(file.filepath));
  const [fields,files]=await form.parse(req);const file=first(files.receipt);if(!file)throw Object.assign(new Error('Upload a PNG, JPG, WEBP or PDF receipt.'),{status:400});
  const price=packPrice(first(fields.packs)),requestId=String(first(fields.requestId)||'');if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))throw Object.assign(new Error('Invalid request ID.'),{status:400});
  const olympiadId=String(first(fields.olympiadId)||'');if(olympiadId){if(!mongoose.isValidObjectId(olympiadId))throw Object.assign(new Error('Invalid olympiad.'),{status:400});await entryQuote(auth.user._id,olympiadId);}
  const bytes=await fs.readFile(file.filepath),type=receiptType(bytes);if(!type)throw Object.assign(new Error('Only PNG, JPG, WEBP and PDF receipts are accepted.'),{status:400});
  const receiptHash=crypto.createHash('sha256').update(bytes).digest('hex');const prior=await ManualCoinPayment.findOne({userId:auth.user._id,$or:[{requestId},{receiptHash}]});if(prior){if(prior.packs!==price.packs||String(prior.olympiadId||'')!==olympiadId||prior.receiptHash!==receiptHash)throw Object.assign(new Error('This request ID belongs to a different receipt.'),{status:409});return res.json({payment:paymentView(prior)});}
  const filename=crypto.randomUUID()+type[1];permanent=path.join(dir,filename);await fs.rename(file.filepath,permanent);await fs.chmod(permanent,0o600);
  let payment;try{payment=await ManualCoinPayment.create({userId:auth.user._id,olympiadId:olympiadId||null,requestId,...price,receiptPath:filename,receiptName:String(file.originalFilename||'receipt').replace(/[\r\n]/g,'').slice(0,160),receiptMime:type[0],receiptHash});stored=true;}catch(e){if(e.code===11000){payment=await ManualCoinPayment.findOne({userId:auth.user._id,$or:[{requestId},{receiptHash}]});if(!payment||payment.packs!==price.packs||payment.receiptHash!==receiptHash||String(payment.olympiadId||'')!==olympiadId)throw Object.assign(new Error('Conflicting receipt request.'),{status:409});}else throw e;}
  return res.status(stored?201:200).json({payment:paymentView(payment)});
 }catch(e){res.status(e.status||(e.httpCode===413?413:400)).json({message:e.status?e.message:'Could not submit receipt. Check file size and try again.'});}
 finally{for(const p of temporary)await fs.unlink(p).catch(()=>{});if(permanent&&!stored)await fs.unlink(permanent).catch(()=>{});}
}
