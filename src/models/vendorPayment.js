import mongoose from 'mongoose';

const vendorPaymentSchema = new mongoose.Schema({
  paymentNumber: { type: String, required: true, unique: true },
  vendorPoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorPO', required: true },
  soId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['BANK_TRANSFER', 'GIRO', 'CASH', 'OTHER'], default: 'BANK_TRANSFER' },
  paidAt: { type: Date, required: true },
  referenceNo: { type: String },
  notes: { type: String },
  recordedBy: { type: String, required: true },
}, { timestamps: true });

vendorPaymentSchema.index({ vendorPoId: 1, paidAt: -1 });

export const VendorPayment = mongoose.models.VendorPayment ?? mongoose.model('VendorPayment', vendorPaymentSchema);
export default VendorPayment;
