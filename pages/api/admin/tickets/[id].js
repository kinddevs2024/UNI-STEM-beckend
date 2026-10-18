import connect from '../../../../lib/mongodb.js';
import User from '../../../../models/User.js';
import Ticket from '../../../../models/Ticket.js';
import {adminGuard,seal} from '../../../../lib/admin-accounts.js';
import {ticketView} from '../../../../lib/tickets.js';
import {handleCORS} from '../../../../lib/api-helpers.js';
import {createOwnerAuditLog} from '../../../../lib/owner-audit-logger.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
export default async function handler(req,res){if(handleCORS(req,res))return;res.setHeader('Cache-Control','no-store');const actor=await adminGuard(req,res);if(!actor)return;try{await connect();const ticket=await Ticket.findById(req.query.id).select('+tokenEncrypted');if(!ticket)return res.status(404).json({message:'Ticket not found.'});const user=await User.findById(ticket.userId);if(!user)return res.status(404).json({message:'This account has been deleted.'});
 if(req.method==='GET')return res.json({data:ticketView(ticket,user,true)});
 if(req.method!=='POST'||req.body?.action!=='reset-password')return res.status(405).json({message:'Method not allowed'});
 if(user.role!=='student')return res.status(403).json({message:'Only student ticket accounts can be reset here.'});
 const password=String(crypto.randomInt(100000,1000000));user.passwordHash=await bcrypt.hash(password,12);user.mustChangePassword=true;user.temporaryPasswordEncrypted=seal(password);await user.save();ticket.resetResolvedAt=new Date();await ticket.save();await createOwnerAuditLog({actorId:String(actor._id),actorRole:actor.role,action:'ticket_password_reset',targetType:'user',targetId:String(user._id),req});return res.json({data:ticketView(ticket,user,true),temporaryPassword:password});
 }catch{return res.status(400).json({message:'Could not process this ticket.'});}}
