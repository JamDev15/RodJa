"use client";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

export function RemoveEnrollmentButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="text-xs text-red-400 hover:text-red-300"
      onClick={async () => {
        if (!confirm("Stop this workflow for this person?")) return;
        const res = await fetch(`/api/admin/enrollments/${id}`, { method: "DELETE" });
        if (!res.ok) toast({ title: "Couldn't remove", variant: "destructive" });
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
