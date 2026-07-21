import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * DB-backed attempt counter (works across serverless instances, unlike an
 * in-memory map). Callers record a row per failed attempt and check the
 * count before doing any expensive/sensitive work (password compare, DB writes).
 */
export async function isRateLimited(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await prisma.loginAttempt.count({
    where: { identifier, createdAt: { gte: since } },
  });
  return count >= MAX_ATTEMPTS;
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { identifier } });
}

export async function clearAttempts(identifier: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { identifier } });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
