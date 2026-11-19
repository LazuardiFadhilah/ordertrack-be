import { z } from 'zod';
import {
  ApiError,
  assertId,
  createNumbered,
  forbidden,
  isId,
  listResult,
  notFound,
  parseListQuery,
  plain,
  toId,
  toIso,
  validate,
} from './shared.js';

const vendorPoItemSchema = z.object({
  soItemIndex: z.number().int('soItemIndex must be an integer').min(0, 'soItemIndex must be at least 0'),
  qty: z.number().int('qty must be an integer').min(1, 'qty must be at least 1'),
});

const createVendorPoSchema = z.object({
  soId: z.string().trim().min(1, 'soId is required'),
  vendorId: z.string().trim().min(1, 'vendorId is required'),
  items: z.array(vendorPoItemSchema).min(1, 'items must contain at least one entry'),
});

export function serializeVendorPo(document) {
  const po = plain(document);
  return {
    id: toId(po),
    poNumber: po.poNumber,
    soId: String(po.soId),
    soNumber: po.soNumber,
    vendorId: String(po.vendorId),
    vendorName: po.vendorName,
    items: po.items.map((item) => ({
      soItemIndex: item.soItemIndex,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
    })),
    status: po.status,
    createdBy: { id: po.createdBy.id, name: po.createdBy.name },
    createdAt: toIso(po.createdAt),
  };
}

export function createVendorPoService({ salesOrderModel, vendorPoModel, vendorModel, goodsReceiptModel, notificationService }) {
  const notify = notificationService?.notify ?? (() => Promise.resolve());
  async function loadSo(soId, user) {
    assertId(soId, 'Sales order');
    const so = await salesOrderModel.findById(soId).lean();
    if (!so) throw notFound('Sales order');
    if (user.role === 'SALES' && String(so.salesId) !== String(user.id)) throw forbidden();
    return so;
  }

  async function loadVendor(vendorId) {
    assertId(vendorId, 'Vendor');
    const vendor = await vendorModel.findById(vendorId).lean();
    if (!vendor) {
      throw new ApiError(400, 'Invalid request', [{ field: 'vendorId', message: 'Vendor not found' }]);
    }
    return vendor;
  }

  function assertSoItemIndexes(so, items) {
    for (const item of items) {
      if (item.soItemIndex < 0 || item.soItemIndex >= so.items.length) {
        throw new ApiError(400, 'Invalid request', [{ field: `items.${so.items.indexOf(item)}.soItemIndex`, message: 'Invalid item index' }]);
      }
    }
  }

  return {
    async list(query = {}, user) {
      const pagination = parseListQuery(query);
      const filter = {};
      if (query.soId) filter.soId = query.soId;
      if (query.vendorId) filter.vendorId = query.vendorId;
      if (user.role === 'SALES') {
        // Need SO scoping: only Vendor POs belonging to SOs owned by the sales user.
        const orders = await salesOrderModel.find({ salesId: String(user.id) }).lean();
        const soIds = orders.map((order) => String(order._id));
        filter.soId = { $in: soIds };
      }

      return listResult(vendorPoModel, filter, pagination, serializeVendorPo);
    },

    async get(id, user) {
      assertId(id, 'Vendor PO');
      const po = await vendorPoModel.findById(id).lean();
      if (!po) throw notFound('Vendor PO');
      await loadSo(po.soId, user);
      return serializeVendorPo(po);
    },

    async create(body, user) {
      const input = validate(createVendorPoSchema, body);
      const so = await loadSo(input.soId, user);
      const vendor = await loadVendor(input.vendorId);
      assertSoItemIndexes(so, input.items);

      const enrichedItems = input.items.map((item) => ({
        soItemIndex: item.soItemIndex,
        sku: so.items[item.soItemIndex].sku,
        name: so.items[item.soItemIndex].name,
        qty: item.qty,
      }));

      const vendorPo = await createNumbered(vendorPoModel, 'poNumber', 'VPO', (poNumber) => ({
        poNumber,
        soId: so._id,
        soNumber: so.soNumber,
        vendorId: vendor._id,
        vendorName: vendor.name,
        items: enrichedItems,
        status: 'ISSUED',
        createdBy: { id: String(user.id), name: user.name },
      }));

      await recomputeSoStatus(salesOrderModel, vendorPoModel, goodsReceiptModel, so._id);
      await notify({ roles: ['GA'], soId: so._id, type: 'VENDOR_PO_CREATED', title: 'Vendor PO dibuat', message: `Vendor PO ${vendorPo.poNumber} dibuat`, entityType: 'VendorPO', entityId: vendorPo._id, actor: user });

      return serializeVendorPo(vendorPo);
    },
  };
}

export async function recomputeSoStatus(salesOrderModel, vendorPoModel, goodsReceiptModel, soId) {
  const so = await salesOrderModel.findById(soId).lean();
  if (!so) return;

  const totalOrdered = so.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const totalReceived = so.items.reduce((sum, item) => sum + item.qtyReceived, 0);

  let nextStatus = so.status;
  if (totalReceived >= totalOrdered) {
    nextStatus = 'GOODS_RECEIVED';
  } else if (totalReceived > 0) {
    nextStatus = 'PARTIAL_RECEIVED';
  } else {
    const vendorPoCount = await vendorPoModel.countDocuments({ soId });
    nextStatus = vendorPoCount > 0 ? 'PROCURING' : 'PO_RECEIVED';
  }

  if (nextStatus !== so.status) {
    await salesOrderModel.findOneAndUpdate({ _id: soId }, { $set: { status: nextStatus } }, { new: true }).lean();
  }
}
