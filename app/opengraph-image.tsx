import { ImageResponse } from "next/og";

export const alt = "TenantHub — rental management app for Philippine landlords. Free 3-day trial, then ₱499/month.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #080c14 0%, #0d1a33 60%, #123a8f 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 16, background: "#2563eb", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800 }}>
            T
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>TenantHub</div>
          <div style={{ display: "flex", marginLeft: 12, padding: "6px 16px", borderRadius: 999, border: "2px solid rgba(96,165,250,0.5)", color: "#93c5fd", fontSize: 22 }}>
            Built for Philippine landlords
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.08, maxWidth: 980 }}>
            Collect rent, send reminders, and e-sign leases — in one app.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#cbd5e1" }}>
            GCash & Maya ready · Automatic receipts · Tenant portal
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", padding: "14px 28px", borderRadius: 14, background: "#2563eb", fontSize: 30, fontWeight: 700 }}>
            Free 3-day trial
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#e2e8f0" }}>then PHP 499/month · tenant-hub.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
