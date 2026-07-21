"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Wrench, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MaintenanceReq {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

export default function TenantMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceReq[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal" });

  useEffect(() => {
    fetch("/api/tenant/maintenance").then(r => r.json()).then(setRequests);
  }, []);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      const newReq = await res.json();
      setRequests([newReq, ...requests]);
      setForm({ title: "", description: "", priority: "normal" });
      setShowForm(false);
      toast({ title: "Request submitted!", variant: "success" });
    } catch {
      toast({ title: "Error submitting request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Maintenance</h1>
          <p className="text-gray-400 text-sm">Report issues in your unit</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />New
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h2 className="font-semibold text-white">New Maintenance Request</h2>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="e.g. Leaking faucet" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea placeholder="Describe the issue in detail..." value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit"}</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {requests.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-center">
          <Wrench className="h-12 w-12 text-gray-600 mb-3" />
          <p className="text-gray-400">No maintenance requests</p>
        </div>
      )}

      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{req.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(req.createdAt)}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Badge variant={req.priority === "urgent" ? "destructive" : req.priority === "high" ? "warning" : "secondary"} className="text-xs">
                  {req.priority}
                </Badge>
                <Badge variant={req.status === "resolved" ? "success" : req.status === "in_progress" ? "default" : "warning"} className="text-xs">
                  {req.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
            {req.description && <p className="text-xs text-gray-400 mt-2">{req.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
