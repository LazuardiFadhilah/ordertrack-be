import mongoose from 'mongoose';

const goodsReceiptItemSchema = new mongoose.Schema(
  {
    soItemIndex: { type: Number, required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qtyReceived: { type: Number, required: true },
  },
  { _id: false },
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    grNumber: { type: String, required: true, unique: true },
    soId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SalesOrder' },
    soNumber: { type: String, required: true },
    vendorPoId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'VendorPO' },
    vendorPoNumber: { type: String, required: true },
    items: { type: [goodsReceiptItemSchema], required: true },
    receivedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

goodsReceiptSchema.index({ soId: 1, createdAt: -1 });

export const GoodsReceipt = mongoose.models.GoodsReceipt ?? mongoose.model('GoodsReceipt', goodsReceiptSchema);
export default GoodsReceipt;
