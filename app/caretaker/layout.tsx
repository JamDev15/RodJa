import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out";

export const metadata: Metadata = { title: "Meter readings", robots: { index: false, follow: false } };

export default async function CaretakerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as { role?: string; name?: string } | undefined;
  if (!user || !["CARETAKER", "LANDLORD", "STAFF"].includes(user.role ?? "")) redirect("/login");
  return (
    <div className="min-h-screen bg-th-canvas">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-th-line bg-th-surface px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span className="min-w-0 truncate text-sm font-semibold text-th-ink">Water meter readings · {user.name}</span>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">{children}</main>
    </div>
  );
}
