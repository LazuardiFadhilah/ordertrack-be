import {
  assertId,
  forbidden,
  listResult,
  notFound,
  parseListQuery,
  plain,
  toId,
  toIso,
} from './shared.js';

export function serializeSalesOrder(document, vendorPos = [], goodsReceipts = []) {
  const order = plain(document);
  return {
    id: toId(order),
    soNumber: order.soNumber,
    customerPoNumber: order.customerPoNumber ?? '',
    customerId: String(order.customerId),
    customerName: order.customerName,
    quotationId: String(order.quotationId),
    quotationNumber: order.quotationNumber,
    salesId: String(order.salesId),
    salesName: order.salesName,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyShipped: item.qtyShipped,
      qtyInvoiced: item.qtyInvoiced,
      unitPrice: item.unitPrice,
    })),
    totalAmount: order.totalAmount,
    status: order.status,
    vendorPos: vendorPos.map((po) => ({
      id: toId(po),
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      status: po.status,
      createdAt: toIso(po.createdAt),
    })),
    goodsReceipts: goodsReceipts.map((gr) => ({
      id: toId(gr),
      grNumber: gr.grNumber,
      vendorPoNumber: gr.vendorPoNumber,
      receivedAt: toIso(gr.receivedAt),
    })),
    createdAt: toIso(order.createdAt),
  };
}

export function createSalesOrderService({ salesOrderModel, vendorPoModel, goodsReceiptModel }) {
  async function canRead(order, user) {
    if (user.role === 'SALES' && String(order.salesId) !== String(user.id)) throw forbidden();
  }

  return {
    async list(query = {}, user) {
      const pagination = parseListQuery(query);
      const filter = {};
      if (query.status) filter.status = String(query.status);
      if (query.customerId) filter.customerId = String(query.customerId);
      if (user.role === 'SALES') filter.salesId = String(user.id);

      return listResult(salesOrderModel, filter, pagination, (doc) => serializeSalesOrder(doc));
    },

    async get(id, user) {
      assertId(id, 'Sales order');
      const order = await salesOrderModel.findById(id).lean();
      if (!order) throw notFound('Sales order');
      await canRead(order, user);

      const vendorPos = await vendorPoModel.find({ soId: id }).sort({ createdAt: -1 }).lean();
      const goodsReceipts = await goodsReceiptModel.find({ soId: id }).sort({ createdAt: -1 }).lean();

      return serializeSalesOrder(order, vendorPos, goodsReceipts);
    },
  };
}
