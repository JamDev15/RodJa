import type { Metadata } from "next";
import Link from "next/link";
import {
  Home, CheckCircle, Building2, Users, CreditCard, Bell, Globe, ArrowRight,
  MessageCircle, UserPlus, Wallet, FileSignature, ReceiptText, History, Zap, ChevronDown,
} from "lucide-react";
import { HeroMockup } from "@/components/landing/hero-mockup";
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

const features = [
  { icon: Bell, title: "Automatic rent reminders", desc: "Email, SMS, and in-app reminders before and after every due date — no more chasing tenants on Messenger." },
  { icon: Zap, title: "Custom automations", desc: "Build your own rules: an SMS 3 days before rent is due, an overdue notice, a lease-ending heads-up — for your tenant, you, or both.", badge: "New" },
  { icon: FileSignature, title: "Online lease contracts", desc: "Start from a Philippine lease template, sign on your phone, and your tenant signs from a link. Both get the signed PDF.", badge: "New" },
  { icon: ReceiptText, title: "Invoices & automatic receipts", desc: "Send an itemized bill in one tap. Receipts are emailed automatically when you mark a payment as paid.", badge: "New" },
  { icon: History, title: "Message history", desc: "See every reminder, invoice, and contract that went out — to whom, when, and whether it was delivered.", badge: "New" },
  { icon: CreditCard, title: "GCash & Maya ready", desc: "Tenants pay the way they already do and upload their proof. You approve with one tap." },
  { icon: Users, title: "Tenant portal", desc: "Tenants see their balance, pay, sign contracts, download receipts, and request repairs." },
  { icon: Building2, title: "Itemized monthly bills", desc: "Rent, kuryente, tubig, and other charges per tenant, with partial payments and carry-over balances." },
  { icon: MessageCircle, title: "Chat assistant", desc: "Type “add ₱500 electric bill for Juan” — it finds the right tenant and saves it. No forms." },
  { icon: Globe, title: "Public listings", desc: "Post vacant units on a shareable listing page to find your next tenant." },
];

const steps = [
  { icon: UserPlus, title: "Add your properties and tenants", desc: "Apartments, boarding houses, bedspaces, dorms — set them up in minutes, or we'll do it with you on a free onboarding call." },
  { icon: Bell, title: "Reminders and contracts run themselves", desc: "Tenants get nudged before and after due dates, and sign their lease online. You get a copy of everything." },
  { icon: Wallet, title: "Collect, approve, done", desc: "Tenants pay via GCash or Maya and upload proof; you approve and a receipt goes out automatically." },
];

const included = [
  "Unlimited properties, units & tenants",
  "Automatic reminders (email, SMS, push)",
  "Custom reminder automations",
  "E-signed lease contracts + PDF",
  "Invoices & automatic receipts",
  "Message history",
  "Tenant portal & GCash/Maya proof upload",
  "Chat assistant, listings & maintenance",
];

const audiences = ["Apartments", "Boarding houses", "Bedspaces", "Dormitories", "Condo units", "Houses for rent"];

export default function LandingPage() {
  const ld = [organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), faqJsonLd()];

  return (
    <div className="min-h-screen bg-[#080c14] text-white overflow-x-hidden">
      {ld.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
      ))}

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080c14]/80 backdrop-blur-md" aria-label="Main">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="TenantHub home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shrink-0">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">TenantHub</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              <span className="sm:hidden">Try free</span>
              <span className="hidden sm:inline">Start 3-day free trial</span>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute top-20 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
          </div>

          <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-400 mb-6">
                Built for Philippine landlords 🇵🇭
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
                The rental management app<br />
                <span className="bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">for Philippine landlords</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 mb-8">
                Track rent and bills, collect via GCash or Maya, send automatic reminders, e-sign lease contracts, and issue receipts — all from your phone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link href="/signup" className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40">
                  Start free for 3 days <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/listings" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
                  Browse rentals
                </Link>
              </div>
              <p className="mt-4 text-sm text-gray-500">No credit card · Then ₱{PRICE_PHP}/month · Cancel anytime</p>
            </div>

            <HeroMockup />
          </div>
        </section>

        {/* Audiences */}
        <section className="border-y border-white/10 bg-white/[0.02]" aria-label="Who it's for">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-gray-400">
            <span className="text-gray-500">Made for:</span>
            {audiences.map((a) => <span key={a}>{a}</span>)}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Everything you need to manage rentals</h2>
            <p className="text-gray-400">One platform, built for how Philippine landlords actually collect rent.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc, badge }) => (
              <div
                key={title}
                className={`group relative rounded-xl border p-5 transition-all hover:-translate-y-0.5 ${badge ? "border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/[0.15]" : "border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-white/20"}`}
              >
                {badge && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">{badge}</span>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 mb-3 transition-colors group-hover:bg-blue-600/30">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-white/10 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-white mb-3">Up and running in three steps</h2>
              <p className="text-gray-400">No spreadsheets, no back-and-forth over Messenger.</p>
            </div>
            <ol className="grid md:grid-cols-3 gap-8 md:gap-4">
              {steps.map(({ icon: Icon, title, desc }, i) => (
                <li key={title} className="relative text-center md:text-left">
                  <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600/20">
                      <Icon className="h-6 w-6 text-blue-400" />
                    </div>
                    <span className="text-3xl font-bold text-white/10">0{i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-white text-lg mb-2">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section className="max-w-5xl mx-auto px-6 py-20" id="pricing">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">One simple price</h2>
            <p className="text-gray-400 text-sm">Every feature, no limits. Try it free for 3 days first.</p>
          </div>
          <div className="mx-auto max-w-md rounded-2xl border border-blue-500/50 bg-blue-500/10 p-8 shadow-xl shadow-blue-600/10">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">TenantHub</h3>
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">3 days free</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-5xl font-bold text-white">₱{PRICE_PHP}</span>
              <span className="text-gray-400">/ month</span>
            </div>
            <p className="mt-1 text-sm text-gray-400">Pay via GCash or Maya. Cancel anytime.</p>
            <ul className="mt-6 space-y-2.5">
              {included.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-200">
                  <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="mt-8 block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Start your free trial
            </Link>
            <p className="mt-3 text-center text-xs text-gray-500">After 3 days your account pauses until you subscribe — your data stays safe.</p>
          </div>
        </section>

        {/* FAQ — answer-first copy, mirrored in FAQPage structured data */}
        <section id="faq" className="border-t border-white/10 bg-white/[0.02]">
          <div className="max-w-3xl mx-auto px-6 py-20">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Frequently asked questions</h2>
            <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
              {FAQ.map((f, i) => (
                <details key={f.q} className="group px-5 py-4" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base">{f.q}</h3>
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-gray-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-4xl mx-auto px-6 py-20">
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-blue-500/5 px-8 py-14 text-center">
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-blue-500/20 blur-[90px]" />
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to stop chasing rent manually?</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">Set up your first property in minutes — or tick “call me” at signup and we&apos;ll set it up with you.</p>
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25">
              Start free for 3 days <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-white">TenantHub</span>
            <span className="text-sm text-gray-600">· Rental management for the Philippines</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500" aria-label="Footer">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/listings" className="hover:text-white transition-colors">Rentals</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
            <Link href="/tenant/login" className="hover:text-white transition-colors">Tenant portal</Link>
          </nav>
          <p className="text-sm text-gray-600">© {new Date().getFullYear()} TenantHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
