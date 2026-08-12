import Link from "next/link";
import {
  Home, CheckCircle, Building2, Users, CreditCard, Bell, Globe, ArrowRight,
  MessageCircle, UserPlus, Wallet,
} from "lucide-react";
import { HeroMockup } from "@/components/landing/hero-mockup";

const features = [
  { icon: MessageCircle, title: "Chat Assistant", desc: "Just type \"add ₱500 electric bill for Juan\" — it finds the right tenant and saves it. No forms.", badge: "Pro" },
  { icon: Building2, title: "Property Management", desc: "Manage multiple properties and units in one place." },
  { icon: Users, title: "Tenant Portal", desc: "Tenants can view balances and upload payment proofs." },
  { icon: CreditCard, title: "GCash & Maya Ready", desc: "Built for the Philippine market — no Stripe needed." },
  { icon: Bell, title: "Auto Reminders", desc: "Email and in-app reminders before and after due dates." },
  { icon: Globe, title: "Public Listings", desc: "List vacant units and attract new tenants online." },
  { icon: CheckCircle, title: "Payment Approval", desc: "Review uploaded proofs and approve with one tap." },
];

const steps = [
  { icon: UserPlus, title: "Add your properties", desc: "Set up your properties, units, and tenants — or import them in minutes." },
  { icon: Bell, title: "Reminders go out automatically", desc: "Tenants get nudged before and after their due date, no follow-up calls needed." },
  { icon: Wallet, title: "Collect and track", desc: "Tenants pay via GCash or Maya and upload proof; you approve with one tap." },
];

const plans = [
  { name: "Free", price: "₱0", period: "7-day trial", features: ["1 property", "3 units", "20 tenants", "Manual tracking"], cta: "Get Started", highlight: false, planKey: "free" },
  { name: "Basic", price: "₱199", period: "/ month", features: ["3 properties", "15 units", "50 tenants", "Email reminders", "Payment proofs"], cta: "Subscribe", highlight: false, planKey: "basic" },
  { name: "Pro", price: "₱499", period: "/ month", features: ["Chat Assistant", "Unlimited everything", "Public listings", "Maintenance module", "PDF/CSV export", "Priority support"], cta: "Go Pro", highlight: true, planKey: "pro" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080c14]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">TenantHub</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute top-20 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-400 mb-6">
              Built for Philippine Landlords 🇵🇭
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
              Manage your rentals<br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">the smart way</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 mb-10">
              Track payments, manage tenants, and collect via GCash or Maya — all in one platform made for the Philippine rental market.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href="/signup" className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40">
                Start for Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/listings" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
                Browse Listings
              </Link>
            </div>
          </div>

          <HeroMockup />
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
                <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  {badge}
                </span>
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
          <div className="grid md:grid-cols-3 gap-8 md:gap-4">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative text-center md:text-left">
                <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600/20">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <span className="text-3xl font-bold text-white/10">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-white text-lg mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-20" id="pricing">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Simple, affordable pricing</h2>
          <p className="text-gray-400 text-sm">No hidden fees. Cancel anytime.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 flex flex-col transition-all hover:-translate-y-0.5 ${plan.highlight ? "border-blue-500/50 bg-blue-500/10 relative shadow-xl shadow-blue-600/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <div className="mb-4">
                <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${plan.planKey}`}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold text-center transition-colors ${plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-blue-500/5 px-8 py-14 text-center">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-blue-500/20 blur-[90px]" />
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to stop chasing rent manually?</h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">Set up your first property in minutes. No credit card required to start.</p>
          <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25">
            Start for Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-white">TenantHub</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/listings" className="hover:text-white transition-colors">Listings</Link>
          </div>
          <p className="text-sm text-gray-600">© {new Date().getFullYear()} TenantHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
