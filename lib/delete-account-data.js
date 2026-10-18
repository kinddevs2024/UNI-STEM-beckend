import fs from 'node:fs/promises';
import path from 'node:path';
export async function deleteAccountData(db,user){
 const filter={$or:[{userId:String(user._id)},{userId:user._id}]};
 const [captures,sessions,attempts]=await Promise.all([db.collection('cameracaptures').find(filter).toArray(),db.collection('proctoringsessions').find(filter).toArray(),db.collection('attempts').find(filter).project({_id:1}).toArray()]);
 const paths=[user.userLogo,...captures.map(x=>x.imagePath),...sessions.flatMap(x=>[x.frontCameraVideoPath,x.backCameraVideoPath,x.screenVideoPath,...(x.captures||[]).map(c=>c.imagePath)])].filter(Boolean);
 let root;try{root=await fs.realpath(path.resolve(process.env.UPLOAD_PATH||'./uploads'));}catch{}
 if(root)for(const file of new Set(paths)){if(/^https?:/i.test(file))continue;const relative=file.replace(/^\/?(?:api\/)?uploads\//,'');const target=path.resolve(root,relative);if(!target.startsWith(root+path.sep))continue;try{const real=await fs.realpath(target);if(real.startsWith(root+path.sep)&&(await fs.stat(real)).isFile())await fs.unlink(real);}catch(e){if(e.code!=='ENOENT')throw e;}}
 await db.collection('sessionheartbeats').deleteMany({attemptId:{$in:attempts.map(x=>x._id)}});
 for(const name of ['tickets','attempts','results','submissions','drafts','cameracaptures','proctoringsessions','proctoringevents','devices','notifications','certificates'])await db.collection(name).deleteMany(filter);
}
