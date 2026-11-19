import { ApiError, forbidden, validate, createNumbered, parseListQuery } from './shared.js';
import { createInvoiceSchema, recordPaymentSchema } from '../validation/invoice.js';

const invoiceReaders = ['ADMIN', 'AR', 'SALES'];
const invoiceWriters = ['ADMIN', 'AR'];
const invoiceableStatuses = ['SHIPPED', 'DO_RETURNED', 'COMPLETED'];

export function createInvoiceService({ invoiceModel, paymentModel, salesOrderModel }) {
  return {
    async listInvoices(user, query = {}) {
      if (!invoiceReaders.includes(user.role)) throw forbidden();
      const { page, limit, skip } = parseListQuery(query);
      const filter = {};
      if (query.customerId) filter.customerId = query.customerId;
      if (query.status) filter.status = query.status;
      const [invoices, total] = await Promise.all([
        invoiceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        invoiceModel.countDocuments(filter),
      ]);
      return { invoices, total, page, limit };
    },

    async getInvoiceById(id, user) {
      if (!invoiceReaders.includes(user.role)) throw forbidden();
      const invoice = await invoiceModel.findById(id).lean();
      if (!invoice) throw new ApiError(404, 'Invoice not found');
      const payments = await paymentModel.find({ invoiceId: invoice._id }).sort({ paidAt: -1 }).lean();
      return { invoice, payments, outstandingAmount: Math.max(0, invoice.totalAmount - invoice.paidAmount) };
    },

    async createInvoice(body, user) {
      if (!invoiceWriters.includes(user.role)) throw forbidden();
      const input = validate(createInvoiceSchema, body);
      const so = await salesOrderModel.findById(input.soId);
      if (!so) throw new ApiError(404, 'Sales Order not found');
      if (!invoiceableStatuses.includes(so.status)) throw new ApiError(409, `Sales Order status ${so.status} cannot be invoiced`);
      const existing = await invoiceModel.findOne({ soId: so._id, status: { $ne: 'VOID' } });
      if (existing) throw new ApiError(409, 'Active invoice already exists for this Sales Order');
      const items = so.items.map((item, index) => {
        const qty = Number(item.qtyShipped ?? item.qtyOrdered);
        return { soItemIndex: index, sku: item.sku, name: item.name, qty, unitPrice: item.unitPrice, totalPrice: qty * item.unitPrice };
      }).filter((item) => item.qty > 0);
      if (!items.length) throw new ApiError(409, 'Sales Order has no shipped quantity to invoice');
      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new ApiError(409, 'Invoice total must be positive');
      const invoice = await createNumbered(invoiceModel, 'invoiceNumber', 'INV', (invoiceNumber) => ({
        invoiceNumber, soId: so._id, soNumber: so.soNumber, customerId: so.customerId,
        customerName: so.customerName, items, totalAmount, paidAmount: 0, status: 'ISSUED',
        dueDate: new Date(input.dueDate), notes: input.notes ?? '', issuedBy: user.id,
      }));
      const update = await salesOrderModel.updateOne({ _id: so._id, status: { $in: invoiceableStatuses } }, { $set: { status: 'INVOICING' } });
      if (update.matchedCount === 0) {
        await invoiceModel.deleteOne?.({ _id: invoice._id });
        throw new ApiError(409, 'Sales Order status changed; retry invoice creation');
      }
      return { invoice };
    },

    async recordPayment(body, user) {
      if (!invoiceWriters.includes(user.role)) throw forbidden();
      const input = validate(recordPaymentSchema, body);
      const invoice = await invoiceModel.findById(input.invoiceId);
      if (!invoice) throw new ApiError(404, 'Invoice not found');
      if (!['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) throw new ApiError(409, `Cannot record payment for invoice with status ${invoice.status}`);
      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
      const payment = await createNumbered(paymentModel, 'paymentNumber', 'PAY', (paymentNumber) => ({
        paymentNumber, invoiceId: invoice._id, soId: invoice.soId, amount: input.amount,
        paymentMethod: input.paymentMethod, paidAt, referenceNo: input.referenceNo,
        notes: input.notes, receivedBy: user.id,
      }));
      const updated = await invoiceModel.findOneAndUpdate(
        { _id: invoice._id, status: { $in: ['ISSUED', 'PARTIALLY_PAID'] }, paidAmount: invoice.paidAmount, $expr: { $gte: ['$totalAmount', { $add: ['$paidAmount', input.amount] }] } },
        { $inc: { paidAmount: input.amount }, $set: { updatedAt: new Date() } },
        { new: true },
      ).lean();
      if (!updated) {
        await paymentModel.deleteOne?.({ _id: payment._id });
        throw new ApiError(409, 'Payment exceeds outstanding balance or invoice changed; retry');
      }
      const fullyPaid = updated.paidAmount >= updated.totalAmount;
      const settled = fullyPaid
        ? await invoiceModel.findOneAndUpdate({ _id: updated._id, paidAmount: updated.paidAmount }, { $set: { status: 'PAID' } }, { new: true }).lean()
        : await invoiceModel.findOneAndUpdate({ _id: updated._id, paidAmount: updated.paidAmount }, { $set: { status: 'PARTIALLY_PAID' } }, { new: true }).lean();
      if (!settled) throw new ApiError(409, 'Invoice changed while recording payment; reconcile payment before retrying');
      if (fullyPaid) await salesOrderModel.updateOne({ _id: settled.soId }, { $set: { status: 'PAID' } });
      return { payment, invoice: settled, outstandingAmount: Math.max(0, settled.totalAmount - settled.paidAmount) };
    },
  };
}
