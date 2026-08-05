"use client";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ProofPreview({ url, label = "Proof" }: { url: string | null; label?: string }) {
  if (!url) return <span className="text-gray-500">—</span>;

  if (url.toLowerCase().endsWith(".pdf")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs">
        <FileText className="h-3.5 w-3.5" />
        View PDF
      </a>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="block rounded-lg border border-white/10 overflow-hidden hover:border-blue-500/50 transition-colors">
          <img src={url} alt="Proof thumbnail" className="h-12 w-12 object-cover bg-white" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{label}</DialogTitle>
        <img src={url} alt={label} className="w-full max-h-[70vh] rounded-lg border border-white/10 object-contain bg-black/20" />
      </DialogContent>
    </Dialog>
  );
}
