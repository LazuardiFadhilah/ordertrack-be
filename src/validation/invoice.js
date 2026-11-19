import { z } from 'zod';

export const createInvoiceSchema = z.object({
  soId: z.string().min(1, 'Sales Order ID is required'),
  dueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  notes: z.string().max(1000).optional(),
}).strict();

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Payment amount must be positive'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'GIRO', 'CASH', 'OTHER']).default('BANK_TRANSFER'),
  referenceNo: z.string().optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(1000).optional(),
}).strict();
