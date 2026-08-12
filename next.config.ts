import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "";

// next dev's webpack HMR runtime wraps modules in eval() — without
// 'unsafe-eval' the browser silently blocks every client bundle from
// running, so no client component gets working event handlers locally.
// Production builds don't use eval, so this relaxation never ships.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://www.facebook.com${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net${isDev ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self'",
  `connect-src 'self' https://www.facebook.com${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
