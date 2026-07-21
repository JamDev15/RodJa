import Link from "next/link";
import { Home, CheckCircle, Building2, Users, CreditCard, Bell, Globe, ArrowRight } from "lucide-react";

const features = [
  { icon: Building2, title: "Property Management", desc: "Manage multiple properties and units in one place." },
  { icon: Users, title: "Tenant Portal", desc: "Tenants can view balances and upload payment proofs." },
  { icon: CreditCard, title: "GCash & Maya Ready", desc: "Built for the Philippine market — no Stripe needed." },
  { icon: Bell, title: "Auto Reminders", desc: "SMS, email, and in-app reminders before and after due dates." },
  { icon: Globe, title: "Public Listings", desc: "List vacant units and attract new tenants online." },
  { icon: CheckCircle, title: "Payment Approval", desc: "Review uploaded proofs and approve with one tap." },
];

const plans = [
  { name: "Free", price: "₱0", period: "forever", features: ["1 property", "3 units", "20 tenants", "Manual tracking"], cta: "Get Started", highlight: false },
  { name: "Basic", price: "₱199", period: "/ month", features: ["3 properties", "15 units", "50 tenants", "SMS reminders", "Payment proofs"], cta: "Start Free Trial", highlight: false },
  { name: "Pro", price: "₱499", period: "/ month", features: ["Unlimited everything", "Public listings", "Maintenance module", "PDF/CSV export", "Priority support"], cta: "Go Pro", highlight: true },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Home className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">RodjaRent</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
          <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-400 mb-6">
          Built for Philippine Landlords 🇵🇭
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          Manage your rentals<br />
          <span className="text-blue-400">the smart way</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Track payments, manage tenants, and collect via GCash or Maya — all in one platform made for the Philippine rental market.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup" className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
            Start for Free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/listings" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
            Browse Listings
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Everything you need to manage rentals</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 mb-3">
                <Icon className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-16" id="pricing">
        <h2 className="text-2xl font-bold text-white text-center mb-2">Simple, affordable pricing</h2>
        <p className="text-gray-400 text-center mb-10 text-sm">No hidden fees. Cancel anytime.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-xl border p-6 flex flex-col ${plan.highlight ? "border-blue-500/50 bg-blue-500/10 relative" : "border-white/10 bg-white/5"}`}>
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
                href="/signup"
                className={`w-full rounded-lg py-2.5 text-sm font-semibold text-center transition-colors ${plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-600">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Home className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-white">RodjaRent</span>
        </div>
        © {new Date().getFullYear()} RodjaRent. All rights reserved.
      </footer>
    </div>
  );
}
