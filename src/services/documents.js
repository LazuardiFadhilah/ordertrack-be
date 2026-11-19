import { ApiError, forbidden, listResult, validate } from './shared.js';
import { documentSchema } from '../validation/document.js';
import { createStorageService } from './storage.js';

const readers = ['ADMIN', 'SALES', 'GA', 'AR', 'AP', 'PURCHASING'];
const writers = readers;

export function createDocumentService({ documentModel, notificationService, settings }) {
  const notify = notificationService?.notify ?? (() => Promise.resolve());
  const storage = createStorageService(settings);
  return {
    async createUploadIntent(body, user) {
      if (!writers.includes(user.role)) throw forbidden();
      return storage.createUploadIntent(body);
    },
    async getById(id, user) {
      if (!readers.includes(user.role)) throw forbidden();
      const document = await documentModel.findById(id).lean();
      if (!document) throw new ApiError(404, 'Document not found');
      return document;
    },
    async listBySo(soId, user) {
      if (!readers.includes(user.role)) throw forbidden();
      return listResult(documentModel, { soId }, { page: 1, limit: 100, skip: 0 }, (document) => document, { uploadedAt: -1 });
    },
    async create(body, user) {
      if (!writers.includes(user.role)) throw forbidden();
      const input = validate(documentSchema, body);
      // ponytail: upload completion is client-confirmed until a provider adapter exists; add provider HEAD verification before production use.
      const document = await documentModel.create({ ...input, uploadedBy: user.id, uploadedAt: new Date() });
      const roles = input.refType === 'DO_SIGNED' ? ['AR'] : input.refType === 'RECEIPT_EXCHANGE' ? ['SALES'] : [];
      if (roles.length) await notify({ roles, soId: input.soId, type: `${input.refType}_UPLOADED`, title: 'Dokumen diperbarui', message: `${input.refType} telah diunggah`, entityType: 'Document', entityId: document._id, actor: user });
      return document;
    },
  };
}
