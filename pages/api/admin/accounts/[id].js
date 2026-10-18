import {deleteAccountData} from '../../../../lib/delete-account-data.js';
import {createOwnerAuditLog} from '../../../../lib/owner-audit-logger.js';
import connect from '../../../../lib/mongodb.js';
import User from '../../../../models/User.js';
import {handleCORS} from '../../../../lib/api-helpers.js';
import {adminGuard,canManage,profileFields,publicProfile,unseal} from '../../../../lib/admin-accounts.js';
export default async function handler(req,res){if(handleCORS(req,res))return;res.setHeader('Cache-Control','no-store');const actor=await adminGuard(req,res);if(!actor)return;try{await connect();const u=await User.findById(req.query.id).select('+temporaryPasswordEncrypted');if(!u)return res.status(404).json({message:'User not found.'});if(!canManage(actor,u))return res.status(403).json({message:'This account cannot be managed here.'});
 if(req.method==='GET')return res.json({data:publicProfile(u.toObject()),temporaryPassword:u.mustChangePassword&&u.temporaryPasswordEncrypted?unseal(u.temporaryPasswordEncrypted):null});
 if(req.method==='PUT'){for(const k of profileFields)if(Object.hasOwn(req.body||{},k))u[k]=req.body[k]||((k==='userBan')?false:null);u.name=[u.firstName,u.secondName].filter(Boolean).join(' ')||u.name;await u.save();await createOwnerAuditLog({actorId:String(actor._id),actorRole:actor.role,action:"admin_user_update",targetType:"user",targetId:String(u._id),req});return res.json({data:publicProfile(u.toObject())});}
 if(req.method==='DELETE'){if(req.body?.confirmation!==(u.username||u.email))return res.status(400).json({message:'Type the username or email to confirm deletion.'});u.userBan=true;await u.save();await deleteAccountData(User.db.db,u);await User.deleteOne({_id:u._id});await createOwnerAuditLog({actorId:String(actor._id),actorRole:actor.role,action:"admin_user_delete",targetType:"user",targetId:String(u._id),req});return res.json({success:true});}
 return res.status(405).json({message:'Method not allowed'});
 }catch{return res.status(400).json({message:'Could not process this account.'});}}
