import { z } from 'zod';

export const documentSchema = z.object({
  soId: z.string().min(1),
  refType: z.string().trim().min(1).max(50),
  refId: z.string().trim().min(1).max(100),
  fileUrl: z.string().trim().url(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});
