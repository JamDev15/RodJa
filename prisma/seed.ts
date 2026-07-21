import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Seed plans
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: "plan_free" },
      update: {},
      create: {
        id: "plan_free",
        name: "Free",
        price: 0,
        maxProperties: 1,
        maxUnits: 3,
        maxTenants: 20,
        features: { smsReminders: false, paymentProof: false, publicListings: false, maintenance: false },
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_basic" },
      update: {},
      create: {
        id: "plan_basic",
        name: "Basic",
        price: 199,
        maxProperties: 3,
        maxUnits: 15,
        maxTenants: 50,
        features: { smsReminders: true, paymentProof: true, publicListings: false, maintenance: false },
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_pro" },
      update: {},
      create: {
        id: "plan_pro",
        name: "Pro",
        price: 499,
        maxProperties: -1,
        maxUnits: -1,
        maxTenants: -1,
        features: { smsReminders: true, paymentProof: true, publicListings: true, maintenance: true, exportPdf: true },
      },
    }),
  ]);

  console.log("✓ Plans seeded");

  // Seed Super Admin
  const superAdminPassword = await bcrypt.hash("admin123", 12);
  await prisma.superAdmin.upsert({
    where: { email: "admin@rodjarent.com" },
    update: {},
    create: {
      email: "admin@rodjarent.com",
      password: superAdminPassword,
      name: "Super Admin",
    },
  });
  console.log("✓ Super Admin seeded → admin@rodjarent.com / admin123");

  // Seed demo Landlord account
  const landlordPassword = await bcrypt.hash("landlord123", 12);
  const demoAccount = await prisma.account.upsert({
    where: { email: "demo@rodjarent.com" },
    update: {},
    create: {
      email: "demo@rodjarent.com",
      password: landlordPassword,
      name: "Santos Apartments",
      ownerName: "Juan Santos",
      phone: "09171234567",
      planId: plans[1].id, // Basic plan
      gcashNumber: "09171234567",
      mayaNumber: "09171234567",
    },
  });
  console.log("✓ Demo Landlord → demo@rodjarent.com / landlord123");

  // Seed demo Property + Units + Tenant
  const property = await prisma.property.upsert({
    where: { slug: "santos-apartments-demo" },
    update: {},
    create: {
      accountId: demoAccount.id,
      name: "Santos Apartments",
      address: "123 Rizal St, Quezon City",
      type: "apartment",
      description: "A comfortable apartment complex in QC",
      slug: "santos-apartments-demo",
    },
  });

  const unit101 = await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: "101",
      floor: "1st Floor",
      rentAmount: 8000,
      depositAmount: 8000,
      status: "occupied",
    },
  });

  await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: "102",
      floor: "1st Floor",
      rentAmount: 8000,
      depositAmount: 8000,
      status: "vacant",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { phone: "09181234567" },
    update: {},
    create: {
      unitId: unit101.id,
      name: "Maria dela Cruz",
      email: "maria@email.com",
      phone: "09181234567",
      moveInDate: new Date("2026-01-01"),
      depositAmount: 8000,
      depositPaid: true,
      portalPin: await bcrypt.hash("123456", 10),
    },
  });
  console.log("✓ Demo Tenant → phone: 09181234567 / PIN: 123456");

  // Seed some payments
  const months = ["2026-04", "2026-05", "2026-06"];
  for (const month of months) {
    const [year, m] = month.split("-");
    await prisma.payment.upsert({
      where: { id: `pay_${month}` },
      update: {},
      create: {
        id: `pay_${month}`,
        tenantId: tenant.id,
        amount: 8000,
        month,
        dueDate: new Date(Number(year), Number(m) - 1, 5),
        paidDate: new Date(Number(year), Number(m) - 1, 3),
        status: "approved",
        method: "gcash",
      },
    });
  }

  // Current month pending
  await prisma.payment.upsert({
    where: { id: "pay_2026-07" },
    update: {},
    create: {
      id: "pay_2026-07",
      tenantId: tenant.id,
      amount: 8000,
      month: "2026-07",
      dueDate: new Date(2026, 6, 5),
      status: "pending",
    },
  });
  console.log("✓ Demo payments seeded");

  console.log("\n🎉 Seed complete!\n");
  console.log("Accounts:");
  console.log("  Super Admin : admin@rodjarent.com / admin123");
  console.log("  Landlord    : demo@rodjarent.com / landlord123");
  console.log("  Tenant PIN  : phone 09181234567 / PIN 123456");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
