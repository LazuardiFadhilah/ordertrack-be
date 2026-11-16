import { createCustomerService } from '../services/customers.js';

export function createCustomersController({ customerModel }) {
  const service = createCustomerService({ customerModel });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query) });
    },
    async get(request, response) {
      response.json({ success: true, data: { customer: await service.get(request.params.id) } });
    },
    async create(request, response) {
      response.status(201).json({ success: true, data: { customer: await service.create(request.body) } });
    },
    async update(request, response) {
      response.json({ success: true, data: { customer: await service.update(request.params.id, request.body) } });
    },
  };
}
