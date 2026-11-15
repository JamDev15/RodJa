"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoUpload({ propertyId, logoFileId }: { propertyId: string; logoFileId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    form.set("propertyId", propertyId);
    try {
      const res = await fetch("/api/collections/profile/logo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Upload failed");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 rounded-lg border border-th-line bg-th-surface p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logoFileId ? <img src={`/api/files/${logoFileId}`} alt="Current logo" className="h-12 w-12 rounded object-contain" /> : <span className="text-xs text-th-faint">No logo yet</span>}
      <input name="logo" type="file" required accept="image/jpeg,image/png,image/webp" className="min-w-0 flex-1 text-sm text-th-ink file:mr-3 file:rounded-lg file:border-0 file:bg-th-raised file:px-3 file:py-2 file:text-th-ink" />
      <Button type="submit" size="sm" disabled={busy}>{busy ? "Uploading…" : "Upload logo"}</Button>
      {error && <p className="w-full text-sm text-th-danger">{error}</p>}
    </form>
  );
}
