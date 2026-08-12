"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export function HelpForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({ title: "Message sent — we'll get back to you by email.", variant: "success" });
      setForm({ subject: "", message: "" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error sending message", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-white">Submit an Issue</h2>
        <p className="text-xs text-gray-500 mt-0.5">We&apos;ll reply to your account email as soon as we can.</p>
      </div>
      <div className="space-y-4 max-w-lg">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="e.g. Payment approval isn't working"
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Describe what happened, what you expected, and any steps to reproduce it..."
            rows={6}
            maxLength={5000}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Message"}</Button>
    </form>
  );
}
