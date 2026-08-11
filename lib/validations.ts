import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    ownerName: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(200),
    phone: z.string().trim().max(30).optional().nullable(),
    plan: z.enum(["free", "basic", "pro"]).optional(),
    referenceNumber: z.string().trim().max(100).optional(),
  })
  .refine((data) => (data.plan ?? "free") === "free" || !!data.referenceNumber, {
    message: "Reference number is required for paid plans",
    path: ["referenceNumber"],
  });

export const tenantCreateSchema = z.object({
  unitId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().trim().min(1).max(30),
  moveInDate: z.coerce.date(),
  dueDay: z.coerce.number().int().min(1).max(28).optional(),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  portalPin: z.string().trim().min(4).max(12),
  emergencyContact: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const tenantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().trim().min(1).max(30).optional(),
  moveInDate: z.coerce.date().optional(),
  moveOutDate: z.coerce.date().optional().nullable(),
  dueDay: z.coerce.number().int().min(1).max(28).optional(),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  depositPaid: z.boolean().optional(),
  portalPin: z.string().trim().min(4).max(12).optional(),
  emergencyContact: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const unitCreateSchema = z.object({
  propertyId: z.string().min(1),
  unitNumber: z.string().trim().min(1).max(50),
  floor: z.string().trim().max(50).optional().nullable(),
  rentAmount: z.coerce.number().nonnegative(),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const unitUpdateSchema = z.object({
  unitNumber: z.string().trim().min(1).max(50).optional(),
  floor: z.string().trim().max(50).optional().nullable(),
  rentAmount: z.coerce.number().nonnegative().optional(),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const propertyCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  type: z.string().trim().min(1).max(50),
  description: z.string().trim().max(2000).optional().nullable(),
  amenities: z.any().optional(),
});

export const paymentCreateSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  month: z.string().trim().min(1).max(20),
  dueDate: z.coerce.date(),
  status: z.enum(["pending", "submitted", "approved", "late", "waived"]).optional(),
  method: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const paymentUpdateSchema = z.object({
  status: z.enum(["pending", "submitted", "approved", "late", "waived"]).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  rejectedReason: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const maintenanceCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

// Landlord-initiated maintenance log (e.g. via the chat assistant) — unlike
// maintenanceCreateSchema above, tenantId is explicit since it isn't coming
// from a tenant-portal session.
export const assistantMaintenanceSchema = maintenanceCreateSchema.extend({
  tenantId: z.string().min(1),
});

export const assistantNoticeSchema = z.object({
  tenantId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(2000),
  type: z.string().trim().min(1).max(50).optional(),
});

export const reminderConfigSchema = z.object({
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  daysBefore: z.array(z.coerce.number().int()).optional(),
  daysAfter: z.array(z.coerce.number().int()).optional(),
});

export const ledgerCreateSchema = z.object({
  tenantId: z.string().min(1),
  month: z.string().trim().min(1).max(20),
  rentAmount: z.coerce.number().nonnegative(),
  electricAmount: z.coerce.number().nonnegative().optional().nullable(),
  waterAmount: z.coerce.number().nonnegative().optional().nullable(),
  otherAmount: z.coerce.number().nonnegative().optional().nullable(),
  otherLabel: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const assistantBillSchema = z.object({
  tenantId: z.string().min(1),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
  billType: z.enum(["rent", "electric", "water", "other"]),
  amount: z.coerce.number().nonnegative(),
  otherLabel: z.string().trim().max(100).optional().nullable(),
});

export const ledgerUpdateSchema = z.object({
  rentPaidAmount: z.coerce.number().nonnegative().optional().nullable(),
  rentPaid: z.boolean().optional(),
  electricPaidAmount: z.coerce.number().nonnegative().optional().nullable(),
  electricPaid: z.boolean().optional(),
  waterPaidAmount: z.coerce.number().nonnegative().optional().nullable(),
  waterPaid: z.boolean().optional(),
  otherPaidAmount: z.coerce.number().nonnegative().optional().nullable(),
  otherPaid: z.boolean().optional(),
  balance: z.coerce.number().optional(),
  balancePaid: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ownerName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  gcashNumber: z.string().trim().max(30).optional().nullable(),
  mayaNumber: z.string().trim().max(30).optional().nullable(),
  bankDetails: z.string().trim().max(1000).optional().nullable(),
});

export const adminAccountUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  lifetimeAccess: z.boolean().optional(),
});

export const adminAccountDeleteSchema = z.object({
  confirmName: z.string().min(1),
});

export const adminPlanUpdateSchema = z.object({
  isActive: z.boolean(),
});

export const adminListingReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const adminBillingReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const platformSettingsUpdateSchema = z.object({
  gcashNumber: z.string().trim().max(30).optional().nullable(),
  mayaNumber: z.string().trim().max(30).optional().nullable(),
  notificationEmail: z.string().trim().toLowerCase().email().max(255).optional().nullable().or(z.literal("")),
});

export const billingPaySchema = z.object({
  referenceNumber: z.string().trim().min(1).max(100),
});

export const billingUpgradeSchema = z.object({
  planId: z.string().min(1),
});

export const adminPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export const accountPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

/** Formats zod issues into a flat, client-friendly message. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}
