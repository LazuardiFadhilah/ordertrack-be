import { z } from 'zod';

export const recordVendorPaymentSchema = z.object({
  vendorPoId: z.string().min(1, 'Vendor PO ID is required'),
  amount: z.number().positive('Payment amount must be positive'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'GIRO', 'CASH', 'OTHER']).default('BANK_TRANSFER'),
  referenceNo: z.string().optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(1000).optional(),
}).strict();
