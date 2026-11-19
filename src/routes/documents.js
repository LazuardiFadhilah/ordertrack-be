import { Router } from 'express';
import Document from '../models/Document.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createDocumentService } from '../services/documents.js';

export function createDocumentsRouter({ documentModel = Document, authenticate = authenticateUser } = {}) {
  const router = Router();
  const service = createDocumentService({ documentModel });
  router.use(authenticate);
  router.get('/so/:soId', async (req, res, next) => {
    try { res.json({ success: true, data: await service.listBySo(req.params.soId, req.user) }); } catch (error) { next(error); }
  });
  router.post('/', requireRole('ADMIN', 'SALES', 'GA', 'AR', 'AP', 'PURCHASING'), async (req, res, next) => {
    try { res.status(201).json({ success: true, data: { document: await service.create(req.body, req.user) } }); } catch (error) { next(error); }
  });
  return router;
}
export default createDocumentsRouter();
