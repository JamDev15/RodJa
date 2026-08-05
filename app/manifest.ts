import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RodjaRent",
    short_name: "RodjaRent",
    description: "Manage your rental properties, tenants, and payments with ease.",
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
    ],
  };
}
