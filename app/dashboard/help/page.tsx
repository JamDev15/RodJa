import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageCircle } from "lucide-react";
import { HelpForm } from "@/components/dashboard/help-form";

export default async function HelpPage() {
  const session = await auth();
  const user = session?.user as any;

  let isPro = false;
  if (user?.role === "LANDLORD" && user.accountId) {
    const account = await prisma.account.findUnique({ where: { id: user.accountId }, select: { plan: { select: { name: true } } } });
    isPro = account?.plan.name === "Pro";
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-th-ink">Help</h1>
        <p className="text-th-muted text-sm mt-1">Run into a problem or have a question?</p>
      </div>

      {isPro && (
        <div className="rounded-xl border border-th-accent/30 bg-th-brand-soft p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-th-brand-soft">
            <MessageCircle className="h-4 w-4 text-th-accent" />
          </div>
          <p className="text-sm text-th-ink/80">
            For quick things — adding a bill, updating a tenant — try the <span className="text-th-ink font-medium">Chat Assistant</span> in the bottom-right corner instead of waiting on email.
          </p>
        </div>
      )}

      <HelpForm />
    </div>
  );
}
