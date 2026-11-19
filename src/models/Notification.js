import mongoose from 'mongoose';
const schema = new mongoose.Schema({ recipientId:{type:String,required:true,index:true}, type:{type:String,required:true}, title:{type:String,required:true}, message:{type:String,required:true}, entityType:String, entityId:String, soId:{type:String,index:true}, readAt:Date }, {timestamps:true});
schema.index({recipientId:1,createdAt:-1});
export const Notification = mongoose.models.Notification ?? mongoose.model('Notification', schema);
