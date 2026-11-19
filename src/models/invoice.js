import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  soItemIndex: { type: Number, required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  soId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  soNumber: { type: String, required: true },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  items: { type: [invoiceItemSchema], required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, default: 0, min: 0 },
  status: { type: String, enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'], default: 'ISSUED' },
  dueDate: { type: Date, required: true },
  notes: { type: String, default: '' },
  issuedBy: { type: String, required: true },
}, { timestamps: true });

invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ customerId: 1, createdAt: -1 });

const paymentSchema = new mongoose.Schema({
  paymentNumber: { type: String, required: true, unique: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  soId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['BANK_TRANSFER', 'GIRO', 'CASH', 'OTHER'], default: 'BANK_TRANSFER' },
  paidAt: { type: Date, required: true },
  referenceNo: { type: String },
  notes: { type: String },
  receivedBy: { type: String, required: true },
}, { timestamps: true });

paymentSchema.index({ invoiceId: 1, paidAt: -1 });

export const Invoice = mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema);
export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
export default Invoice;
