import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landlord sign in",
  description: "Sign in to TenantHub to manage your rentals, tenants, payments, contracts, and reminders.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
