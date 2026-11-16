import mongoose from 'mongoose';

export const QUOTATION_STATUSES = Object.freeze(['DRAFT', 'SENT', 'CONVERTED', 'LOST']);

const quotationItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const quotationSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    items: { type: [quotationItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: QUOTATION_STATUSES, required: true, default: 'DRAFT' },
    createdBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    salesOrderId: { type: String, default: null },
  },
  { timestamps: true },
);

quotationSchema.index({ 'createdBy.id': 1, createdAt: -1 });
quotationSchema.index({ customerId: 1, createdAt: -1 });

export const Quotation = mongoose.models.Quotation ?? mongoose.model('Quotation', quotationSchema);
export default Quotation;
