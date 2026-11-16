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
const contact = z.string().trim().min(3, 'contact must be 3-80 characters').max(80, 'contact must be 3-80 characters');

const createVendorSchema = z.object({ name, contact });
const updateVendorSchema = z.object({ name: name.optional(), contact: contact.optional() });

export function serializeVendor(document) {
  const vendor = plain(document);
  return {
    id: toId(vendor),
    name: vendor.name,
    contact: vendor.contact,
    createdAt: toIso(vendor.createdAt),
    updatedAt: toIso(vendor.updatedAt),
  };
}

export function createVendorService({ vendorModel }) {
  return {
    async list(query = {}) {
      const pagination = parseListQuery(query);
      return listResult(vendorModel, searchFilter(query.search, ['name']), pagination, serializeVendor);
    },

    async get(id) {
      assertId(id, 'Vendor');
      const vendor = await vendorModel.findById(id).lean();
      if (!vendor) throw notFound('Vendor');
      return serializeVendor(vendor);
    },

    async create(body) {
      const input = validate(createVendorSchema, body);
      return serializeVendor(await vendorModel.create(input));
    },

    async update(id, body) {
      assertId(id, 'Vendor');
      const input = validate(updateVendorSchema, body);
      if (Object.keys(input).length === 0) return this.get(id);

      const vendor = await vendorModel.findOneAndUpdate({ _id: id }, { $set: input }, { new: true }).lean();
      if (!vendor) throw notFound('Vendor');
      return serializeVendor(vendor);
    },
  };
}
