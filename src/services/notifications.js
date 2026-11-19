import { notFound, parseListQuery, plain } from './shared.js';
export function createNotificationService({notificationModel,activityLogModel}) { return {
 async listNotifications(user,query={}) { const {page,limit,skip}=parseListQuery(query); const filter={recipientId:String(user.id)}; if(query.unread==='true') filter.readAt=null; const [items,total]=await Promise.all([notificationModel.find(filter).sort({createdAt:-1}).skip(skip).limit(limit).lean(),notificationModel.countDocuments(filter)]); return {items:items.map(plain),total,page,limit}; },
 async getNotification(id,user){const n=await notificationModel.findById(id).lean();if(!n||String(n.recipientId)!==String(user.id))throw notFound('Notification');return plain(n);},
 async markRead(id,user){const n=await notificationModel.findById(id).lean();if(!n||String(n.recipientId)!==String(user.id))throw notFound('Notification');return plain(await notificationModel.findOneAndUpdate({_id:id,recipientId:String(user.id)},{$set:{readAt:new Date()}},{new:true}).lean());},
 async timeline(soId,user){const items=await activityLogModel.find({soId:String(soId)}).sort({createdAt:-1}).lean();return items.filter(x=>user.role!=='SALES'||String(x.actorId)===String(user.id)||x.actorRole!=='SALES').map(plain);},
 async recordActivity(data){return activityLogModel.create({...data,soId:String(data.soId),actorId:String(data.actor?.id||''),actorName:data.actor?.name||'',actorRole:data.actor?.role||''});}
};}
