import { Bell, Clock, FileText, Mail, MessageSquare, MonitorSmartphone, Tag, type LucideIcon } from "lucide-react";
import { LEAD_STATUSES, WORKFLOW_MERGE_TAGS, WORKFLOW_TRIGGERS } from "@/lib/workflow-meta";
import { OWNER_WORKFLOW_TRIGGERS } from "@/lib/owner-workflow-meta";
import { MERGE_TAGS } from "@/lib/automation-meta";

// Per-audience configuration for the shared workflow builder: which triggers
// and step types exist, how a draft is saved, and the accent color.

export type FieldDef =
  | { key: string; kind: "text"; placeholder?: string; mergeable?: boolean }
  | { key: string; kind: "textarea"; rows: number; maxLength?: number; mergeable?: boolean; counter?: boolean }
  | { key: string; kind: "select"; options: { value: string; label: string }[] };

export interface StepDef {
  type: string;
  label: string;
  icon: LucideIcon;
  color: string;
  blank: Record<string, unknown>;
  fields: FieldDef[];
  note?: string;
}

export interface TriggerDef {
  value: string;
  label: string;
  help: string;
  param?: { kind: "status"; options: { value: string; label: string }[] } | { kind: "days"; label: string; min: number; max: number; default: number };
}

export interface BuilderDraft {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: string;
  triggerParam: string; // lead status (admin) or number of days (owner)
  stopFlag: boolean;
  steps: Record<string, unknown>[];
}

export interface BuilderConfig {
  apiBase: string;
  listHref: string;
  detailHref: (id: string) => string;
  accent: { button: string; ring: string; soft: string; text: string };
  triggers: TriggerDef[];
  steps: StepDef[];
  mergeTags: { tag: string; desc: string }[];
  stopLabel: string;
  stopHelp: string;
  /** Hide the stop toggle for triggers it doesn't apply to. */
  stopAppliesTo?: (trigger: string) => boolean;
  toPayload: (d: BuilderDraft) => Record<string, unknown>;
}

const WAIT: StepDef = {
  type: "wait",
  label: "Wait",
  icon: Clock,
  color: "text-th-ink/80 bg-th-raised",
  blank: { type: "wait", days: 1 },
  fields: [],
};

export const ADMIN_BUILDER: BuilderConfig = {
  apiBase: "/api/admin/workflows",
  listHref: "/admin/workflows",
  detailHref: (id) => `/admin/workflows/${id}`,
  accent: { button: "bg-purple-600 hover:bg-purple-700", ring: "border-th-violet/40 bg-th-violet-soft", soft: "text-th-violet", text: "text-th-violet" },
  triggers: WORKFLOW_TRIGGERS.map((t) => ({
    value: t.value,
    label: t.label,
    help: t.help,
    ...(t.value === "lead_status" ? { param: { kind: "status" as const, options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })) } } : {}),
  })),
  steps: [
    WAIT,
    {
      type: "email", label: "Send email", icon: Mail, color: "text-th-accent bg-th-brand-soft",
      blank: { type: "email", subject: "", body: "Hi {{first_name}},\n\n" },
      fields: [{ key: "subject", kind: "text", placeholder: "Subject", mergeable: true }, { key: "body", kind: "textarea", rows: 6, mergeable: true }],
      note: "An unsubscribe link is added automatically. Skipped for people who unsubscribed.",
    },
    {
      type: "sms", label: "Send SMS", icon: MessageSquare, color: "text-th-paid bg-th-paid-soft",
      blank: { type: "sms", body: "Hi {{first_name}}, " },
      fields: [{ key: "body", kind: "textarea", rows: 3, maxLength: 450, mergeable: true, counter: true }],
      note: "Sent to the phone number they signed up with.",
    },
    {
      type: "set_status", label: "Set lead status", icon: Tag, color: "text-th-due bg-th-due-soft",
      blank: { type: "set_status", status: "contacted" },
      fields: [{ key: "status", kind: "select", options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })) }],
    },
    {
      type: "notify_admin", label: "Notify me", icon: Bell, color: "text-th-violet bg-th-violet-soft",
      blank: { type: "notify_admin", subject: "Follow up with {{name}}", body: "{{name}} · {{phone}} · {{email}}" },
      fields: [{ key: "subject", kind: "text", placeholder: "Subject", mergeable: true }, { key: "body", kind: "textarea", rows: 3, mergeable: true }],
    },
  ],
  mergeTags: WORKFLOW_MERGE_TAGS,
  stopLabel: "Stop when they subscribe",
  stopHelp: "Leads leave the workflow as soon as they become paying customers.",
  toPayload: (d) => ({
    name: d.name,
    description: d.description || null,
    isActive: d.isActive,
    trigger: d.trigger,
    triggerValue: d.trigger === "lead_status" ? d.triggerParam : null,
    stopOnConversion: d.stopFlag,
    steps: d.steps,
  }),
};

export const OWNER_BUILDER: BuilderConfig = {
  apiBase: "/api/workflows",
  listHref: "/dashboard/workflows",
  detailHref: (id) => `/dashboard/workflows/${id}`,
  accent: { button: "bg-th-brand hover:bg-th-brand-hover", ring: "border-th-accent/40 bg-th-brand-soft", soft: "text-th-accent", text: "text-th-accent" },
  triggers: OWNER_WORKFLOW_TRIGGERS.map((t) => ({
    value: t.value,
    label: t.label,
    help: t.help,
    ...(t.days ? { param: { kind: "days" as const, ...t.days } } : {}),
  })),
  steps: [
    WAIT,
    {
      type: "email", label: "Email tenant", icon: Mail, color: "text-th-accent bg-th-brand-soft",
      blank: { type: "email", subject: "", body: "Hi {{first_name}},\n\n" },
      fields: [{ key: "subject", kind: "text", placeholder: "Subject", mergeable: true }, { key: "body", kind: "textarea", rows: 6, mergeable: true }],
      note: "Skipped if the tenant has no email on file.",
    },
    {
      type: "sms", label: "SMS tenant", icon: MessageSquare, color: "text-th-paid bg-th-paid-soft",
      blank: { type: "sms", body: "Hi {{first_name}}, " },
      fields: [{ key: "body", kind: "textarea", rows: 3, maxLength: 450, mergeable: true, counter: true }],
    },
    {
      type: "portal", label: "Tenant portal notice", icon: MonitorSmartphone, color: "text-th-due bg-th-due-soft",
      blank: { type: "portal", title: "", body: "" },
      fields: [{ key: "title", kind: "text", placeholder: "Notice title", mergeable: true }, { key: "body", kind: "textarea", rows: 3, mergeable: true }],
    },
    {
      type: "send_invoice", label: "Send invoice", icon: FileText, color: "text-th-accent bg-th-brand-soft",
      blank: { type: "send_invoice" },
      fields: [],
      note: "Emails a PDF invoice for whatever is still unpaid on that month's bill tracker.",
    },
    {
      type: "notify_owner", label: "Notify me", icon: Bell, color: "text-th-violet bg-th-violet-soft",
      blank: { type: "notify_owner", subject: "Check on {{tenant_name}}", body: "{{tenant_name}} · Unit {{unit}} · balance {{amount_due}}" },
      fields: [{ key: "subject", kind: "text", placeholder: "Subject", mergeable: true }, { key: "body", kind: "textarea", rows: 3, mergeable: true }],
      note: "Sent to your email and phone (push).",
    },
  ],
  mergeTags: MERGE_TAGS,
  stopLabel: "Stop once the bill is paid",
  stopHelp: "For bill-based triggers, the tenant leaves the workflow as soon as that month is fully paid.",
  stopAppliesTo: (trigger) => OWNER_WORKFLOW_TRIGGERS.find((t) => t.value === trigger)?.billBased ?? false,
  toPayload: (d) => ({
    name: d.name,
    description: d.description || null,
    isActive: d.isActive,
    trigger: d.trigger,
    offsetDays: d.triggerParam === "" ? 0 : Number(d.triggerParam),
    stopWhenPaid: d.stopFlag,
    steps: d.steps,
  }),
};
