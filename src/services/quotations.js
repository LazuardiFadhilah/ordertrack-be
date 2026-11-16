import { z } from 'zod';
import {
  ApiError,
  assertId,
  conflict,
  createNumbered,
  forbidden,
  isId,
  listResult,
  notFound,
  parseListQuery,
  plain,
  round2,
  toId,
  toIso,
  validate,
} from './shared.js';

const itemSchema = z.object({
  sku: z.string().trim().min(2, 'sku must be 2-40 characters').max(40, 'sku must be 2-40 characters'),
  name: z.string().trim().min(2, 'name must be 2-120 characters').max(120, 'name must be 2-120 characters'),
  qty: z.number().int('qty must be an integer').min(1, 'qty must be at least 1'),
  unitPrice: z
    .number()
    .min(0, 'unitPrice must be at least 0')
    .refine((value) => Number.isInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
      message: 'unitPrice must have at most 2 decimals',
    }),
});

const createQuotationSchema = z.object({
  customerId: z.string().trim().min(1, 'customerId is required'),
  items: z.array(itemSchema).min(1, 'items must contain at least one entry'),
});

const updateQuotationSchema = z.object({
  customerId: z.string().trim().min(1, 'customerId is required').optional(),
  items: z.array(itemSchema).min(1, 'items must contain at least one entry').optional(),
});

const convertQuotationSchema = z.object({
  customerPoNumber: z.string().trim().max(60, 'customerPoNumber must be at most 60 characters').optional(),
});

export function sumItems(items) {
  const lines = items.map((item) => ({ ...item, lineTotal: round2(item.qty * item.unitPrice) }));
  return { lines, totalAmount: round2(lines.reduce((total, line) => total + line.lineTotal, 0)) };
}

export function serializeQuotation(document) {
  const quotation = plain(document);
  return {
    id: toId(quotation),
    number: quotation.number,
    customerId: String(quotation.customerId),
    customerName: quotation.customerName,
    items: quotation.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    totalAmount: quotation.totalAmount,
    status: quotation.status,
    createdBy: { id: quotation.createdBy.id, name: quotation.createdBy.name },
    salesOrderId: quotation.salesOrderId ?? null,
    createdAt: toIso(quotation.createdAt),
    updatedAt: toIso(quotation.updatedAt),
  };
}

export function createQuotationService({ quotationModel, customerModel, salesOrderModel }) {
  async function load(id, user) {
    assertId(id, 'Quotation');
    const quotation = await quotationModel.findById(id).lean();
    if (!quotation) throw notFound('Quotation');
    assertOwnership(quotation, user);
    return quotation;
  }

  async function assertCustomer(customerId) {
    const customer = isId(customerId) ? await customerModel.findById(customerId).lean() : null;
    if (!customer) {
      throw new ApiError(400, 'Invalid request', [{ field: 'customerId', message: 'Customer not found' }]);
    }
    return customer;
  }

  return {
    async list(query = {}, user) {
      const pagination = parseListQuery(query);
      const filter = {};
      if (query.status) filter.status = String(query.status);
      if (query.customerId) filter.customerId = String(query.customerId);
      if (user.role === 'SALES') filter['createdBy.id'] = String(user.id);

      return listResult(quotationModel, filter, pagination, serializeQuotation);
    },

    async get(id, user) {
      return serializeQuotation(await load(id, user));
    },

    async create(body, user) {
      const input = validate(createQuotationSchema, body);
      const customer = await assertCustomer(input.customerId);
      const { lines, totalAmount } = sumItems(input.items);

      const quotation = await createNumbered(quotationModel, 'number', 'QTN', (number) => ({
        number,
        customerId: String(customer._id ?? customer.id),
        customerName: customer.name,
        items: lines,
        totalAmount,
        status: 'DRAFT',
        createdBy: { id: String(user.id), name: user.name },
        salesOrderId: null,
      }));

      return serializeQuotation(quotation);
    },

    async update(id, body, user) {
      const quotation = await load(id, user);
      if (quotation.status !== 'DRAFT') throw conflict('Only DRAFT quotations can be updated');

      const input = validate(updateQuotationSchema, body);
      const patch = {};
      if (input.customerId !== undefined) {
        const customer = await assertCustomer(input.customerId);
        patch.customerId = String(customer._id ?? customer.id);
        patch.customerName = customer.name;
      }
      if (input.items !== undefined) {
        const { lines, totalAmount } = sumItems(input.items);
        patch.items = lines;
        patch.totalAmount = totalAmount;
      }
      if (Object.keys(patch).length === 0) return serializeQuotation(quotation);

      const updated = await quotationModel
        .findOneAndUpdate({ _id: id }, { $set: patch }, { new: true })
        .lean();
      if (!updated) throw notFound('Quotation');
      return serializeQuotation(updated);
    },

    async send(id, user) {
      const quotation = await load(id, user);
      if (quotation.status !== 'DRAFT') throw conflict('Only DRAFT quotations can be sent');
      return serializeQuotation(await transition(quotationModel, id, 'SENT'));
    },

    async lose(id, user) {
      const quotation = await load(id, user);
      if (quotation.status !== 'DRAFT' && quotation.status !== 'SENT') {
        throw conflict('Only DRAFT or SENT quotations can be lost');
      }
      return serializeQuotation(await transition(quotationModel, id, 'LOST'));
    },

    async convert(id, body, user) {
      const quotation = await load(id, user);
      if (quotation.status !== 'SENT') throw conflict('Only SENT quotations can be converted');

      const input = validate(convertQuotationSchema, body);
      const claimed = await quotationModel
        .findOneAndUpdate({ _id: id, status: 'SENT' }, { $set: { status: 'CONVERTED' } }, { new: true })
        .lean();
      if (!claimed) throw conflict('Quotation is no longer available for conversion');

      let salesOrder;
      try {
        salesOrder = await createNumbered(salesOrderModel, 'soNumber', 'SO', (soNumber) => ({
          soNumber,
          customerPoNumber: input.customerPoNumber ?? '',
          customerId: String(quotation.customerId),
          customerName: quotation.customerName,
          quotationId: String(quotation._id),
          quotationNumber: quotation.number,
          salesId: quotation.createdBy.id,
          salesName: quotation.createdBy.name,
          items: quotation.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            qtyOrdered: item.qty,
            qtyReceived: 0,
            qtyShipped: 0,
            qtyInvoiced: 0,
            unitPrice: item.unitPrice,
          })),
          totalAmount: quotation.totalAmount,
          status: 'PO_RECEIVED',
        }));
      } catch (error) {
        await quotationModel.findOneAndUpdate({ _id: id }, { $set: { status: 'SENT' } }).lean();
        throw error;
      }

      const converted = await quotationModel
        .findOneAndUpdate({ _id: id }, { $set: { salesOrderId: String(salesOrder._id ?? salesOrder.id) } }, { new: true })
        .lean();

      return {
        quotation: {
          id: toId(converted),
          number: converted.number,
          status: converted.status,
          salesOrderId: converted.salesOrderId,
        },
        salesOrder: serializeSalesOrderReference(salesOrder),
      };
    },
  };
}

function assertOwnership(quotation, user) {
  if (user.role === 'SALES' && String(quotation.createdBy.id) !== String(user.id)) throw forbidden();
}

async function transition(model, id, status) {
  const updated = await model.findOneAndUpdate({ _id: id }, { $set: { status } }, { new: true }).lean();
  if (!updated) throw notFound('Quotation');
  return updated;
}

function serializeSalesOrderReference(salesOrder) {
  const order = plain(salesOrder);
  return { id: toId(order), soNumber: order.soNumber, status: order.status };
}
