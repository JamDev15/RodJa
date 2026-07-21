import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// One-off: bcrypt-hash any tenant PINs still stored in plaintext.
// Safe to run repeatedly — already-hashed PINs (bcrypt format, prefixed "$2") are skipped.
async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, portalPin: true } });
  let migrated = 0;
  for (const tenant of tenants) {
    if (tenant.portalPin.startsWith("$2")) continue;
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { portalPin: await bcrypt.hash(tenant.portalPin, 10) },
    });
    migrated++;
  }
  console.log(`Hashed ${migrated} plaintext PIN(s) out of ${tenants.length} tenant(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
