import { ApiError, forbidden, listResult, validate } from './shared.js';
import { documentSchema } from '../validation/document.js';

const readers = ['ADMIN', 'SALES', 'GA', 'AR', 'AP', 'PURCHASING'];
const writers = readers;

export function createDocumentService({ documentModel, notificationService }) {
  const notify = notificationService?.notify ?? (() => Promise.resolve());
  return {
    async listBySo(soId, user) {
      if (!readers.includes(user.role)) throw forbidden();
      return listResult(documentModel, { soId }, { page: 1, limit: 100, skip: 0 }, (document) => document, { uploadedAt: -1 });
    },
    async create(body, user) {
      if (!writers.includes(user.role)) throw forbidden();
      const input = validate(documentSchema, body);
      // ponytail: storage is intentionally provider-neutral; fileUrl must be a pre-signed upload/result URL.
      const document = await documentModel.create({ ...input, uploadedBy: user.id, uploadedAt: new Date() });
      const roles = input.refType === 'DO_SIGNED' ? ['AR'] : input.refType === 'RECEIPT_EXCHANGE' ? ['SALES'] : [];
      if (roles.length) await notify({ roles, soId: input.soId, type: `${input.refType}_UPLOADED`, title: 'Dokumen diperbarui', message: `${input.refType} telah diunggah`, entityType: 'Document', entityId: document._id, actor: user });
      return document;
    },
  };
}
