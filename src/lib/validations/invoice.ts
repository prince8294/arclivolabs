import { z } from 'zod';

import {
  INVOICE_TYPES,
  TAX_TREATMENTS,
} from '@/lib/constants/enums';

const objectIdPattern = /^[a-f\d]{24}$/i;

export const LineItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(500),
  serviceId: z.string().regex(objectIdPattern, 'Invalid service ID').optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
  unit: z.string().trim().max(50).default('unit'),
  unitPriceMinor: z.coerce.number().int().min(0, 'Unit price cannot be negative'),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const CreateInvoiceDraftSchema = z.object({
  clientId: z.string().regex(objectIdPattern, 'Valid Client is required'),
  dealId: z.string().regex(objectIdPattern, 'Invalid Deal ID').optional().nullable(),
  projectId: z.string().regex(objectIdPattern, 'Invalid Project ID').optional().nullable(),
  billingMilestoneId: z.string().regex(objectIdPattern, 'Invalid Milestone ID').optional().nullable(),
  invoiceType: z.nativeEnum(INVOICE_TYPES).default(INVOICE_TYPES.STANDARD),
  currency: z.string().trim().toUpperCase().length(3).default('INR'),
  lineItems: z.array(LineItemInputSchema).min(1, 'At least one line item is required'),
  issueDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date(),
  description: z.string().trim().max(2000).optional().nullable(),
  terms: z.string().trim().max(4000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  billingInstructions: z.string().trim().max(2000).optional().nullable(),
  taxEnabled: z.boolean().default(false),
  taxTreatment: z.nativeEnum(TAX_TREATMENTS).default(TAX_TREATMENTS.NONE),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  taxLabel: z.string().trim().max(50).optional().nullable(),
  sellerState: z.string().trim().max(100).optional().nullable(),
  placeOfSupply: z.string().trim().max(100).optional().nullable(),
});

export const UpdateInvoiceDraftSchema = CreateInvoiceDraftSchema;

export const VoidInvoiceSchema = z.object({
  invoiceId: z.string().regex(objectIdPattern, 'Invalid invoice ID'),
  reason: z.string().trim().min(5, 'A cancellation / void reason of at least 5 characters is required').max(1000),
});

export const BillingSettingSchemaValidation = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  legalName: z.string().trim().min(1, 'Legal name is required').max(200),
  address: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(50).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  taxEnabled: z.boolean().default(false),
  taxRegistrationNumber: z.string().trim().max(50).optional().nullable(),
  taxLabel: z.string().trim().max(50).default('GSTIN'),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
  defaultTaxTreatment: z.nativeEnum(TAX_TREATMENTS).default(TAX_TREATMENTS.NONE),
  sellerState: z.string().trim().max(100).optional().nullable(),
  defaultPaymentTerms: z.string().trim().max(2000).optional().nullable(),
  invoiceFooterNote: z.string().trim().max(1000).optional().nullable(),
  bankAccountDetails: z.string().trim().max(2000).optional().nullable(),
  upiPaymentInstructions: z.string().trim().max(2000).optional().nullable(),
});

export type CreateInvoiceDraftInput = z.infer<typeof CreateInvoiceDraftSchema>;
export type UpdateInvoiceDraftInput = z.infer<typeof UpdateInvoiceDraftSchema>;
export type VoidInvoiceInput = z.infer<typeof VoidInvoiceSchema>;
export type BillingSettingInput = z.infer<typeof BillingSettingSchemaValidation>;
