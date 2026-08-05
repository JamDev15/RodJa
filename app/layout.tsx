import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RegisterServiceWorker } from "@/components/register-sw";

export const metadata: Metadata = {
  title: "RodjaRent – Rental Management for Philippine Landlords",
  description: "Manage your rental properties, tenants, and payments with ease.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RodjaRent",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-[#080c14] text-white antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
