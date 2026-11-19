import { ApiError, createNumbered, plain } from './shared.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { VendorPO } from '../models/VendorPO.js';
import { VendorPayment } from '../models/vendorPayment.js';

export async function recordVendorPayment({ vendorPoId, amount, paymentMethod, referenceNo, paidAt, notes, user }, { vendorPoModel = VendorPO, vendorPaymentModel = VendorPayment, salesOrderModel = SalesOrder } = {}) {
  const vpo = await vendorPoModel.findById(vendorPoId);
  if (!vpo) {
    throw new ApiError(404, 'Vendor PO not found');
  }

  const so = await salesOrderModel.findById(vpo.soId);
  if (!so) {
    throw new ApiError(404, 'Associated Sales Order not found');
  }

  const payment = await createNumbered(vendorPaymentModel, 'paymentNumber', 'VPAY', (paymentNumber) => ({
    paymentNumber,
    vendorPoId: vpo._id,
    soId: so._id,
    amount,
    paymentMethod: paymentMethod || 'BANK_TRANSFER',
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    referenceNo: referenceNo || '',
    notes: notes || '',
    recordedBy: user.name || user.email,
  }));

  if (so.status === 'PAID') {
    so.status = 'CLOSED';
    so.updatedAt = new Date();
    await salesOrderModel.updateOne({ _id: so._id }, { status: 'CLOSED', updatedAt: so.updatedAt });
  }

  return plain(payment);
}

export async function listVendorPayments({ soId, vendorPoId } = {}, { vendorPaymentModel = VendorPayment } = {}) {
  const filter = {};
  if (soId) filter.soId = soId;
  if (vendorPoId) filter.vendorPoId = vendorPoId;

  const payments = await vendorPaymentModel.find(filter).sort({ paidAt: -1, createdAt: -1 });
  return payments.map(p => plain(p));
}
