"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";

export function SignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!signature) return setError("Please draw your signature in the box.");
    if (name.trim().length < 2) return setError("Please type your full name.");
    if (!agree) return setError("Please tick the box to agree to sign electronically.");
    setLoading(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, signedName: name.trim(), agree }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't sign. Please try again.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Sign this contract</h2>
      <p className="mt-1 text-sm text-gray-600">Read the full contract above, then draw your signature below.</p>
      <div className="mt-4">
        <SignaturePad onChange={setSignature} light />
      </div>
      <label className="mt-4 block text-sm font-medium" htmlFor="signed-name">Your full name</label>
      <input
        id="signed-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
      />
      <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read this contract and agree that my electronic signature is the legal equivalent of my handwritten signature.
      </label>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Signing…" : "Sign contract"}
      </button>
    </section>
  );
}
