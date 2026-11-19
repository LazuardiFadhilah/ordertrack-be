import { z } from 'zod';
import {
  ApiError,
  assertId,
  createNumbered,
  forbidden,
  listResult,
  notFound,
  parseListQuery,
  plain,
  toId,
  toIso,
  validate,
} from './shared.js';
import { recomputeSoStatus } from './vendorPo.js';

const goodsReceiptItemSchema = z.object({
  soItemIndex: z.number().int('soItemIndex must be an integer').min(0, 'soItemIndex must be at least 0'),
  qtyReceived: z.number().int('qtyReceived must be an integer').min(1, 'qtyReceived must be at least 1'),
});

const createGoodsReceiptSchema = z.object({
  soId: z.string().trim().min(1, 'soId is required'),
  vendorPoId: z.string().trim().min(1, 'vendorPoId is required'),
  items: z.array(goodsReceiptItemSchema).min(1, 'items must contain at least one entry'),
});

export function serializeGoodsReceipt(document) {
  const gr = plain(document);
  return {
    id: toId(gr),
    grNumber: gr.grNumber,
    soId: String(gr.soId),
    soNumber: gr.soNumber,
    vendorPoId: String(gr.vendorPoId),
    vendorPoNumber: gr.vendorPoNumber,
    items: gr.items.map((item) => ({
      soItemIndex: item.soItemIndex,
      sku: item.sku,
      name: item.name,
      qtyReceived: item.qtyReceived,
    })),
    receivedBy: { id: gr.receivedBy.id, name: gr.receivedBy.name },
    receivedAt: toIso(gr.receivedAt),
    createdAt: toIso(gr.createdAt),
  };
}

export function createGoodsReceiptService({ salesOrderModel, vendorPoModel, goodsReceiptModel, notificationService }) {
  const notify = notificationService?.notify ?? (() => Promise.resolve());
  async function loadSo(soId, user) {
    assertId(soId, 'Sales order');
    const so = await salesOrderModel.findById(soId).lean();
    if (!so) throw notFound('Sales order');
    if (user.role === 'SALES' && String(so.salesId) !== String(user.id)) throw forbidden();
    return so;
  }

  async function loadVendorPo(vendorPoId, soId) {
    assertId(vendorPoId, 'Vendor PO');
    const po = await vendorPoModel.findById(vendorPoId).lean();
    if (!po) throw notFound('Vendor PO');
    if (String(po.soId) !== String(soId)) {
      throw new ApiError(400, 'Invalid request', [{ field: 'vendorPoId', message: 'Vendor PO does not belong to this sales order' }]);
    }
    return po;
  }

  return {
    async list(query = {}, user) {
      const pagination = parseListQuery(query);
      const filter = {};
      if (query.soId) filter.soId = query.soId;
      if (query.vendorPoId) filter.vendorPoId = query.vendorPoId;
      if (user.role === 'SALES') {
        const orders = await salesOrderModel.find({ salesId: String(user.id) }).lean();
        const soIds = orders.map((order) => String(order._id));
        filter.soId = { $in: soIds };
      }

      return listResult(goodsReceiptModel, filter, pagination, serializeGoodsReceipt);
    },

    async get(id, user) {
      assertId(id, 'Goods receipt');
      const gr = await goodsReceiptModel.findById(id).lean();
      if (!gr) throw notFound('Goods receipt');
      await loadSo(gr.soId, user);
      return serializeGoodsReceipt(gr);
    },

    async create(body, user) {
      const input = validate(createGoodsReceiptSchema, body);
      const so = await loadSo(input.soId, user);
      const vendorPo = await loadVendorPo(input.vendorPoId, input.soId);

      const enrichedItems = [];
      for (const item of input.items) {
        if (item.soItemIndex < 0 || item.soItemIndex >= so.items.length) {
          throw new ApiError(400, 'Invalid request', [{ field: `items.${input.items.indexOf(item)}.soItemIndex`, message: 'Invalid item index' }]);
        }

        const currentReceived = so.items[item.soItemIndex].qtyReceived;
        const ordered = so.items[item.soItemIndex].qtyOrdered;
        if (currentReceived + item.qtyReceived > ordered) {
          throw new ApiError(400, 'Invalid request', [
            { field: `items.${input.items.indexOf(item)}.qtyReceived`, message: 'Total received exceeds ordered quantity' },
          ]);
        }

        enrichedItems.push({
          soItemIndex: item.soItemIndex,
          sku: so.items[item.soItemIndex].sku,
          name: so.items[item.soItemIndex].name,
          qtyReceived: item.qtyReceived,
        });
      }

      const goodsReceipt = await createNumbered(goodsReceiptModel, 'grNumber', 'GR', (grNumber) => ({
        grNumber,
        soId: so._id,
        soNumber: so.soNumber,
        vendorPoId: vendorPo._id,
        vendorPoNumber: vendorPo.poNumber,
        items: enrichedItems,
        receivedBy: { id: String(user.id), name: user.name },
        receivedAt: new Date(),
      }));

      // Increment qtyReceived on SO items
      const itemUpdates = {};
      for (const item of input.items) {
        itemUpdates[`items.${item.soItemIndex}.qtyReceived`] = item.qtyReceived;
      }
      await salesOrderModel.findOneAndUpdate({ _id: so._id }, { $inc: itemUpdates }, { new: true }).lean();

      // Update vendorPo status
      await updateVendorPoStatus(vendorPoModel, goodsReceiptModel, vendorPo._id);

      await recomputeSoStatus(salesOrderModel, vendorPoModel, goodsReceiptModel, so._id);
      await notify({ userIds: [so.salesId], soId: so._id, type: 'GOODS_RECEIPT_CREATED', title: 'Barang diterima', message: `Goods receipt ${goodsReceipt.grNumber} diinput`, entityType: 'GoodsReceipt', entityId: goodsReceipt._id, actor: user });

      return serializeGoodsReceipt(goodsReceipt);
    },
  };
}

async function updateVendorPoStatus(vendorPoModel, goodsReceiptModel, vendorPoId) {
  const vendorPo = await vendorPoModel.findById(vendorPoId).lean();
  if (!vendorPo) return;

  const totalOrderedByItem = {};
  for (const item of vendorPo.items) {
    totalOrderedByItem[item.soItemIndex] = (totalOrderedByItem[item.soItemIndex] ?? 0) + item.qty;
  }

  const receipts = await goodsReceiptModel.find({ vendorPoId }).lean();
  const totalReceivedByItem = {};
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      totalReceivedByItem[item.soItemIndex] = (totalReceivedByItem[item.soItemIndex] ?? 0) + item.qtyReceived;
    }
  }

  let allFullyReceived = true;
  let anyReceived = false;

  for (const item of vendorPo.items) {
    const received = totalReceivedByItem[item.soItemIndex] ?? 0;
    const ordered = totalOrderedByItem[item.soItemIndex];
    if (received > 0) anyReceived = true;
    if (received < ordered) allFullyReceived = false;
  }

  let nextStatus = vendorPo.status;
  if (allFullyReceived && anyReceived) nextStatus = 'RECEIVED';
  else if (anyReceived) nextStatus = 'PARTIAL_RECEIVED';

  if (nextStatus !== vendorPo.status) {
    await vendorPoModel.findOneAndUpdate({ _id: vendorPoId }, { $set: { status: nextStatus } }, { new: true }).lean();
  }
}
