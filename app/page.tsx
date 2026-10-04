import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Bell, FileSignature, ReceiptText } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { HeroBoard } from "@/components/public/hero-board";
import {
  DEFAULT_DESCRIPTION, DEFAULT_TITLE, FAQ, PRICE_PHP,
  faqJsonLd, jsonLdString, organizationJsonLd, softwareJsonLd, websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: DEFAULT_TITLE },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/", languages: { "en-PH": "/", "x-default": "/" } },
  openGraph: { url: "/", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
};

const STRIP = ["Apartments, dorms, bedspaces", "GCash and Maya ready", "Leases signed online", `One plan, ₱${PRICE_PHP}/month`];

const STEPS = [
  { n: "01", title: "Add your rentals", body: "Start with one property and one tenant. Add the rent, due day, and their phone number." },
  { n: "02", title: "Turn on reminders", body: "Pick when tenants hear from you — before the due date, on the day, and if they're late." },
  { n: "03", title: "Approve and you're done", body: "Tenants pay by GCash or Maya and upload proof. You approve, and the receipt sends itself." },
];

const INCLUDED = [
  { tag: "Contracts", title: "E-signed lease agreements", body: "A Philippine lease template, filled in for each tenant, signed on any phone." },
  { tag: "Invoices", title: "Bills and automatic receipts", body: "Itemized invoices for rent, kuryente, and tubig. Receipts email themselves when paid." },
  { tag: "History", title: "Every message on record", body: "See each reminder, invoice, and receipt that went out, and whether it arrived." },
  { tag: "Workflows", title: "Follow-ups that run themselves", body: "Invoice, wait, nudge, alert you. Stops the moment the tenant pays." },
  { tag: "Tenant portal", title: "A home for your tenants", body: "Balances, payment upload, contracts, receipts, and repair requests in one place." },
  { tag: "Listings", title: "Fill vacancies faster", body: "A shareable page for empty units, ready to post in Facebook groups." },
];

const PLAN = [
  "Unlimited properties, units, and tenants",
  "Reminders by email, SMS, and push",
  "Invoices and automatic receipts",
  "E-signed lease contracts",
  "Workflows and message history",
  "Tenant portal, listings, and chat assistant",
];

function Ledger() {
  const rows = [
    { name: "Ramon Villanueva", amt: "₱7,500.00", status: "Paid · Oct 2", paid: true },
    { name: "Maria dela Cruz", amt: "₱9,550.00", status: "Paid · Oct 4", paid: true },
    { name: "Joy Santiago", amt: "₱3,800.00", status: "Reminder sent", paid: false },
  ];
  return (
    <div className="th-shadow w-full max-w-sm rotate-[-2deg] rounded-xl border border-th-line bg-th-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-th-ink">Monthly rent ledger</p>
        <p className="text-[11px] text-th-faint">October</p>
      </div>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 border-b border-th-line pb-2.5 text-[12px] last:border-0 last:pb-0">
            <span className="flex items-center gap-2 text-th-ink">
              <span className={`h-1.5 w-1.5 rounded-full ${r.paid ? "bg-th-paid" : "bg-th-due"}`} />{r.name}
            </span>
            <span className="tabular text-th-ink">{r.amt}</span>
            <span className={`hidden text-[11px] sm:inline ${r.paid ? "text-th-paid" : "text-th-due"}`}>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingPage() {
  const ld = [organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), faqJsonLd()];
  const pill = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition-colors";

  return (
    <div className="th-public min-h-screen overflow-x-hidden antialiased">
      {ld.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
      ))}

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.08fr] lg:gap-12">
            <div>
              <p className="th-eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-th-accent" />Built for Philippine landlords</p>
              <h1 className="th-display mt-5 text-[46px] leading-[1.02] text-th-ink sm:text-[64px]">
                Every peso, accounted for.
                <br />
                <em>Every tenant, reminded.</em>
              </h1>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-th-muted">
                Track rent and bills, send reminders by SMS and email, sign leases online, and send receipts the moment a GCash payment lands.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className={`${pill} bg-th-brand text-th-on-brand hover:bg-th-brand-hover`}>
                  Start your free trial <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link href="#how-it-works" className={`${pill} border border-th-line text-th-ink hover:bg-th-raised`}>
                  See how it works
                </Link>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-th-muted">
                {["3 days free", "No card or GCash needed", `₱${PRICE_PHP}/month after`].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-th-paid" strokeWidth={2.5} />{t}</li>
                ))}
              </ul>
            </div>
            <HeroBoard />
          </div>
        </section>

        {/* Strip */}
        <section className="border-y border-th-line px-4 sm:px-6">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-y-4 py-6 lg:grid-cols-4">
            {STRIP.map((s) => (
              <li key={s} className="flex items-center gap-2.5 text-[13px] font-medium text-th-ink">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-th-line"><Check className="h-3 w-3 text-th-accent" strokeWidth={3} /></span>
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Bento */}
        <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-6 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="th-eyebrow">Made for small landlords</p>
                <h2 className="th-display mt-4 text-[38px] leading-[1.05] text-th-ink sm:text-[52px]">
                  A few units to rent out.
                  <br />
                  <em>Not a second full-time job.</em>
                </h2>
              </div>
              <p className="max-w-sm text-[15px] leading-relaxed text-th-muted md:justify-self-end">
                Retire the notebook, the Excel file, and the “nabayaran mo na ba?” messages. Every part of collecting rent has a place here.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <article className="grid items-center gap-8 overflow-hidden rounded-3xl border border-th-line bg-th-tint p-7 sm:p-10 md:col-span-2 md:grid-cols-[1fr_1fr]">
                <div>
                  <p className="th-eyebrow">01 / Rent, sorted</p>
                  <h3 className="th-display mt-4 text-[32px] leading-[1.1] text-th-ink sm:text-[38px]">Know where every rent payment stands.</h3>
                  <p className="mt-4 max-w-md text-[15px] leading-relaxed text-th-muted">
                    Paid, partial, or overdue. Rent, kuryente, tubig, and carry-over balances in one monthly ledger per tenant.
                  </p>
                  <Link href="/signup" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-th-ink hover:text-th-accent">
                    Start tracking rent <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="flex justify-center md:justify-end"><Ledger /></div>
              </article>

              <article className="rounded-3xl border border-th-line bg-th-tint p-7 sm:p-9">
                <p className="th-eyebrow">02 / Less following up</p>
                <div className="th-shadow mt-6 flex max-w-xs items-center gap-3 rounded-xl border border-th-line bg-th-surface p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-th-raised text-th-accent"><Bell className="h-4 w-4" /></span>
                  <div>
                    <p className="text-[12px] font-semibold text-th-ink">A friendly reminder</p>
                    <p className="text-[11px] text-th-muted">Rent of ₱3,800 is due on the 5th</p>
                  </div>
                </div>
                <h3 className="th-display mt-7 text-[28px] leading-[1.1] text-th-ink">A nudge, without the awkward text.</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-th-muted">Reminders go out by SMS and email on your schedule, and stop the moment they pay.</p>
              </article>

              <article className="rounded-3xl border border-th-line bg-th-raised p-7 sm:p-9">
                <p className="th-eyebrow">03 / Nothing lost in the shuffle</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {[
                    { icon: FileSignature, label: "Lease, signed" },
                    { icon: ReceiptText, label: "Receipt RCPT-0128" },
                    { icon: Bell, label: "12 messages sent" },
                  ].map((c) => (
                    <span key={c.label} className="th-shadow inline-flex items-center gap-1.5 rounded-lg border border-th-line bg-th-surface px-2.5 py-1.5 text-[12px] text-th-ink">
                      <c.icon className="h-3.5 w-3.5 text-th-accent" />{c.label}
                    </span>
                  ))}
                </div>
                <h3 className="th-display mt-7 text-[28px] leading-[1.1] text-th-ink">All the paperwork. One clear record.</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-th-muted">Contracts, invoices, receipts, and every message sent, saved together for each tenant.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Navy band — a real sequence, so it's numbered */}
        <section id="how-it-works" className="scroll-mt-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-th-band px-7 py-14 text-th-band-ink sm:px-12 sm:py-20">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div>
                <p className="th-eyebrow !text-th-band-muted">Getting started</p>
                <h2 className="th-display mt-4 text-[38px] leading-[1.05] sm:text-[52px]">
                  Set it up tonight.
                  <br />
                  <em className="!text-th-band-muted">Collect on the 5th.</em>
                </h2>
              </div>
              <Link href="/signup" className="inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-th-band-ink hover:opacity-80 md:self-auto">
                Add your first property <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <ol className="mt-14 grid gap-10 border-t border-th-band-line pt-10 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <p className="th-display text-[44px] italic leading-none text-th-band-muted">{s.n}</p>
                  <h3 className="mt-5 text-[17px] font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-th-band-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1fr_440px] md:gap-20">
            <div>
              <p className="th-eyebrow">Simple pricing</p>
              <h2 className="th-display mt-4 text-[38px] leading-[1.05] text-th-ink sm:text-[52px]">
                One plan.
                <br />
                <em>Every feature included.</em>
              </h2>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-th-muted">
                No limits on units or tenants, no add-ons to buy. Try everything free for 3 days, then pay by GCash or Maya.
              </p>
              <Link href="#faq" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-th-ink hover:text-th-accent">
                Pricing questions <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="th-shadow rounded-3xl border border-th-line bg-th-surface p-7 sm:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="th-eyebrow">Everything included</p>
                  <p className="th-display mt-2 text-[26px] text-th-ink">TenantHub</p>
                </div>
                <p className="text-right">
                  <span className="th-display tabular text-[44px] leading-none text-th-ink">₱{PRICE_PHP}</span>
                  <span className="block text-[12px] text-th-muted">per month</span>
                </p>
              </div>
              <ul className="mt-6 space-y-2.5">
                {PLAN.map((l) => (
                  <li key={l} className="flex items-start gap-2.5 text-[14px] text-th-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-th-paid" strokeWidth={2.5} />{l}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={`${pill} mt-7 w-full bg-th-brand text-th-on-brand hover:bg-th-brand-hover`}>
                Start your free trial
              </Link>
              <div className="mt-6 flex items-center justify-between border-t border-dashed border-th-line pt-5">
                <div>
                  <p className="th-eyebrow">Free trial</p>
                  <p className="mt-1 text-[14px] font-semibold text-th-ink">First 3 days</p>
                  <p className="text-[12px] text-th-muted">No card or GCash needed to start</p>
                </div>
                <p className="th-display tabular text-[28px] text-th-paid">₱0</p>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-th-faint">
            When the trial ends your account pauses until you subscribe. Nothing is deleted — your properties, tenants, and records stay saved.
          </p>
        </section>

        {/* Included grid */}
        <section className="border-t border-th-line px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-6 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="th-eyebrow">What you get</p>
                <h2 className="th-display mt-4 text-[38px] leading-[1.05] text-th-ink sm:text-[52px]">
                  Everything in one place.
                  <br />
                  <em>Nothing extra to buy.</em>
                </h2>
              </div>
              <p className="max-w-sm text-[15px] leading-relaxed text-th-muted md:justify-self-end">
                The tools you'd normally piece together from notebooks, chat threads, and spreadsheets — built in.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDED.map((c) => (
                <article key={c.tag} className="flex flex-col rounded-2xl border border-th-line bg-th-surface p-6 transition-colors hover:border-th-accent/50">
                  <p className="th-eyebrow">{c.tag}</p>
                  <h3 className="th-display mt-3 text-[22px] leading-snug text-th-ink">{c.title}</h3>
                  <p className="mt-2 flex-1 text-[14px] leading-relaxed text-th-muted">{c.body}</p>
                  <Link href="/signup" className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-th-ink hover:text-th-accent">
                    Try it free <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-th-line px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="th-eyebrow">Common questions</p>
              <h2 className="th-display mt-4 text-[38px] leading-[1.05] text-th-ink sm:text-[48px]">
                Questions,
                <br />
                <em>answered.</em>
              </h2>
              <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-th-muted">
                Still unsure? Tick “call me” when you sign up and we'll set up your first property with you.
              </p>
            </div>
            <div className="divide-y divide-th-line border-y border-th-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 [&::-webkit-details-marker]:hidden">
                    <h3 className="text-[15px] font-semibold text-th-ink">{f.q}</h3>
                    <span aria-hidden className="relative h-3.5 w-3.5 shrink-0 text-th-muted">
                      <span className="absolute left-0 top-1/2 h-[1.5px] w-3.5 -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-3.5 w-[1.5px] -translate-x-1/2 bg-current transition-transform group-open:scale-y-0" />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-th-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing panel */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-th-band px-7 pb-32 pt-14 text-th-band-ink sm:px-12 sm:pb-44 sm:pt-20">
            <p className="th-eyebrow !text-th-band-muted">Less chasing, more living</p>
            <h2 className="th-display mt-4 max-w-2xl text-[42px] leading-[1.02] sm:text-[64px]">
              Let the reminders
              <br />
              <em className="!text-th-band-muted">send themselves.</em>
            </h2>
            <Link href="/signup" className={`${pill} mt-9 bg-th-band-ink text-th-band hover:opacity-90`}>
              Start your free trial <ArrowUpRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-[13px] text-th-band-muted">Add your first property in minutes. Free for 3 days.</p>
            <p aria-hidden className="th-display pointer-events-none absolute -bottom-[0.22em] left-4 select-none whitespace-nowrap text-[96px] leading-none text-th-band-ink/[0.06] sm:left-10 sm:text-[200px]">
              TenantHub
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
