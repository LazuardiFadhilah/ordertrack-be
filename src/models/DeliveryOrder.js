import mongoose from 'mongoose';

export const DELIVERY_ORDER_STATUSES = Object.freeze(['SHIPPED', 'SIGNED_RETURNED']);

const deliveryOrderItemSchema = new mongoose.Schema(
  {
    soItemIndex: { type: Number, required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true },
  },
  { _id: false },
);

const deliveryOrderSchema = new mongoose.Schema(
  {
    doNumber: { type: String, required: true, unique: true },
    soId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SalesOrder' },
    soNumber: { type: String, required: true },
    shippingRequestId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ShippingRequest' },
    shippingRequestNumber: { type: String, required: true },
    items: { type: [deliveryOrderItemSchema], required: true },
    status: { type: String, enum: DELIVERY_ORDER_STATUSES, required: true, default: 'SHIPPED' },
    shippedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    shippedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

deliveryOrderSchema.index({ soId: 1, createdAt: -1 });

export const DeliveryOrder = mongoose.models.DeliveryOrder ?? mongoose.model('DeliveryOrder', deliveryOrderSchema);
export default DeliveryOrder;
