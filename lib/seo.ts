// Single source of truth for search/answer-engine metadata. Philippines-first
// today; keep copy currency/locale-driven so adding markets later is a
// matter of adding locales, not rewriting pages.

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");
export const SITE_NAME = "TenantHub";
export const PRICE_PHP = 499;
export const TRIAL_DAYS_LABEL = "3-day";

export const DEFAULT_TITLE = "TenantHub – Rental Management App for Landlords in the Philippines";
export const DEFAULT_DESCRIPTION =
  "Track rent, collect via GCash or Maya, send automatic reminders, e-sign lease contracts, and issue receipts — all in one app for Philippine landlords, apartments, and boarding houses. Free 3-day trial, then ₱499/month.";

export const KEYWORDS = [
  "rental management app Philippines",
  "property management software Philippines",
  "landlord app Philippines",
  "rent tracker",
  "rent collection GCash",
  "apartment management system",
  "boarding house management",
  "dormitory management",
  "paupahan app",
  "tenant management app",
  "lease contract e-signature Philippines",
  "rent receipt generator",
  "rent reminder SMS",
];

export interface FaqItem {
  q: string;
  a: string;
}

// Written answer-first so search engines and AI assistants can quote them directly.
export const FAQ: FaqItem[] = [
  {
    q: "What is TenantHub?",
    a: "TenantHub is a rental management app for landlords in the Philippines. It tracks rent and utility bills per tenant, sends automatic payment reminders by email and SMS, lets tenants upload GCash or Maya payment proof, handles e-signed lease contracts, and emails invoices and receipts.",
  },
  {
    q: "How much does TenantHub cost?",
    a: "TenantHub costs ₱499 per month for unlimited properties, units, and tenants. Every new account starts with a free 3-day trial with full access — no payment needed to start.",
  },
  {
    q: "What happens when the 3-day free trial ends?",
    a: "Your account pauses until you subscribe. Nothing is deleted: your properties, tenants, ledgers, and contracts stay saved, and you can reactivate anytime by paying ₱499 via GCash or Maya.",
  },
  {
    q: "Can tenants pay rent through GCash or Maya?",
    a: "Yes. Tenants pay to your GCash, Maya, or bank account, then upload their proof of payment in the tenant portal. You approve it with one tap and TenantHub can email them a receipt automatically.",
  },
  {
    q: "Can my tenant sign the lease contract online?",
    a: "Yes. Start from a ready-made Philippine residential lease template, sign it on your phone, and send it. Your tenant signs from a private link — no account needed — and both of you get the signed PDF with an audit trail. Electronic signatures are recognized under the Philippine E-Commerce Act (R.A. 8792).",
  },
  {
    q: "Does TenantHub send rent reminders automatically?",
    a: "Yes. Reminders go out before and after each due date by email, SMS, in-app notice, or push notification. You can also build your own automations — for example, an SMS 3 days before rent is due, an overdue notice after 3 days, or a lease-ending notice 30 days ahead.",
  },
  {
    q: "Can I see every reminder and message that was sent?",
    a: "Yes. Message History logs every email, SMS, push, and in-app message sent to your tenants and to you — with the full text, the date, and whether it was delivered.",
  },
  {
    q: "Is TenantHub good for boarding houses, dorms, and apartments?",
    a: "Yes. TenantHub works for apartments, boarding houses, bedspaces, dormitories, condo units, and houses for rent. Each tenant gets an itemized monthly ledger for rent, electricity (kuryente), water (tubig), and other charges.",
  },
  {
    q: "Is there a mobile app?",
    a: "TenantHub works in any phone browser and can be installed to your home screen like an app on Android and iPhone. Native Android and iOS apps are in development.",
  },
];

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    areaServed: { "@type": "Country", name: "Philippines" },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "en-PH",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Property management",
    operatingSystem: "Web, Android, iOS",
    inLanguage: "en-PH",
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: {
      "@type": "Offer",
      price: String(PRICE_PHP),
      priceCurrency: "PHP",
      category: "subscription",
      availability: "https://schema.org/InStock",
      eligibleRegion: { "@type": "Country", name: "PH" },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: PRICE_PHP,
        priceCurrency: "PHP",
        billingDuration: "P1M",
        unitText: "MONTH",
      },
    },
    featureList: [
      "Rent and utility bill tracking per tenant",
      "Automatic rent reminders by email, SMS, and push",
      "GCash and Maya payment proof upload and approval",
      "Online lease contracts with e-signatures and PDF download",
      "Invoices and automatic receipts",
      "Custom reminder automations",
      "Message history",
      "Tenant portal",
      "Public vacancy listings",
    ],
  };
}

export function faqJsonLd(items: FaqItem[] = FAQ) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Serialises JSON-LD safely for an inline <script> (no "</script>" breakout). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
