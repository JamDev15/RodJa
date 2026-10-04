import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RegisterServiceWorker } from "@/components/register-sw";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: KEYWORDS,
  category: "business",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  // Canonical URLs are set per page — a canonical here would be inherited by
  // every page and point them all at the homepage.
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false },
  ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION
    ? {
        verification: {
          ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
          ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
        },
      }
    : {}),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TenantHub",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    // iOS Safari reads this specifically for the home-screen icon — it
    // ignores the manifest's icons array entirely, and doesn't accept SVG.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Plus Jakarta Sans (OFL, by Tokotype) — self-hosted. The latin-ext file is a
// second family in the stack so characters like ₱ render in the same face.
const jakarta = localFont({
  src: "./fonts/jakarta-latin.woff2",
  weight: "200 800",
  variable: "--font-jakarta-latin",
  display: "swap",
});
const jakartaExt = localFont({
  src: "./fonts/jakarta-latin-ext.woff2",
  weight: "200 800",
  variable: "--font-jakarta-ext",
  display: "swap",
  preload: false,
});

// Newsreader (OFL, Production Type) — serif for public-page headlines.
const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-latin.woff2", style: "normal" },
    { path: "./fonts/newsreader-latin-italic.woff2", style: "italic" },
  ],
  weight: "200 800",
  variable: "--font-serif-latin",
  display: "swap",
});
const newsreaderExt = localFont({
  src: [
    { path: "./fonts/newsreader-latin-ext.woff2", style: "normal" },
    { path: "./fonts/newsreader-latin-ext-italic.woff2", style: "italic" },
  ],
  weight: "200 800",
  variable: "--font-serif-ext",
  display: "swap",
  preload: false,
});

// Runs before paint: apply the saved or device theme so there's no flash.
const themeScript = `(function(){try{var t=localStorage.getItem("th-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`h-full ${jakarta.variable} ${jakartaExt.variable} ${newsreader.variable} ${newsreaderExt.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-[#080c14] text-white antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
        <RegisterServiceWorker />
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1517908726328380');
          fbq('track', 'PageView');`}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            alt=""
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1517908726328380&ev=PageView&noscript=1"
          />
        </noscript>
      </body>
    </html>
  );
}
