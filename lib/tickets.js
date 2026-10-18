import crypto from 'crypto';
import {unseal} from './admin-accounts.js';
export const ticketHash=token=>crypto.createHash('sha256').update(token).digest('hex');
export const validTicketToken=token=>typeof token==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(token);
export function ticketView(ticket,user,withQR=false){return {_id:ticket._id,userId:String(ticket.userId),firstName:ticket.firstName,secondName:ticket.secondName,schoolName:ticket.schoolName,username:ticket.username,initialCoins:ticket.initialCoins,coins:user?.coins??null,createdAt:ticket.createdAt,activatedAt:user?.ticketActivatedAt||null,needsHelp:!!ticket.resetRequestedAt&&(!ticket.resetResolvedAt||ticket.resetRequestedAt>ticket.resetResolvedAt),resetRequestedAt:ticket.resetRequestedAt,accountExists:!!user,...(withQR?{qrToken:unseal(ticket.tokenEncrypted)}:{})};}
