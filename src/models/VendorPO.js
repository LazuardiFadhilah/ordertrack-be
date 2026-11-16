import mongoose from 'mongoose';

export const VENDOR_PO_STATUSES = Object.freeze(['ISSUED', 'PARTIAL_RECEIVED', 'RECEIVED']);

const vendorPoItemSchema = new mongoose.Schema(
  {
    soItemIndex: { type: Number, required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true },
  },
  { _id: false },
);

const vendorPoSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    soId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SalesOrder' },
    soNumber: { type: String, required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Vendor' },
    vendorName: { type: String, required: true },
    items: { type: [vendorPoItemSchema], required: true },
    status: { type: String, enum: VENDOR_PO_STATUSES, required: true, default: 'ISSUED' },
    createdBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
  },
  { timestamps: true },
);

vendorPoSchema.index({ soId: 1, createdAt: -1 });

export const VendorPO = mongoose.models.VendorPO ?? mongoose.model('VendorPO', vendorPoSchema);
export default VendorPO;
