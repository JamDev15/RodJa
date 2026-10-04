import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

// Every signup starts a 3-day free trial of the single ₱499/month plan —
// no plan picker, no payment up front.
export const signupSchema = z.object({
  ownerName: z.string().trim().min(2, "Please enter your full name").max(200),
  name: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter your phone number")
    .max(30)
    .regex(/^[+\d][\d\s\-().]{6,}$/, "Please enter a valid phone number"),
  socialMedia: z.string().trim().min(2, "Please add your Facebook, Instagram, or other social media link").max(300),
  wantsOnboardingCall: z.enum(["yes", "no"], { message: "Let us know if we can call you for onboarding" }),
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
  rentAmount: z.coerce.number().nonnegative().optional().nullable(),
  electricAmount: z.coerce.number().nonnegative().optional().nullable(),
  waterAmount: z.coerce.number().nonnegative().optional().nullable(),
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

export const helpRequestSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).max(2000),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
});

/** Formats zod issues into a flat, client-friendly message. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

// ─── Automations / contracts / invoices / CRM ────────────────────────────────

export const automationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    isActive: z.boolean().optional(),
    trigger: z.enum(["before_due", "on_due", "after_due", "day_of_month", "lease_end"]),
    offsetDays: z.coerce.number().int().min(0).max(365),
    audience: z.enum(["tenant", "owner", "both"]),
    channels: z.array(z.enum(["email", "sms", "in_app", "push"])).min(1, "Pick at least one channel"),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
    onlyUnpaid: z.boolean().optional(),
  })
  .refine((d) => d.trigger !== "day_of_month" || (d.offsetDays >= 1 && d.offsetDays <= 31), {
    message: "Day of month must be between 1 and 31",
    path: ["offsetDays"],
  });

export const automationToggleSchema = z.object({ isActive: z.boolean() });

const signatureDataUrl = z
  .string()
  .max(400_000, "Signature image is too large")
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Invalid signature image");

export const contractCreateSchema = z.object({
  tenantId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20, "Contract text is too short").max(50_000),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  monthlyRent: z.coerce.number().nonnegative().optional().nullable(),
  deposit: z.coerce.number().nonnegative().optional().nullable(),
});

export const contractUpdateSchema = contractCreateSchema.omit({ tenantId: true }).partial();

export const signContractSchema = z.object({
  signature: signatureDataUrl,
  signedName: z.string().trim().min(2).max(200),
  agree: z.literal(true, { message: "You must agree to sign electronically" }),
});

export const invoiceSendSchema = z.object({
  ledgerId: z.string().min(1),
  type: z.enum(["invoice", "receipt"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const leadUpdateSchema = z.object({
  leadStatus: z.enum(["new", "contacted", "onboarding", "interested", "not_interested", "converted", "lost"]).optional(),
  leadNotes: z.string().trim().max(5000).optional().nullable(),
});

const workflowStepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wait"), days: z.coerce.number().int().min(0).max(365) }),
  z.object({ type: z.literal("email"), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("sms"), body: z.string().trim().min(1).max(450) }),
  z.object({
    type: z.literal("set_status"),
    status: z.enum(["new", "contacted", "onboarding", "interested", "not_interested", "converted", "lost"]),
  }),
  z.object({ type: z.literal("notify_admin"), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(2000) }),
]);

export const workflowSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    trigger: z.enum(["signup", "lead_status", "trial_ending", "trial_expired", "manual"]),
    triggerValue: z.string().trim().max(50).optional().nullable(),
    steps: z.array(workflowStepSchema).min(1, "Add at least one step").max(50),
    stopOnConversion: z.boolean().optional(),
  })
  .refine((d) => d.trigger !== "lead_status" || !!d.triggerValue, {
    message: "Pick which lead status starts this workflow",
    path: ["triggerValue"],
  });

export const workflowEnrollSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1).max(500),
});

export const renewSchema = z.object({
  token: z.string().min(10).max(500),
  referenceNumber: z.string().trim().min(1).max(100),
});

const ownerWorkflowStepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wait"), days: z.coerce.number().int().min(0).max(365) }),
  z.object({ type: z.literal("email"), subject: z.string().trim().min(1, "Email subject is empty").max(200), body: z.string().trim().min(1, "Email message is empty").max(5000) }),
  z.object({ type: z.literal("sms"), body: z.string().trim().min(1, "SMS message is empty").max(450) }),
  z.object({ type: z.literal("portal"), title: z.string().trim().min(1, "Notice title is empty").max(200), body: z.string().trim().min(1, "Notice text is empty").max(2000) }),
  z.object({ type: z.literal("send_invoice") }),
  z.object({ type: z.literal("notify_owner"), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(2000) }),
]);

export const ownerWorkflowSchema = z
  .object({
    name: z.string().trim().min(1, "Give the workflow a name").max(120),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    trigger: z.enum(["tenant_added", "before_due", "on_due", "after_due", "day_of_month", "lease_end", "manual"]),
    offsetDays: z.coerce.number().int().min(0).max(365).optional(),
    steps: z.array(ownerWorkflowStepSchema).min(1, "Add at least one step").max(40),
    stopWhenPaid: z.boolean().optional(),
  })
  .refine((d) => d.trigger !== "day_of_month" || ((d.offsetDays ?? 0) >= 1 && (d.offsetDays ?? 0) <= 31), {
    message: "Day of month must be between 1 and 31",
    path: ["offsetDays"],
  });

export const ownerWorkflowEnrollSchema = z.object({
  tenantIds: z.array(z.string().min(1)).min(1).max(500),
});
