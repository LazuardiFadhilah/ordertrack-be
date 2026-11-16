import { createVendorService } from '../services/vendors.js';

export function createVendorsController({ vendorModel }) {
  const service = createVendorService({ vendorModel });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query) });
    },
    async get(request, response) {
      response.json({ success: true, data: { vendor: await service.get(request.params.id) } });
    },
    async create(request, response) {
      response.status(201).json({ success: true, data: { vendor: await service.create(request.body) } });
    },
    async update(request, response) {
      response.json({ success: true, data: { vendor: await service.update(request.params.id, request.body) } });
    },
  };
}
