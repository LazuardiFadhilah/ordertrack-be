import { z } from 'zod';
import {
  assertId,
  listResult,
  notFound,
  parseListQuery,
  plain,
  searchFilter,
  toId,
  toIso,
  validate,
} from './shared.js';

const name = z.string().trim().min(2, 'name must be 2-120 characters').max(120, 'name must be 2-120 characters');
const address = z.string().trim().min(1, 'address is required');
const contact = z.string().trim().min(3, 'contact must be 3-80 characters').max(80, 'contact must be 3-80 characters');
const npwp = z
  .string()
  .trim()
  .transform((value) => value.replace(/[.\-\s]/g, ''))
  .refine((value) => /^\d{15}$|^\d{16}$/.test(value), { message: 'npwp must be 15 or 16 digits' });

const createCustomerSchema = z.object({
  name,
  address,
  contact,
  npwp,
  npwpName: z.string().trim().min(1, 'npwpName is required'),
  taxAddress: z.string().trim().min(1, 'taxAddress is required'),
});

const updateCustomerSchema = z.object({
  name: name.optional(),
  address: address.optional(),
  contact: contact.optional(),
  npwp: npwp.optional(),
  npwpName: z.string().trim().min(1, 'npwpName is required').optional(),
  taxAddress: z.string().trim().min(1, 'taxAddress is required').optional(),
});

export function serializeCustomer(document) {
  const customer = plain(document);
  return {
    id: toId(customer),
    name: customer.name,
    address: customer.address,
    contact: customer.contact,
    npwp: customer.npwp,
    npwpName: customer.npwpName,
    taxAddress: customer.taxAddress,
    createdAt: toIso(customer.createdAt),
    updatedAt: toIso(customer.updatedAt),
  };
}

export function createCustomerService({ customerModel }) {
  return {
    async list(query = {}) {
      const pagination = parseListQuery(query);
      return listResult(customerModel, searchFilter(query.search, ['name', 'npwp']), pagination, serializeCustomer);
    },

    async get(id) {
      assertId(id, 'Customer');
      const customer = await customerModel.findById(id).lean();
      if (!customer) throw notFound('Customer');
      return serializeCustomer(customer);
    },

    async create(body) {
      const input = validate(createCustomerSchema, body);
      return serializeCustomer(await customerModel.create(input));
    },

    async update(id, body) {
      assertId(id, 'Customer');
      const input = validate(updateCustomerSchema, body);
      if (Object.keys(input).length === 0) return this.get(id);

      const customer = await customerModel.findOneAndUpdate({ _id: id }, { $set: input }, { new: true }).lean();
      if (!customer) throw notFound('Customer');
      return serializeCustomer(customer);
    },
  };
}
