import { createQuotationService } from '../services/quotations.js';

export function createQuotationsController({ quotationModel, customerModel, salesOrderModel }) {
  const service = createQuotationService({ quotationModel, customerModel, salesOrderModel });

  return {
    async list(request, response) {
      response.json({ success: true, data: await service.list(request.query, request.user) });
    },
    async get(request, response) {
      response.json({ success: true, data: { quotation: await service.get(request.params.id, request.user) } });
    },
    async create(request, response) {
      response
        .status(201)
        .json({ success: true, data: { quotation: await service.create(request.body, request.user) } });
    },
    async update(request, response) {
      response.json({
        success: true,
        data: { quotation: await service.update(request.params.id, request.body, request.user) },
      });
    },
    async send(request, response) {
      response.json({ success: true, data: { quotation: await service.send(request.params.id, request.user) } });
    },
    async lose(request, response) {
      response.json({ success: true, data: { quotation: await service.lose(request.params.id, request.user) } });
    },
    async convert(request, response) {
      response.status(201).json({ success: true, data: await service.convert(request.params.id, request.body, request.user) });
    },
  };
}
