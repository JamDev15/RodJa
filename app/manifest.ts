import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TenantHub – Rental Management",
    short_name: "TenantHub",
    description: "Track rent, send reminders, e-sign leases, and issue receipts. Built for Philippine landlords.",
    lang: "en-PH",
    categories: ["business", "finance", "productivity"],
    start_url: "/",
    display: "standalone",
    background_color: "#080c14",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
