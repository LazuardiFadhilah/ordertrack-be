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

const shippingItemSchema = z.object({
  soItemIndex: z.number().int('soItemIndex must be an integer').min(0, 'soItemIndex must be at least 0'),
  qty: z.number().int('qty must be an integer').min(1, 'qty must be at least 1'),
});

const createShippingRequestSchema = z.object({
  soId: z.string().trim().min(1, 'soId is required'),
  items: z.array(shippingItemSchema).min(1, 'items must contain at least one entry'),
});

const createDeliveryOrderSchema = z.object({
  shippingRequestId: z.string().trim().min(1, 'shippingRequestId is required'),
  items: z.array(shippingItemSchema).min(1, 'items must contain at least one entry'),
});

export function serializeShippingRequest(document) {
  const sr = plain(document);
  return {
    id: toId(sr),
    srNumber: sr.srNumber,
    soId: String(sr.soId),
    soNumber: sr.soNumber,
    items: sr.items.map((item) => ({
      soItemIndex: item.soItemIndex,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
    })),
    status: sr.status,
    requestedBy: { id: sr.requestedBy.id, name: sr.requestedBy.name },
    createdAt: toIso(sr.createdAt),
  };
}

export function serializeDeliveryOrder(document) {
  const doDoc = plain(document);
  return {
    id: toId(doDoc),
    doNumber: doDoc.doNumber,
    soId: String(doDoc.soId),
    soNumber: doDoc.soNumber,
    shippingRequestId: String(doDoc.shippingRequestId),
    shippingRequestNumber: doDoc.shippingRequestNumber,
    items: doDoc.items.map((item) => ({
      soItemIndex: item.soItemIndex,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
    })),
    status: doDoc.status,
    shippedBy: { id: doDoc.shippedBy.id, name: doDoc.shippedBy.name },
    shippedAt: toIso(doDoc.shippedAt),
    createdAt: toIso(doDoc.createdAt),
  };
}

export async function recomputeSoStatusAdvanced(salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, soId) {
  const so = await salesOrderModel.findById(soId).lean();
  if (!so) return;

  const totalOrdered = so.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const totalReceived = so.items.reduce((sum, item) => sum + item.qtyReceived, 0);
  const totalShipped = so.items.reduce((sum, item) => sum + (item.qtyShipped || 0), 0);

  const deliveryOrders = await deliveryOrderModel.find({ soId }).lean();
  const allDoSigned = deliveryOrders.length > 0 && deliveryOrders.every((d) => d.status === 'SIGNED_RETURNED');

  let nextStatus = so.status;

  if (totalShipped >= totalOrdered && totalOrdered > 0) {
    if (allDoSigned) {
      nextStatus = 'COMPLETED';
    } else {
      nextStatus = 'SHIPPED';
    }
  } else if (totalShipped > 0) {
    nextStatus = 'PARTIAL_SHIPPED';
  } else {
    const srCount = await shippingRequestModel.countDocuments({ soId });
    if (srCount > 0) {
      nextStatus = 'SHIPPING_REQUESTED';
    } else if (totalReceived >= totalOrdered && totalOrdered > 0) {
      nextStatus = 'GOODS_RECEIVED';
    } else if (totalReceived > 0) {
      nextStatus = 'PARTIAL_RECEIVED';
    } else {
      const poCount = await vendorPoModel.countDocuments({ soId });
      nextStatus = poCount > 0 ? 'PROCURING' : 'PO_RECEIVED';
    }
  }

  // Preserve later stages if already past shipping/DO return (e.g., INVOICING, PAID, etc.)
  const stageOrder = [
    'PO_RECEIVED',
    'PROCURING',
    'PARTIAL_RECEIVED',
    'GOODS_RECEIVED',
    'SHIPPING_REQUESTED',
    'PARTIAL_SHIPPED',
    'SHIPPED',
    'DO_RETURNED',
    'COMPLETED',
    'INVOICING',
    'PAID',
    'VENDOR_PAID',
    'CLOSED',
  ];

  const currentIdx = stageOrder.indexOf(so.status);
  const nextIdx = stageOrder.indexOf(nextStatus);

  // If current status is beyond DO_RETURNED, don't regress unless explicit, but for now allow updating if forward or within shipping stages
  if (currentIdx !== -1 && nextIdx !== -1) {
    // If we are currently in procurement/receiving or shipping stages, update freely
    if (currentIdx <= stageOrder.indexOf('DO_RETURNED')) {
      if (nextStatus !== so.status) {
        await salesOrderModel.findOneAndUpdate({ _id: soId }, { $set: { status: nextStatus } }, { new: true }).lean();
      }
    }
  }
}

export function createShippingService({ salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, notificationService }) {
  const notify = notificationService?.notify ?? (() => Promise.resolve());
  async function loadSo(soId, user) {
    assertId(soId, 'Sales order');
    const so = await salesOrderModel.findById(soId).lean();
    if (!so) throw notFound('Sales order');
    if (user.role === 'SALES' && String(so.salesId) !== String(user.id)) throw forbidden();
    return so;
  }

  return {
    async listRequests(query = {}, user) {
      const pagination = parseListQuery(query);
      const filter = {};
      if (query.soId) filter.soId = query.soId;
      if (user.role === 'SALES') {
        const orders = await salesOrderModel.find({ salesId: String(user.id) }).lean();
        filter.soId = { $in: orders.map((o) => String(o._id)) };
      }
      return listResult(shippingRequestModel, filter, pagination, serializeShippingRequest);
    },

    async getRequest(id, user) {
      assertId(id, 'Shipping request');
      const sr = await shippingRequestModel.findById(id).lean();
      if (!sr) throw notFound('Shipping request');
      await loadSo(sr.soId, user);
      return serializeShippingRequest(sr);
    },

    async createRequest(body, user) {
      if (!['SALES', 'ADMIN', 'GA'].includes(user.role)) throw forbidden();
      const input = validate(createShippingRequestSchema, body);
      const so = await loadSo(input.soId, user);

      const pendingRequests = await shippingRequestModel.find({ soId: so._id, status: 'REQUESTED' }).lean();

      const enrichedItems = [];
      for (const item of input.items) {
        if (item.soItemIndex < 0 || item.soItemIndex >= so.items.length) {
          throw new ApiError(400, 'Invalid request', [{ field: `items.${input.items.indexOf(item)}.soItemIndex`, message: 'Invalid item index' }]);
        }
        const soItem = so.items[item.soItemIndex];
        const alreadyShipped = soItem.qtyShipped || 0;
        const pendingQty = pendingRequests.reduce((sum, req) => {
          const reqItem = req.items.find((i) => i.soItemIndex === item.soItemIndex);
          return sum + (reqItem ? reqItem.qty : 0);
        }, 0);

        const availableToShip = soItem.qtyReceived - alreadyShipped - pendingQty;

        if (item.qty > availableToShip) {
          throw new ApiError(400, 'Invalid request', [{
            field: `items.${input.items.indexOf(item)}.qty`,
            message: `Cannot request shipping for ${item.qty} units. Only ${availableToShip} units available (received: ${soItem.qtyReceived}, already shipped: ${alreadyShipped}, pending requested: ${pendingQty})`,
          }]);
        }

        enrichedItems.push({
          soItemIndex: item.soItemIndex,
          sku: soItem.sku,
          name: soItem.name,
          qty: item.qty,
        });
      }

      const sr = await createNumbered(shippingRequestModel, 'srNumber', 'SR', (srNumber) => ({
        srNumber,
        soId: so._id,
        soNumber: so.soNumber,
        items: enrichedItems,
        status: 'REQUESTED',
        requestedBy: { id: String(user.id), name: user.name },
      }));

      await recomputeSoStatusAdvanced(salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, so._id);
      await notify({ roles: ['GA'], soId: so._id, type: 'SHIPPING_REQUEST_CREATED', title: 'Permintaan pengiriman baru', message: `Shipping request ${sr.srNumber} dibuat`, entityType: 'ShippingRequest', entityId: sr._id, actor: user });

      return serializeShippingRequest(sr);
    },

    async listDeliveryOrders(query = {}, user) {
      const pagination = parseListQuery(query);
      const filter = {};
      if (query.soId) filter.soId = query.soId;
      if (user.role === 'SALES') {
        const orders = await salesOrderModel.find({ salesId: String(user.id) }).lean();
        filter.soId = { $in: orders.map((o) => String(o._id)) };
      }
      return listResult(deliveryOrderModel, filter, pagination, serializeDeliveryOrder);
    },

    async getDeliveryOrder(id, user) {
      assertId(id, 'Delivery order');
      const doDoc = await deliveryOrderModel.findById(id).lean();
      if (!doDoc) throw notFound('Delivery order');
      await loadSo(doDoc.soId, user);
      return serializeDeliveryOrder(doDoc);
    },

    async createDeliveryOrder(body, user) {
      if (!['GA', 'ADMIN'].includes(user.role)) throw forbidden();
      const input = validate(createDeliveryOrderSchema, body);

      const sr = await shippingRequestModel.findById(input.shippingRequestId).lean();
      if (!sr) throw notFound('Shipping request');
      if (sr.status === 'PROCESSED') {
        throw new ApiError(400, 'Invalid request', [{ field: 'shippingRequestId', message: 'Shipping request already processed' }]);
      }

      const so = await loadSo(sr.soId, user);

      const enrichedItems = [];
      for (const item of input.items) {
        const srItem = sr.items.find((i) => i.soItemIndex === item.soItemIndex);
        if (!srItem) {
          throw new ApiError(400, 'Invalid request', [{ field: 'items', message: `Item index ${item.soItemIndex} not in shipping request` }]);
        }
        if (item.qty > srItem.qty) {
          throw new ApiError(400, 'Invalid request', [{ field: 'items', message: `Cannot ship ${item.qty}, requested only ${srItem.qty}` }]);
        }

        const soItem = so.items[item.soItemIndex];
        enrichedItems.push({
          soItemIndex: item.soItemIndex,
          sku: soItem.sku,
          name: soItem.name,
          qty: item.qty,
        });

        // Update soItem qtyShipped
        soItem.qtyShipped = (soItem.qtyShipped || 0) + item.qty;
      }

      // Save SO updated items
      await salesOrderModel.findOneAndUpdate({ _id: so._id }, { $set: { items: so.items } }, { new: true }).lean();

      // Mark SR as processed
      await shippingRequestModel.findOneAndUpdate({ _id: sr._id }, { $set: { status: 'PROCESSED' } }, { new: true }).lean();

      const doDoc = await createNumbered(deliveryOrderModel, 'doNumber', 'DO', (doNumber) => ({
        doNumber,
        soId: so._id,
        soNumber: so.soNumber,
        shippingRequestId: sr._id,
        shippingRequestNumber: sr.srNumber,
        items: enrichedItems,
        status: 'SHIPPED',
        shippedBy: { id: String(user.id), name: user.name },
      }));

      await recomputeSoStatusAdvanced(salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, so._id);

      return serializeDeliveryOrder(doDoc);
    },

    async markSignedReturned(id, user) {
      if (!['GA', 'ADMIN', 'AR'].includes(user.role)) throw forbidden();
      assertId(id, 'Delivery order');
      const doDoc = await deliveryOrderModel.findById(id).lean();
      if (!doDoc) throw notFound('Delivery order');
      await loadSo(doDoc.soId, user);

      if (doDoc.status === 'SIGNED_RETURNED') {
        return serializeDeliveryOrder(doDoc);
      }

      const updated = await deliveryOrderModel.findOneAndUpdate(
        { _id: id },
        { $set: { status: 'SIGNED_RETURNED' } },
        { new: true },
      ).lean();

      await recomputeSoStatusAdvanced(salesOrderModel, vendorPoModel, goodsReceiptModel, shippingRequestModel, deliveryOrderModel, doDoc.soId);
      await notify({ roles: ['AR'], soId: doDoc.soId, type: 'DO_SIGNED_RETURNED', title: 'DO ditandatangani', message: `DO ${updated.doNumber} telah diunggah`, entityType: 'DeliveryOrder', entityId: updated._id, actor: user });

      return serializeDeliveryOrder(updated);
    },
  };
}
