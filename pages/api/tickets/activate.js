import {generateToken} from '../../../lib/auth.js';
import {publicProfile} from '../../../lib/admin-accounts.js';
import connect from '../../../lib/mongodb.js';
import Ticket from '../../../models/Ticket.js';
import User from '../../../models/User.js';
import {ticketHash,validTicketToken} from '../../../lib/tickets.js';
import bcrypt from 'bcryptjs';
import {handleCORS} from '../../../lib/api-helpers.js';
import {checkRateLimitByIP} from '../../../lib/rate-limiting.js';
export default async function handler(req,res){if(handleCORS(req,res))return;res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({message:'Method not allowed'});if(!checkRateLimitByIP('/tickets/activate',req).allowed)return res.status(429).json({message:'Too many requests. Please try again shortly.'});const {token,password}=req.body||{};if(!validTicketToken(token)||typeof password!=='string'||password.length<8||password.length>128)return res.status(400).json({message:'Choose a password with 8–128 characters.'});try{await connect();const t=await Ticket.findOne({tokenHash:ticketHash(token)});if(!t)return res.status(404).json({message:'This ticket is not valid.'});const u=await User.findOneAndUpdate({_id:t.userId,role:'student',userBan:{$ne:true},mustChangePassword:true,ticketActivatedAt:null},{$set:{passwordHash:await bcrypt.hash(password,12),mustChangePassword:false,ticketActivatedAt:new Date()},$unset:{temporaryPasswordEncrypted:1}},{new:true});if(!u)return res.status(409).json({message:'This ticket is already activated. Sign in with your password.'});return res.json({success:true,username:u.username,token:generateToken(String(u._id)),user:publicProfile(u.toObject())});}catch{return res.status(500).json({message:'Could not activate this ticket.'});}}
