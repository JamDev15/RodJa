import { auth } from "@/lib/auth";

/** The landlord account id for the current owner/staff session, or null. */
export async function currentAccountId(): Promise<string | null> {
  const session = await auth();
  const user = session?.user as { role?: string; accountId?: string } | undefined;
  if (!user?.accountId || !["LANDLORD", "STAFF"].includes(user.role ?? "")) return null;
  return user.accountId;
}
