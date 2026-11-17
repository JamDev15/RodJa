import { MessageCircle } from "lucide-react";
import { ActionForm } from "@/components/collections/action-form";

/**
 * "Get alerts on Messenger" — opens Messenger through a signed connect link
 * (the API route redirects to m.me). Hidden when Messenger isn't set up.
 */
export function MessengerCard({ available, linked, connectHref, apiUrl, audience }: { available: boolean; linked: boolean; connectHref: string; apiUrl: string; audience: "tenant" | "office" }) {
  if (!available) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-th-line bg-th-surface p-4">
      <div className="flex min-w-0 items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-th-accent" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-th-ink">{linked ? "Messenger alerts are on" : "Get alerts on Messenger"}</p>
          <p className="text-xs text-th-faint">
            {audience === "tenant"
              ? linked
                ? "We'll message you about replies from the office, statements and payments. You can reply in Messenger too."
                : "Get a Messenger message when the office replies, a statement is ready, or a payment is checked."
              : linked
                ? "You'll get a Messenger message when tenants write, send payments or report repairs."
                : "Get a Messenger message when tenants write, send payments or report repairs."}
          </p>
        </div>
      </div>
      {linked ? (
        <ActionForm url={apiUrl} method="DELETE" submitLabel="Turn off" variant="outline" successMessage="Messenger alerts turned off" />
      ) : (
        <a href={connectHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-th-brand px-3 py-2 text-sm font-medium text-th-on-brand">
          Open Messenger
        </a>
      )}
    </div>
  );
}
