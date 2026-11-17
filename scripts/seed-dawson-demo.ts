// Fictional demo data for collections billing ("Dawson Residences (Demo)").
// Creates an 18-room property under an existing landlord account, a few
// tenants with portal PINs, a caretaker, and one issued cycle — all through
// the real collections services, so it also exercises them.
//
//   DEMO_OWNER_EMAIL=demo@rodjarent.com npx dotenv -e .env -- npx tsx scripts/seed-dawson-demo.ts
//
// Refuses to run against anything that looks like production.

import bcrypt from "bcryptjs";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || /supabase|pooler|amazonaws|neon\.tech/.test(url)) {
    throw new Error("Refusing to seed demo data into what looks like a production database.");
  }
  const { prisma } = await import("@/lib/prisma");
  const { upsertProfile } = await import("@/lib/collections/profile");
  const { addRecurringCharge, updateRoomSettings } = await import("@/lib/collections/rooms");
  const { generateStatements, publishPeriod } = await import("@/lib/collections/statements");
  const { recordAdminPayment } = await import("@/lib/collections/payments");
  const { todayIn, cyclesForMonth, monthOf } = await import("@/lib/collections/calendar");

  const email = process.env.DEMO_OWNER_EMAIL ?? "demo@rodjarent.com";
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) throw new Error(`No landlord account ${email}`);
  const admin = { kind: "ADMIN" as const, id: account.id, role: "LANDLORD" as const, accountId: account.id };

  const existing = await prisma.property.findFirst({ where: { accountId: account.id, name: "Dawson Residences (Demo)" } });
  if (existing) {
    console.log("Demo property already exists:", existing.id);
    await seedPhase2(admin, existing.id);
    await prisma.$disconnect();
    return;
  }
  const property = await prisma.property.create({
    data: { accountId: account.id, name: "Dawson Residences (Demo)", address: "Fictional St., Consolacion, Cebu", type: "apartment" },
  });
  const units = [];
  for (let i = 1; i <= 18; i++) {
    const floor = i <= 9 ? "1" : "2";
    const unitNumber = `${floor}${String(((i - 1) % 9) + 1).padStart(2, "0")}`;
    units.push(await prisma.unit.create({ data: { propertyId: property.id, unitNumber, floor, rentAmount: 7000, status: i <= 6 ? "occupied" : "vacant" } }));
  }

  await upsertProfile(admin, property.id, {
    enabled: true,
    waterEnabled: true,
    vecoEnabled: true,
    meterReadingFrequency: "Every 15th",
    paymentInstructions: "GCash: 0917 000 0000 (Demo Owner)\nCash: hand to the caretaker and get an acknowledgement slip.",
  });

  const people = [
    { name: "Ana Demo Reyes", phone: "09170000101", occupants: 1, internet: true },
    { name: "Ben Demo Cruz", phone: "09170000102", occupants: 2, internet: true },
    { name: "Carla Demo Lim", phone: "09170000103", occupants: 3, internet: false, parking: true },
    { name: "Dino Demo Tan", phone: "09170000104", occupants: 4, internet: true },
    { name: "Ella Demo Go", phone: "09170000105", occupants: 2, internet: false },
    { name: "Fe Demo Uy", phone: "09170000106", occupants: 1, internet: true },
  ];
  const pin = await bcrypt.hash("123456", 10);
  const start = monthOf(todayIn("Asia/Manila"));
  for (const [i, p] of people.entries()) {
    const unit = units[i];
    await prisma.tenant.create({
      data: { unitId: unit.id, name: p.name, phone: p.phone, email: null, moveInDate: new Date("2026-09-01T00:00:00+08:00"), portalPin: pin, occupantCount: p.occupants },
    });
    await addRecurringCharge(admin, unit.id, { type: "RENT", description: "Room rent", amountCentavos: 350000, amountBasis: "PER_CYCLE", frequency: "EVERY_CYCLE", startMonth: start });
    if (p.internet) await addRecurringCharge(admin, unit.id, { type: "INTERNET", description: "Internet", amountCentavos: 50000, amountBasis: "PER_OCCURRENCE", frequency: "MONTHLY", startMonth: start });
    if (p.parking) await addRecurringCharge(admin, unit.id, { type: "PARKING", description: "Motorcycle parking", amountCentavos: 30000, amountBasis: "PER_OCCURRENCE", frequency: "MONTHLY", startMonth: start });
    await updateRoomSettings(admin, unit.id, { meterId: `WM-${unit.unitNumber}`, vecoAccountNumber: `DEMO-VECO-${unit.unitNumber}` });
  }

  // Caretaker login (fictional).
  const caretaker = await prisma.user.upsert({
    where: { email: "caretaker.demo@example.test" },
    update: {},
    create: { accountId: account.id, email: "caretaker.demo@example.test", name: "Demo Caretaker", password: await bcrypt.hash("caretaker123", 10), role: "CARETAKER" },
  });
  await prisma.caretakerProperty.upsert({ where: { userId_propertyId: { userId: caretaker.id, propertyId: property.id } }, update: {}, create: { userId: caretaker.id, propertyId: property.id } });

  // Issue this month's first cycle and record one cash payment.
  const first = cyclesForMonth({ cycles: [{ key: "A", day: 15 }, { key: "B", day: 30 }], shortMonthPolicy: "LAST_DAY" }, start)[0];
  await generateStatements(admin, property.id, first.periodKey);
  await publishPeriod(admin, property.id, first.periodKey);
  const ana = await prisma.tenant.findFirstOrThrow({ where: { phone: "09170000101" } });
  await recordAdminPayment(admin, ana.id, { amountCentavos: 435000, method: "cash", paidOn: todayIn("Asia/Manila"), referenceNumber: "DEMO-OR-1", clientRequestId: "demo-seed-ana-1" });

  await seedPhase2(admin, property.id);
  console.log("Demo property:", property.id);
  console.log("Tenant logins: phone 09170000101..09170000106, PIN 123456");
  console.log("Caretaker login: caretaker.demo@example.test / caretaker123");
  await prisma.$disconnect();
}

/** Phase 2 demo records (household, lease, deposit, a work order, a message). Skips if already there. */
async function seedPhase2(admin: { kind: "ADMIN"; id: string; role: "LANDLORD"; accountId: string }, propertyId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { addOccupant } = await import("@/lib/operations/occupants");
  const { addLeaseTerm } = await import("@/lib/operations/leases");
  const { receiveDeposit } = await import("@/lib/operations/deposits");
  const { startChecklist } = await import("@/lib/operations/checklists");
  const { createAdminRequest } = await import("@/lib/operations/maintenance");
  const { startThread } = await import("@/lib/operations/messages");
  const ana = await prisma.tenant.findFirst({ where: { phone: "09170000101", unit: { propertyId } } });
  if (!ana) return;
  if (await prisma.occupant.count({ where: { tenantId: ana.id } })) return;
  await addOccupant(admin, ana.id, { name: ana.name, isPrimary: true });
  await addLeaseTerm(admin, ana.id, { startDate: "2026-09-01", endDate: "2027-08-31", monthlyRentCentavos: 700000 });
  await receiveDeposit(admin, ana.id, { fund: "SECURITY_DEPOSIT", amountCentavos: 700000, occurredOn: "2026-09-01", method: "cash", reference: "DEMO-DEP-1" });
  await startChecklist(admin, ana.id, "MOVE_IN");
  const caretaker = await prisma.user.findUnique({ where: { email: "caretaker.demo@example.test" } });
  const unit = await prisma.unit.findUniqueOrThrow({ where: { id: ana.unitId } });
  await createAdminRequest(admin, { propertyId, unitId: unit.id, title: "Bathroom faucet dripping", description: "Reported at the office (demo).", priority: "high", assignedToId: caretaker?.id });
  await startThread({ kind: "TENANT", id: ana.id, role: "TENANT", accountId: admin.accountId, tenantId: ana.id }, { subject: "Parking question (demo)", body: "Can I park a second motorcycle?" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
