import { prisma } from "@/lib/prisma";
import { SignupForm } from "./signup-form";

// Reads live PlatformSettings (GCash/Maya QR + numbers) — must never be
// statically cached, or a payment-info update wouldn't show until rebuild.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const platformSettings = await prisma.platformSettings.findFirst();

  return <SignupForm platformSettings={platformSettings} />;
}
