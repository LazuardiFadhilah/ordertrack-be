import mongoose from 'mongoose';

export const SALES_ORDER_STATUSES = Object.freeze(['PO_RECEIVED']);

const salesOrderItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qtyOrdered: { type: Number, required: true },
    qtyReceived: { type: Number, required: true, default: 0 },
    qtyShipped: { type: Number, required: true, default: 0 },
    qtyInvoiced: { type: Number, required: true, default: 0 },
    unitPrice: { type: Number, required: true },
  },
  { _id: false },
);

const salesOrderSchema = new mongoose.Schema(
  {
    soNumber: { type: String, required: true, unique: true },
    customerPoNumber: { type: String, default: '' },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    quotationId: { type: String, required: true },
    quotationNumber: { type: String, required: true },
    salesId: { type: String, required: true },
    salesName: { type: String, required: true },
    items: { type: [salesOrderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: SALES_ORDER_STATUSES, required: true, default: 'PO_RECEIVED' },
  },
  { timestamps: true },
);

salesOrderSchema.index({ salesId: 1, createdAt: -1 });
salesOrderSchema.index({ customerId: 1, createdAt: -1 });

export const SalesOrder = mongoose.models.SalesOrder ?? mongoose.model('SalesOrder', salesOrderSchema);
export default SalesOrder;
