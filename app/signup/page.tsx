import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Start your free 3-day trial",
  description:
    "Create your TenantHub account in a minute. Track rent, send reminders, e-sign lease contracts, and issue receipts — free for 3 days, then ₱499/month.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return <SignupForm />;
}
