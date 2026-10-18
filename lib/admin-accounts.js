import crypto from 'crypto';
import { protect, authorize } from './auth.js';
export const manageableRoles=['student','school-teacher','checker','resolter','university','school-admin'];
export async function adminGuard(req,res){const a=await protect(req);if(a.error){res.status(a.status).json({message:a.error});return null;}const e=authorize('admin','owner')(a.user);if(e){res.status(e.status).json({message:e.error});return null;}return a.user;}
export function canManage(actor,user){return String(actor._id)!==String(user._id)&&manageableRoles.includes(user.role);}
export function usernameBase(first,last,explicit){const letters={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};const raw=explicit||`${String(last||'').trim().slice(0,1)}${first||''}`;return [...raw.toLowerCase()].map(c=>letters[c]??c).join('').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]/g,'').slice(0,40);}
function key(){if(!process.env.JWT_SECRET)throw new Error('Missing encryption key');return crypto.createHash('sha256').update('admin-temporary-password:'+process.env.JWT_SECRET).digest();}
export function seal(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv);const b=Buffer.concat([c.update(value,'utf8'),c.final()]);return [iv,c.getAuthTag(),b].map(x=>x.toString('base64')).join('.');}
export function unseal(value){const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64'));const d=crypto.createDecipheriv('aes-256-gcm',key(),iv);d.setAuthTag(tag);return Buffer.concat([d.update(data),d.final()]).toString('utf8');}
export const profileFields=['firstName','secondName','name','email','tel','address','schoolName','schoolId','dateBorn','gender','userBan'];
export function publicProfile(u){const {passwordHash,passwordResetTokenHash,emailVerificationTokenHash,temporaryPasswordEncrypted,coinEntries,coinCredits,coinRewards,...safe}=u;return safe;}
