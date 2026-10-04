// Client-safe constants for automations (no server imports) — shared by the
// builder UI and the sweep engine in lib/automations.ts.

export const AUTOMATION_TRIGGERS = ["before_due", "on_due", "after_due", "day_of_month", "lease_end"] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export const AUTOMATION_CHANNELS = ["email", "sms", "in_app", "push"] as const;
export type AutomationChannel = (typeof AUTOMATION_CHANNELS)[number];

export const MERGE_TAGS: { tag: string; desc: string }[] = [
  { tag: "{{tenant_name}}", desc: "Tenant's full name" },
  { tag: "{{first_name}}", desc: "Tenant's first name" },
  { tag: "{{amount_due}}", desc: "Unpaid balance for the bill month" },
  { tag: "{{rent}}", desc: "Monthly rent" },
  { tag: "{{due_date}}", desc: "Due date, e.g. October 5, 2026" },
  { tag: "{{days}}", desc: "Days before/after (from the trigger)" },
  { tag: "{{month}}", desc: "Bill month, e.g. October 2026" },
  { tag: "{{property}}", desc: "Property name" },
  { tag: "{{unit}}", desc: "Unit number" },
  { tag: "{{lease_end}}", desc: "Lease end date" },
  { tag: "{{owner_name}}", desc: "Your name" },
  { tag: "{{business_name}}", desc: "Your business name" },
  { tag: "{{gcash}}", desc: "Your GCash number" },
  { tag: "{{maya}}", desc: "Your Maya number" },
  { tag: "{{portal_link}}", desc: "Tenant portal login link" },
];

export function describeTrigger(trigger: string, offsetDays: number): string {
  const d = `${offsetDays} day${offsetDays === 1 ? "" : "s"}`;
  switch (trigger) {
    case "before_due": return `${d} before rent is due`;
    case "on_due": return "On the due date";
    case "after_due": return `${d} after the due date (overdue)`;
    case "day_of_month": return `Every month on day ${offsetDays}`;
    case "lease_end": return `${d} before the lease ends`;
    default: return trigger;
  }
}


export interface AutomationTemplate {
  key: string;
  name: string;
  trigger: AutomationTrigger;
  offsetDays: number;
  audience: "tenant" | "owner" | "both";
  channels: AutomationChannel[];
  subject: string;
  message: string;
  onlyUnpaid: boolean;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "friendly-3-before",
    name: "Friendly reminder — 3 days before due",
    trigger: "before_due",
    offsetDays: 3,
    audience: "tenant",
    channels: ["email", "sms"],
    subject: "Rent reminder: {{amount_due}} due on {{due_date}}",
    message:
      "Hi {{first_name}}! Friendly reminder that your rent for {{month}} ({{amount_due}}) is due on {{due_date}}.\n\nYou can pay via GCash {{gcash}} and upload your proof here: {{portal_link}}\n\nSalamat po!",
    onlyUnpaid: true,
  },
  {
    key: "due-today",
    name: "Due today",
    trigger: "on_due",
    offsetDays: 0,
    audience: "tenant",
    channels: ["sms", "in_app"],
    subject: "Rent due today",
    message: "Hi {{first_name}}, your rent of {{amount_due}} for Unit {{unit}} is due today. Please pay and upload your proof in the tenant portal. Thank you!",
    onlyUnpaid: true,
  },
  {
    key: "overdue-3",
    name: "Overdue follow-up — 3 days late",
    trigger: "after_due",
    offsetDays: 3,
    audience: "both",
    channels: ["email", "sms"],
    subject: "Overdue: {{amount_due}} for {{month}}",
    message:
      "Hi {{first_name}}, our records show {{amount_due}} for {{month}} is now {{days}} days overdue (due {{due_date}}).\n\nPlease settle as soon as possible or message us if you need to arrange a schedule.",
    onlyUnpaid: true,
  },
  {
    key: "monthly-notice",
    name: "Monthly billing notice on the 1st",
    trigger: "day_of_month",
    offsetDays: 1,
    audience: "tenant",
    channels: ["email", "in_app"],
    subject: "Your {{month}} bill",
    message:
      "Hi {{first_name}}, your {{month}} rent of {{rent}} for {{property}} Unit {{unit}} is due on {{due_date}}.\n\nCurrent balance: {{amount_due}}.",
    onlyUnpaid: false,
  },
  {
    key: "lease-ending",
    name: "Lease ending in 30 days",
    trigger: "lease_end",
    offsetDays: 30,
    audience: "both",
    channels: ["email"],
    subject: "Your lease ends on {{lease_end}}",
    message:
      "Hi {{first_name}}, your lease for {{property}} Unit {{unit}} ends on {{lease_end}}.\n\nPlease let us know if you'd like to renew so we can prepare a new contract.",
    onlyUnpaid: false,
  },
  {
    key: "owner-overdue-alert",
    name: "Alert me when a tenant is 1 day overdue",
    trigger: "after_due",
    offsetDays: 1,
    audience: "owner",
    channels: ["email", "push"],
    subject: "{{tenant_name}} is overdue ({{amount_due}})",
    message: "{{tenant_name}} ({{property}} Unit {{unit}}) hasn't paid {{amount_due}} for {{month}}. It was due {{due_date}}.",
    onlyUnpaid: true,
  },
];
