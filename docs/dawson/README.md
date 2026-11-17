# Collections billing and operations (Dawson Residences, Phases 1–2)

Statement-based billing that a property opts into. Built for Dawson Residences (18 rooms, Consolacion, Cebu); any other property keeps using the existing monthly ledger and payments exactly as before.

| Document | What's in it |
|---|---|
| [requirements-matrix.md](requirements-matrix.md) | Every requirement, how it stood before this branch, evidence paths, what changed |
| [guide.md](guide.md) | Administrator guide, caretaker steps, tenant walkthrough |
| [owner-decisions-and-roadmap.md](owner-decisions-and-roadmap.md) | Rules Byron still needs to confirm, remaining work, effort, running costs |

## How it works

- **Ledger.** Every amount owed is a `Charge` (integer centavos). Waivers and reductions are `ChargeAdjustment` rows. Approved payments pay charges through `PaymentAllocation` rows. Every balance on every screen is computed from those three tables by `lib/collections/ledger.ts`, the single shared calculation.
- **Statements.** Each cycle, a draft `Statement` is prepared per occupied room and tenancy. The administrator reviews it and then issues it. Issuing posts the charges, applies any unapplied credit oldest-first, and freezes a snapshot of what the statement said. The previous balance is shown on the statement but never posted again, so it can't be counted twice.
- **Payments.** Tenants upload proof of full or partial payments. Only `APPROVED` payments reduce what's owed. Approval, rejection and reversal each run in one transaction under a per-tenant Postgres advisory lock and are idempotent.
- **Safety keys.** `Charge @@unique([tenantId, sourceKey])` plus `skipDuplicates` means rerunning generation, or two runs at once, can't create a second charge. Monthly items are keyed by month (`rc:<id>:2026-11`, `water:2026-11`), penalties by statement, and water excess by proposal.
- **Phase 2 (operations).** Household, checklists, deposits, leases, move-out, maintenance, messages and announcements live in `lib/operations/*`, screens under `/dashboard/operations/*`, `/tenant/messages`, `/tenant/maintenance/[id]` and `/caretaker/work-orders`. Deposits are their own ledger (`DepositTransaction`); applying one creates an approved `RentPayment` in the same transaction, so rent balances always come from the one ledger. Every new file type uses the same private storage and `/api/files/[id]` check, with purpose rules (IDs and inspection photos are office-only).
- **Code.** Services live in `lib/collections/*`; each takes an `Actor` and enforces its own authorization. API routes live under `app/api/collections`, `app/api/tenant/billing`, `app/api/caretaker` and `app/api/files`. Screens: `/dashboard/collections/*`, `/tenant/billing`, `/caretaker`.

## Deploying (do not merge or deploy without review)

1. **Migrations.** Two, both additive:
   - `20261115000000_add_collections_billing`: new tables, plus three nullable/defaulted `Tenant` columns.
   - `20261116000000_add_tenancy_operations`: new Phase 2 tables; new nullable/defaulted columns on `BillingProfile`, `RentPayment`, `Notice` and `MaintenanceRequest`; and `MaintenanceRequest.tenantId` becomes nullable (for common-area work orders). No existing row is changed.

   Apply them with `npx prisma migrate deploy` using `DIRECT_URL`.
   *Note:* the SQL was hand-written, because Prisma's schema engine couldn't be downloaded in the build sandbox. Both were checked column-by-column against `schema.prisma` (all 710 columns of 55 models match in type and nullability on a database built from the migrations alone) and exercised by all tests. Before deploying, run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma` on a machine with the engine; it should print nothing.
2. **Private bucket.** Create a Supabase Storage bucket named `collections-private` with **Public = off** (or set `COLLECTIONS_BUCKET` to another private bucket). The existing `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are reused. Without Supabase settings, files are stored in Postgres, which is fine for development but not intended for production.
3. **No new required environment variables.** The daily cron (`/api/cron/daily`) now also runs the collections sweep: auto-drafts if enabled, emails issued statements on their distribution date, and sends VECO reminders. It does nothing for properties without an enabled profile.
4. **Turn it on for Dawson:** Collections → *Set up billing for this property* → Setup. See [guide.md](guide.md).

## Existing data and reconciliation

- Nothing existing is altered or backfilled. `MonthlyLedger`, `Payment`, `Invoice` and the subscription `BillingRecord` keep working, and stay readable for history.
- **Going live for Dawson:**
  1. Pick the first cycle to bill.
  2. Stop entering Dawson amounts in the old monthly ledger from that cycle on.
  3. For each tenant who owes money at go-live, record **one opening balance** (Collections → tenant → *Bring in an existing balance*) equal to their reconciled debt as of that date. It's a single `OPENING_BALANCE` charge and can't be entered twice.
  4. Prepayments or credits can be entered as a payment (*Record a payment received*); they're applied automatically.
- **Legacy payment statuses, for reference:** `pending` / `submitted` ≈ PENDING; `approved` ≈ APPROVED; `rejected` ≈ REJECTED (the old flow actually reset rejections to `pending`); `waived` has no payment equivalent (use a charge waiver); `late` is a settlement state, not a verification state. Legacy rows are **not** copied into the new tables. Converting them would require deciding which charges each old payment covered, so this is done through opening balances instead.
- **Tenant subscription billing** (`BillingRecord`, ₱499 plan) is completely separate and unchanged.

## Float → centavos strategy for existing columns

New financial tables use `Int` centavos only. The existing `Float` peso columns (`Unit.rentAmount`, `Payment.amount`, `MonthlyLedger.*`, `Invoice.total`, `BillingRecord.amount`, `Plan.price`, deposits) hold whole or 2-decimal peso values, so `Math.round(x * 100)` recovers them exactly (`legacyPesosToCentavos` in `lib/collections/money.ts`). Safe migration path when it's worth doing:

1. Add `…Centavos Int?` beside each Float column.
2. Backfill with `ROUND(x * 100)` and verify `x * 100 - ROUND(x * 100)` is ~0 for every row; anything else is flagged for manual review.
3. Dual-write both columns.
4. Switch reads.
5. Drop the Float columns in a later release.

None of this is required for collections billing, which never reads the Float columns for money math.

## Tests

```bash
npm test                                          # 22 pure rule tests, no database
TEST_DATABASE_URL=postgresql://… npm run test:integration   # 52 database tests (migrations applied first)
```

The integration tests create their own fictional accounts and cover:

- two cycles per month, February and other short months, and monthly items on one cycle only
- retry and concurrent generation
- water charges for 1–4 occupants
- pending and rejected payments leaving balances unchanged, and partial payments allocated oldest-first
- repeated and concurrent approval having one effect, with no over-allocation
- the ₱5,000 − ₱2,000 = ₱3,000, then ₱8,000 carry-forward example
- credits, reversals, waivers and undo
- penalties (off by default, grace period, exemptions, once per statement, basis excluding carried balances)
- meter validation and the excess-charge approval gate
- VECO receipts not affecting collections
- account, tenant and caretaker isolation, historical tenancy separation, and legacy data left untouched
- statement/receipt PDF access, receipt email at most once, proration, capped repeating penalties
- household limit of 4 under concurrency, office-only ID files, checklist idempotency and required items
- deposit ledger: held money separate from rent, no overdraw under concurrency, undo restores both sides
- lease overlap and single renewal, tenant signed-copy upload only, move-out guards and vacancy effects
- maintenance assignment, caretaker scope and allowed moves, concurrent status changes, tenant-visible notes, legacy statuses
- private messages, announcements scoped to one property, operations summary

`scripts/seed-dawson-demo.ts` creates a fictional 18-room demo property for click-through testing; it refuses to run against a production database.
