import { Router } from 'express';
import Document from '../models/Document.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { createDocumentService } from '../services/documents.js';
import { env } from '../config/env.js';

export function createDocumentsRouter({ documentModel = Document, notificationService, authenticate = authenticateUser, settings = env } = {}) {
  const router = Router();
  const service = createDocumentService({ documentModel, notificationService, settings });
  router.use(authenticate);
  router.post('/upload-intents', requireRole('ADMIN', 'SALES', 'GA', 'AR', 'AP', 'PURCHASING'), async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.createUploadIntent(req.body, req.user) }); } catch (error) { next(error); }
  });
  router.get('/so/:soId', async (req, res, next) => {
    try { res.json({ success: true, data: await service.listBySo(req.params.soId, req.user) }); } catch (error) { next(error); }
  });
  router.get('/:documentId', async (req, res, next) => {
    try { res.json({ success: true, data: { document: await service.getById(req.params.documentId, req.user) } }); } catch (error) { next(error); }
  });
  router.post('/', requireRole('ADMIN', 'SALES', 'GA', 'AR', 'AP', 'PURCHASING'), async (req, res, next) => {
    try { res.status(201).json({ success: true, data: { document: await service.create(req.body, req.user) } }); } catch (error) { next(error); }
  });
  return router;
}
export default createDocumentsRouter();
