import mongoose from 'mongoose';

export const SHIPPING_REQUEST_STATUSES = Object.freeze(['REQUESTED', 'PROCESSED']);

const shippingRequestItemSchema = new mongoose.Schema(
  {
    soItemIndex: { type: Number, required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true },
  },
  { _id: false },
);

const shippingRequestSchema = new mongoose.Schema(
  {
    srNumber: { type: String, required: true, unique: true },
    soId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SalesOrder' },
    soNumber: { type: String, required: true },
    items: { type: [shippingRequestItemSchema], required: true },
    status: { type: String, enum: SHIPPING_REQUEST_STATUSES, required: true, default: 'REQUESTED' },
    requestedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
  },
  { timestamps: true },
);

shippingRequestSchema.index({ soId: 1, createdAt: -1 });

export const ShippingRequest = mongoose.models.ShippingRequest ?? mongoose.model('ShippingRequest', shippingRequestSchema);
export default ShippingRequest;
