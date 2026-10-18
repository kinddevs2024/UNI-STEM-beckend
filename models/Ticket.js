import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},
 firstName:{type:String,required:true},secondName:{type:String,required:true},schoolName:{type:String,default:''},
 initialCoins:{type:Number,required:true,min:0},username:{type:String,required:true},
 tokenHash:{type:String,required:true,unique:true,select:false},tokenEncrypted:{type:String,required:true,select:false},
 issuedBy:{type:String,required:true},requestId:{type:String,required:true,unique:true},
 resetRequestedAt:{type:Date,default:null},resetResolvedAt:{type:Date,default:null}
},{timestamps:true});
export default mongoose.models.Ticket||mongoose.model('Ticket',schema);
