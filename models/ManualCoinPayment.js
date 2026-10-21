import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 olympiadId:{type:mongoose.Schema.Types.ObjectId,ref:'Olympiad',default:null},
 requestId:{type:String,required:true},packs:{type:Number,required:true,min:1,max:200},
 coins:{type:Number,required:true},amountUzs:{type:Number,required:true},
 receiptPath:{type:String,required:true},receiptName:{type:String,required:true},receiptMime:{type:String,required:true},receiptHash:{type:String,required:true},
 status:{type:String,enum:['pending','reviewing','approved','rejected'],default:'pending',index:true},
 reviewedBy:{type:String,default:null},reviewedAt:{type:Date,default:null},reviewNote:{type:String,default:''}
},{timestamps:true});
schema.index({userId:1,requestId:1},{unique:true});
schema.index({userId:1,receiptHash:1},{unique:true});
export default mongoose.models.ManualCoinPayment||mongoose.model('ManualCoinPayment',schema);
