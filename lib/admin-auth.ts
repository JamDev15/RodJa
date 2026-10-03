import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** Returns a 401 response unless the caller is the platform Super Admin. */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
