import mongoose from 'mongoose';
const schema = new mongoose.Schema({ soId:{type:String,required:true,index:true}, action:{type:String,required:true}, entityType:String, entityId:String, actorId:String, actorName:String, actorRole:String, metadata:{type:mongoose.Schema.Types.Mixed} }, {timestamps:true});
schema.index({soId:1,createdAt:-1});
export const ActivityLog = mongoose.models.ActivityLog ?? mongoose.model('ActivityLog', schema);
