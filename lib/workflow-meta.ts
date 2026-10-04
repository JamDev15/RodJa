// Client-safe workflow definitions shared by the admin builder and the engine.

export type LeadStatus = "new" | "contacted" | "onboarding" | "interested" | "not_interested" | "converted" | "lost";

export const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-blue-500/20 text-blue-300" },
  { value: "contacted", label: "Contacted", color: "bg-cyan-500/20 text-cyan-300" },
  { value: "onboarding", label: "Onboarding", color: "bg-purple-500/20 text-purple-300" },
  { value: "interested", label: "Interested", color: "bg-emerald-500/20 text-emerald-300" },
  { value: "not_interested", label: "Not interested", color: "bg-orange-500/20 text-orange-300" },
  { value: "converted", label: "Paying customer", color: "bg-green-500/20 text-green-300" },
  { value: "lost", label: "Lost", color: "bg-gray-500/20 text-gray-400" },
];

export function leadStatusLabel(v: string): string {
  return LEAD_STATUSES.find((s) => s.value === v)?.label ?? v;
}

export type WorkflowTrigger = "signup" | "lead_status" | "trial_ending" | "trial_expired" | "manual";

export const WORKFLOW_TRIGGERS: { value: WorkflowTrigger; label: string; help: string }[] = [
  { value: "signup", label: "New signup", help: "Starts the moment someone creates an account." },
  { value: "lead_status", label: "Lead status changes to…", help: "Starts when you set a signup's status (e.g. Not interested)." },
  { value: "trial_ending", label: "Trial ends tomorrow", help: "Starts one day before a free trial expires." },
  { value: "trial_expired", label: "Trial expired", help: "Starts when a trial ends without payment." },
  { value: "manual", label: "Manual only", help: "Only runs for signups you enroll yourself." },
];

export type WorkflowStep =
  | { type: "wait"; days: number }
  | { type: "email"; subject: string; body: string }
  | { type: "sms"; body: string }
  | { type: "set_status"; status: LeadStatus }
  | { type: "notify_admin"; subject: string; body: string };

export const WORKFLOW_MERGE_TAGS: { tag: string; desc: string }[] = [
  { tag: "{{first_name}}", desc: "First name" },
  { tag: "{{name}}", desc: "Full name" },
  { tag: "{{business}}", desc: "Business name" },
  { tag: "{{email}}", desc: "Email" },
  { tag: "{{phone}}", desc: "Phone" },
  { tag: "{{social}}", desc: "Social media" },
  { tag: "{{trial_ends}}", desc: "Trial end date" },
  { tag: "{{renew_link}}", desc: "One-click subscribe/reactivate link" },
  { tag: "{{login_link}}", desc: "Login page" },
];

export function describeStep(step: WorkflowStep): string {
  switch (step.type) {
    case "wait": return `Wait ${step.days} day${step.days === 1 ? "" : "s"}`;
    case "email": return `Email: ${step.subject}`;
    case "sms": return `SMS: ${step.body.slice(0, 50)}${step.body.length > 50 ? "…" : ""}`;
    case "set_status": return `Set status → ${leadStatusLabel(step.status)}`;
    case "notify_admin": return `Notify me: ${step.subject}`;
  }
}

export function totalDays(steps: WorkflowStep[]): number {
  return steps.reduce((s, st) => s + (st.type === "wait" ? st.days : 0), 0);
}

export interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  triggerValue?: LeadStatus;
  steps: WorkflowStep[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "not-interested-30",
    name: "Not interested — 30-day nurture",
    description: "Gentle 30-day follow-up for signups who said no. Stops automatically if they subscribe.",
    trigger: "lead_status",
    triggerValue: "not_interested",
    steps: [
      {
        type: "email",
        subject: "No worries, {{first_name}} — one quick thing",
        body:
          "Hi {{first_name}},\n\nTotally understand that TenantHub isn't a fit right now. If it helps, here's what landlords tell us saves them the most time:\n\n• Automatic rent reminders by email and SMS — no more chasing tenants on Messenger\n• Tenants upload their GCash/Maya proof, you approve with one tap\n• Receipts sent automatically when you mark a bill paid\n\nYour account and data stay saved. If anything changes, you can pick up right where you left off: {{renew_link}}\n\nSalamat!\nThe TenantHub team",
      },
      { type: "wait", days: 3 },
      { type: "sms", body: "Hi {{first_name}}! TenantHub here. If you ever want help setting up rent reminders for your tenants, just reply or visit tenant-hub.app. Salamat!" },
      { type: "wait", days: 7 },
      {
        type: "email",
        subject: "Lease contracts your tenants can sign on their phone",
        body:
          "Hi {{first_name}},\n\nOne feature landlords love: send a lease contract and your tenant signs it online — no printing, no meetups. You both get the signed PDF automatically.\n\nIt takes about 2 minutes with our ready-made Philippine lease template.\n\nTry it again for ₱499/month: {{renew_link}}",
      },
      { type: "wait", days: 10 },
      {
        type: "email",
        subject: "Want a free 15-minute setup call?",
        body:
          "Hi {{first_name}},\n\nIf time was the issue, we can set up your properties and tenants with you on a quick 15-minute call — free.\n\nJust reply to this email with a good time and the best number to reach you.",
      },
      { type: "wait", days: 10 },
      {
        type: "email",
        subject: "Last check-in from TenantHub",
        body:
          "Hi {{first_name}},\n\nThis is our last follow-up — we won't keep emailing. If you ever want to make rent collection easier, your account is one click away: {{renew_link}}\n\nWishing you full occupancy and on-time payments!",
      },
      { type: "set_status", status: "lost" },
      { type: "notify_admin", subject: "Nurture finished: {{name}}", body: "{{name}} ({{email}}, {{phone}}) finished the 30-day nurture without subscribing. Marked as Lost." },
    ],
  },
  {
    key: "welcome-onboarding",
    name: "New signup — welcome & quick start",
    description: "Welcome email on signup, then setup tips during the 3-day trial.",
    trigger: "signup",
    steps: [
      {
        type: "email",
        subject: "Welcome to TenantHub, {{first_name}}! Here's your 3-step start",
        body:
          "Hi {{first_name}},\n\nWelcome! Your free trial runs until {{trial_ends}}. To get the most out of it:\n\n1. Add your property and units\n2. Add your tenants (they get their own portal)\n3. Turn on an automation — e.g. a reminder 3 days before rent is due\n\nLog in here: {{login_link}}\n\nNeed help? Just reply to this email.",
      },
      { type: "wait", days: 1 },
      {
        type: "email",
        subject: "Tip: send your first e-signed lease",
        body:
          "Hi {{first_name}},\n\nQuick tip for day 2: open a tenant and tap “Contract”. We pre-fill a Philippine lease template with their unit, rent, and deposit — you sign, they sign on their phone, and both of you get the PDF.\n\n{{login_link}}",
      },
    ],
  },
  {
    key: "trial-winback",
    name: "Trial expired — win-back",
    description: "Reactivation sequence after a trial ends without payment.",
    trigger: "trial_expired",
    steps: [
      { type: "notify_admin", subject: "Trial expired: {{name}}", body: "{{name}} ({{phone}}, {{social}}) — trial expired without payment. Good time for a personal follow-up." },
      { type: "wait", days: 2 },
      {
        type: "email",
        subject: "Your TenantHub data is still here, {{first_name}}",
        body:
          "Hi {{first_name}},\n\nYour trial ended, but everything you set up is saved. Reactivate anytime for ₱499/month via GCash or Maya and continue where you left off:\n\n{{renew_link}}",
      },
      { type: "wait", days: 3 },
      { type: "sms", body: "Hi {{first_name}}, your TenantHub account is paused but your data is saved. Reactivate for P499/mo: tenant-hub.app/renew" },
      { type: "wait", days: 7 },
      {
        type: "email",
        subject: "Should we close your TenantHub account?",
        body: "Hi {{first_name}},\n\nJust checking — would you like to keep your account? Reply YES and we'll help you get set up, or reactivate here: {{renew_link}}",
      },
    ],
  },
  {
    key: "call-requested",
    name: "Wants an onboarding call — remind me",
    description: "Reminds you to call interested signups and sends them a heads-up.",
    trigger: "lead_status",
    triggerValue: "interested",
    steps: [
      { type: "notify_admin", subject: "Call {{name}} — {{phone}}", body: "{{name}} is marked Interested. Phone: {{phone}} · Email: {{email}} · Social: {{social}}" },
      {
        type: "email",
        subject: "We'll call you soon, {{first_name}}",
        body: "Hi {{first_name}},\n\nThanks for your interest! Someone from TenantHub will call you at {{phone}} to help set up your account. If another time or number is better, just reply to this email.",
      },
      { type: "wait", days: 2 },
      { type: "notify_admin", subject: "Follow-up check: {{name}}", body: "Did you reach {{name}} ({{phone}})? Update their status in Signups." },
    ],
  },
];
