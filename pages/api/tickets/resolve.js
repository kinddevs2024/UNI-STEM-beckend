import connect from '../../../lib/mongodb.js';
import Ticket from '../../../models/Ticket.js';
import User from '../../../models/User.js';
import {ticketHash,validTicketToken} from '../../../lib/tickets.js';
import {handleCORS} from '../../../lib/api-helpers.js';
import {checkRateLimitByIP} from '../../../lib/rate-limiting.js';
export default async function handler(req,res){if(handleCORS(req,res))return;res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({message:'Method not allowed'});if(!checkRateLimitByIP('/tickets/resolve',req).allowed)return res.status(429).json({message:'Too many requests. Please try again shortly.'});if(!validTicketToken(req.body?.token))return res.status(404).json({message:'This ticket is not valid.'});try{await connect();const t=await Ticket.findOne({tokenHash:ticketHash(req.body.token)});const u=t&&await User.findById(t.userId);if(!u||u.userBan||u.role!=='student')return res.status(404).json({message:'This ticket is unavailable. Contact the administrator.'});if(req.body.action==='request-help'){t.resetRequestedAt=new Date();await t.save();return res.json({success:true});}return res.json({firstName:t.firstName,secondName:t.secondName,username:u.username,needsActivation:!u.ticketActivatedAt&&u.mustChangePassword});}catch{return res.status(500).json({message:'Could not open this ticket.'});}}
