import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  soId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SalesOrder', index: true },
  refType: { type: String, required: true, trim: true },
  refId: { type: String, required: true, trim: true },
  fileUrl: { type: String, required: true, trim: true },
  fileName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
  size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

documentSchema.index({ soId: 1, uploadedAt: -1 });
export const Document = mongoose.models.Document ?? mongoose.model('Document', documentSchema);
export default Document;
