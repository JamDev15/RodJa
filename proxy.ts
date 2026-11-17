import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// "Public" here means no session cookie is required at this layer — routes
// under /api/cron enforce their own CRON_SECRET bearer-token check instead,
// since Vercel Cron triggers carry no user session.
// /api/sign, /api/docs, /api/renew and /api/unsubscribe are authorized by the
// unguessable or signed token in their URL instead of a session (tenants sign
// contracts and open invoices from an emailed link without logging in).
// /api/messenger/webhook is called by Meta and verifies the request's
// X-Hub-Signature-256 HMAC with the app secret instead; /api/facebook/
// (data deletion) verifies Meta's signed_request the same way.
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/signup", "/api/cron", "/api/sign/", "/api/docs/", "/api/renew", "/api/unsubscribe", "/api/messenger/webhook", "/api/facebook/"];
const TENANT_API_PREFIXES = ["/api/tenant/", "/api/payments/submit", "/api/maintenance"];
// Meter entry: caretakers plus the landlord/staff who manage them.
const CARETAKER_API_PREFIXES = ["/api/caretaker/"];
// Private billing evidence: every signed-in role reaches the route, which
// then checks the specific file against the caller (lib/collections/files.ts).
const FILE_API_PREFIXES = ["/api/files/"];
const ADMIN_API_PREFIXES = ["/api/admin"];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isTenantRoute =
    pathname.startsWith("/tenant") && pathname !== "/tenant/login";

  if (isApiRoute && startsWithAny(pathname, PUBLIC_API_PREFIXES)) {
    return NextResponse.next();
  }

  const session = await auth();
  const role = (session?.user as any)?.role;

  if (isApiRoute) {
    const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (startsWithAny(pathname, ADMIN_API_PREFIXES)) {
      if (!session || role !== "SUPER_ADMIN") return unauthorized();
      return NextResponse.next();
    }

    if (startsWithAny(pathname, TENANT_API_PREFIXES)) {
      if (!session || role !== "TENANT") return unauthorized();
      return NextResponse.next();
    }

    if (startsWithAny(pathname, CARETAKER_API_PREFIXES)) {
      if (!session || !["CARETAKER", "LANDLORD", "STAFF"].includes(role)) return unauthorized();
      return NextResponse.next();
    }

    if (pathname === "/api/devices" || pathname.startsWith("/api/devices/")) {
      // Phone-app push registration: tenants and office users (checked again in the route).
      if (!session || !["TENANT", "LANDLORD", "STAFF"].includes(role)) return unauthorized();
      return NextResponse.next();
    }

    if (startsWithAny(pathname, FILE_API_PREFIXES)) {
      if (!session || !["TENANT", "LANDLORD", "STAFF", "CARETAKER"].includes(role)) return unauthorized();
      return NextResponse.next();
    }

    // Everything else under /api is landlord/staff-scoped.
    if (!session || !["LANDLORD", "STAFF"].includes(role)) return unauthorized();
    return NextResponse.next();
  }

  if (isAdminRoute) {
    if (!session || role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (isDashboardRoute) {
    if (role === "CARETAKER") {
      return NextResponse.redirect(new URL("/caretaker", request.url));
    }
    if (!session || !["LANDLORD", "STAFF"].includes(role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname.startsWith("/caretaker")) {
    if (!session || !["CARETAKER", "LANDLORD", "STAFF"].includes(role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (isTenantRoute) {
    if (!session || role !== "TENANT") {
      return NextResponse.redirect(new URL("/tenant/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/tenant/:path*", "/caretaker/:path*", "/caretaker", "/api/:path*"],
};
