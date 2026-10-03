// Client-safe definitions for owner (landlord) workflows — multi-step
// sequences sent to tenants. Shared by the builder UI and lib/owner-workflows.ts.

export type OwnerWorkflowTrigger = "tenant_added" | "before_due" | "on_due" | "after_due" | "day_of_month" | "lease_end" | "manual";

export const OWNER_WORKFLOW_TRIGGERS: {
  value: OwnerWorkflowTrigger;
  label: string;
  help: string;
  days?: { label: string; min: number; max: number; default: number };
  billBased: boolean;
}[] = [
  { value: "before_due", label: "Days before rent is due", help: "Starts for each tenant N days before their due date, every month.", days: { label: "Days before", min: 0, max: 60, default: 3 }, billBased: true },
  { value: "on_due", label: "On the due date", help: "Starts for each tenant on their due date, every month.", billBased: true },
  { value: "after_due", label: "Days after due date (overdue)", help: "Starts N days after the due date — only for tenants who still owe.", days: { label: "Days overdue", min: 1, max: 90, default: 1 }, billBased: true },
  { value: "day_of_month", label: "On a day of every month", help: "Starts for every active tenant on this day each month.", days: { label: "Day of month", min: 1, max: 31, default: 1 }, billBased: true },
  { value: "lease_end", label: "Days before the lease ends", help: "Uses the tenant's move-out date or their latest signed contract's end date.", days: { label: "Days before", min: 1, max: 180, default: 30 }, billBased: false },
  { value: "tenant_added", label: "When a tenant is added", help: "Starts once, right after you add a new tenant.", billBased: false },
  { value: "manual", label: "Manual only", help: "Only runs for tenants you add yourself from this page.", billBased: false },
];

export type OwnerWorkflowStep =
  | { type: "wait"; days: number }
  | { type: "email"; subject: string; body: string }
  | { type: "sms"; body: string }
  | { type: "portal"; title: string; body: string }
  | { type: "send_invoice" }
  | { type: "notify_owner"; subject: string; body: string };

export function describeOwnerStep(step: OwnerWorkflowStep): string {
  switch (step.type) {
    case "wait": return `Wait ${step.days} day${step.days === 1 ? "" : "s"}`;
    case "email": return `Email tenant: ${step.subject}`;
    case "sms": return `SMS tenant: ${step.body.slice(0, 50)}${step.body.length > 50 ? "…" : ""}`;
    case "portal": return `Portal notice: ${step.title}`;
    case "send_invoice": return "Send invoice for the bill month";
    case "notify_owner": return `Notify me: ${step.subject}`;
  }
}

export function triggerSummary(trigger: string, offsetDays: number): string {
  const t = OWNER_WORKFLOW_TRIGGERS.find((x) => x.value === trigger);
  if (!t) return trigger;
  if (!t.days) return t.label;
  if (trigger === "day_of_month") return `Every month on day ${offsetDays}`;
  const d = `${offsetDays} day${offsetDays === 1 ? "" : "s"}`;
  if (trigger === "before_due") return `${d} before rent is due`;
  if (trigger === "after_due") return `${d} after the due date`;
  if (trigger === "lease_end") return `${d} before the lease ends`;
  return t.label;
}

export interface OwnerWorkflowTemplate {
  key: string;
  name: string;
  description: string;
  trigger: OwnerWorkflowTrigger;
  offsetDays: number;
  steps: OwnerWorkflowStep[];
}

export const OWNER_WORKFLOW_TEMPLATES: OwnerWorkflowTemplate[] = [
  {
    key: "monthly-collection",
    name: "Monthly collection sequence",
    description: "Invoice on the 1st, friendly nudge before due, firmer follow-ups after. Stops the moment they pay.",
    trigger: "day_of_month",
    offsetDays: 1,
    steps: [
      { type: "send_invoice" },
      { type: "wait", days: 2 },
      { type: "sms", body: "Hi {{first_name}}, your {{month}} bill of {{amount_due}} is due on {{due_date}}. GCash: {{gcash}}. Salamat!" },
      { type: "wait", days: 5 },
      {
        type: "email",
        subject: "Reminder: {{amount_due}} still unpaid for {{month}}",
        body: "Hi {{first_name}},\n\nJust a reminder that {{amount_due}} for {{month}} (Unit {{unit}}) is still unpaid. It was due on {{due_date}}.\n\nPlease pay via GCash {{gcash}} and upload your proof here: {{portal_link}}",
      },
      { type: "wait", days: 3 },
      { type: "notify_owner", subject: "{{tenant_name}} still owes {{amount_due}}", body: "{{tenant_name}} (Unit {{unit}}) hasn't paid {{amount_due}} for {{month}} after the reminders. You may want to call them." },
    ],
  },
  {
    key: "overdue-escalation",
    name: "Overdue escalation",
    description: "Starts 1 day late: SMS, then email, then a portal notice, then alerts you.",
    trigger: "after_due",
    offsetDays: 1,
    steps: [
      { type: "sms", body: "Hi {{first_name}}, your rent of {{amount_due}} was due {{due_date}}. Please settle today. Salamat po." },
      { type: "wait", days: 2 },
      {
        type: "email",
        subject: "Overdue: {{amount_due}} for {{month}}",
        body: "Hi {{first_name}},\n\nYour payment of {{amount_due}} for {{month}} is now overdue (due {{due_date}}). Please pay as soon as possible, or reply if you need to arrange a schedule.",
      },
      { type: "wait", days: 2 },
      { type: "portal", title: "Overdue balance: {{amount_due}}", body: "Your {{month}} balance of {{amount_due}} is overdue. Please pay and upload your proof." },
      { type: "wait", days: 3 },
      { type: "notify_owner", subject: "Still unpaid: {{tenant_name}} ({{amount_due}})", body: "{{tenant_name}}, Unit {{unit}}, is now over a week late on {{amount_due}} for {{month}}." },
    ],
  },
  {
    key: "welcome-new-tenant",
    name: "Welcome a new tenant",
    description: "Portal welcome on day one, payment instructions, and a check-in after a week.",
    trigger: "tenant_added",
    offsetDays: 0,
    steps: [
      {
        type: "email",
        subject: "Welcome to {{property}}, {{first_name}}!",
        body: "Hi {{first_name}},\n\nWelcome to {{property}}, Unit {{unit}}! Your monthly rent is {{rent}}, due every month on {{due_date}}.\n\nYou can view your bills, pay, and upload your proof of payment in the tenant portal: {{portal_link}}\n\nGCash: {{gcash}}\n\n— {{owner_name}}",
      },
      { type: "portal", title: "Welcome, {{first_name}}!", body: "This is your tenant portal. Here you'll see your monthly bills, notices, contracts, and receipts." },
      { type: "wait", days: 7 },
      { type: "sms", body: "Hi {{first_name}}! It's {{owner_name}}. Hope you're settling in well at Unit {{unit}}. Let me know if anything needs fixing." },
    ],
  },
  {
    key: "lease-renewal",
    name: "Lease renewal follow-up",
    description: "60 days before the lease ends: ask about renewal, follow up, and remind you to prepare a contract.",
    trigger: "lease_end",
    offsetDays: 60,
    steps: [
      {
        type: "email",
        subject: "Your lease ends on {{lease_end}} — renewing?",
        body: "Hi {{first_name}},\n\nYour lease for {{property}} Unit {{unit}} ends on {{lease_end}}. Would you like to renew? Just reply to let me know.\n\n— {{owner_name}}",
      },
      { type: "wait", days: 14 },
      { type: "sms", body: "Hi {{first_name}}, just following up — will you be renewing your lease ending {{lease_end}}? Salamat!" },
      { type: "wait", days: 16 },
      { type: "notify_owner", subject: "Lease ends in 30 days: {{tenant_name}}", body: "{{tenant_name}}'s lease (Unit {{unit}}) ends on {{lease_end}}. Prepare a renewal contract or plan the move-out." },
    ],
  },
];
