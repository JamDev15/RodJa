"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * Draw-to-sign canvas (finger, stylus, or mouse). Calls onChange with a PNG
 * data URL of just the inked area — or null when cleared/empty — so callers
 * never submit a blank signature.
 */
export function SignaturePad({ onChange, light = false }: { onChange: (dataUrl: string | null) => void; light?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#111827";
    bounds.current = null;
    setEmpty(true);
  }, []);

  useEffect(() => {
    setup();
    // Resizing wipes the canvas; only re-init while still empty so a
    // phone rotation mid-signature doesn't silently erase it.
    const onResize = () => { if (!bounds.current) setup(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function grow(p: { x: number; y: number }) {
    const b = bounds.current;
    bounds.current = b
      ? { minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }
      : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    grow(p);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#111827";
    ctx.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    grow(p);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    emit();
  }

  function emit() {
    const canvas = canvasRef.current;
    const b = bounds.current;
    if (!canvas || !b || (b.maxX - b.minX < 8 && b.maxY - b.minY < 8)) {
      setEmpty(!b);
      onChange(null);
      return;
    }
    // Crop to the inked area (+padding) so the stored image stays small.
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    const pad = 8;
    const sx = Math.max(0, (b.minX - pad) * ratio);
    const sy = Math.max(0, (b.minY - pad) * ratio);
    const sw = Math.min(canvas.width - sx, (b.maxX - b.minX + pad * 2) * ratio);
    const sh = Math.min(canvas.height - sy, (b.maxY - b.minY + pad * 2) * ratio);
    const out = document.createElement("canvas");
    // Downscale very high-DPI captures; 2x is plenty for print.
    const scale = Math.min(1, 2 / ratio);
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    setEmpty(false);
    onChange(out.toDataURL("image/png"));
  }

  function clear() {
    setup();
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden rounded-lg border-2 border-dashed ${light ? "border-gray-300" : "border-white/20"} bg-white`}>
        <canvas
          ref={canvasRef}
          className="block h-40 w-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          aria-label="Signature area — draw your signature"
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Sign here with your finger or mouse
          </span>
        )}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-gray-300" />
      </div>
      <button type="button" onClick={clear} className={`inline-flex items-center gap-1 text-xs ${light ? "text-gray-500 hover:text-gray-800" : "text-gray-400 hover:text-white"}`}>
        <Eraser className="h-3.5 w-3.5" /> Clear
      </button>
    </div>
  );
}
