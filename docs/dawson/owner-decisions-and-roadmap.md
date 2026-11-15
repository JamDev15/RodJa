# Decisions for Byron, remaining work, effort and costs

## Business rules to confirm
Everything below is already a setting or has a safe default; nothing questionable is switched on.

1. **Rent amount meaning.** For each room, is the rent figure charged *each* cycle (15th and 30th), or is it the *monthly* rent split across both? The app requires this choice per room.
2. **Statement timing.** How many days before the 15th/30th should statements be prepared and sent? When is payment due: on the 15th/30th, or N days after? Defaults are prepared and emailed 3 days before, due on the cycle date.
3. **Short months.** In February the 30th becomes the 28th/29th (the last day of the month). Alternatively it could move to March 1st.
4. **Once-a-month items.** Do water and internet go on the 15th statement or the 30th? The default is the 15th.
5. **Billing period wording.** Each statement covers the cycle date up to the day before the next cycle (billed in advance). Confirm that's how Dawson describes it.
6. **Partial cycles.** If someone moves in or out mid-cycle, is rent prorated? Currently the full cycle is billed if the tenancy overlaps it.
7. **Late penalties** (off until all of these are confirmed):
   - percentage
   - grace period (days after the due date)
   - what it's charged on (the default is unpaid charges from that statement only, not carried balances or earlier penalties)
   - whether it repeats; currently once per statement, and repeating is not supported until confirmed
   - Penalties are assessed when the next statement is prepared, on whatever is still unpaid then.
8. **Water meter.**
   - How often readings are taken.
   - What usage allowance the ₱350/₱550/… charge includes, and whether the allowance scales with occupants.
   - The excess rate per unit.
   - Excess is always approved by an administrator before billing.
9. **Water override.** Who may approve overrides, and any standard reasons.
10. **VECO.** By what day of the following month a receipt counts as missing (default: the 10th), and whether tenants without email should get SMS (paid; not built).
11. **Payment proof.** Whether cash payments need proof (currently optional for cash, required for GCash/Maya/bank).
12. **Overpayments.** These are kept as credit and used by the next statement. Confirm, or set a refund rule.
13. **Statement and receipt number format.** Defaults are `SOA-YYYYMM-00001` and `PR-000001`.

## Remaining work and rough effort
Assumptions: one developer familiar with this codebase; estimates include tests; owner decisions are available; no paid integrations.

| Item | Est. hours |
|---|---|
| **Phase 1 follow-ups** | |
| Email receipt on approval for collections payments (reuse existing PDF/email code) | 4–6 |
| Downloadable statement PDF (currently a printable page) | 6–8 |
| Proration if confirmed (decision 6) | 4–8 |
| Repeating penalties if confirmed | 3–5 |
| Production checks: `prisma migrate diff`, private bucket, a real-device run-through with the owner | 3–4 |
| **Phase 2** | |
| Occupant records (names, max 4, restricted ID photos via private files) | 12–16 |
| Move-in checklist (template + per-tenancy) | 8–12 |
| Advance rent / security deposit ledger separate from rent | 10–14 |
| Owner lease upload, signed-copy upload, print-sign-upload | 6–10 |
| Lease renewals | 6–8 |
| Move-out workflow (after the SOP is provided): checklist, inspection, final reading, damages, deposit reconciliation, vacancy approval | 20–30 |
| Maintenance: new statuses, assignment, urgency, photos, history | 14–20 |
| Caretaker work orders with notes and photos | 10–14 |
| Private tenant ↔ admin messages | 12–16 |
| Announcements form | 3–4 |
| Dashboard summaries (occupancy, lease expiry, maintenance, move-in/out) | 6–8 |
| **Phase 3** | |
| Expenses with receipt attachments | 10–14 |
| Master water and common-area electricity records | 8–12 |
| Petty cash | 8–10 |
| Reports (income, collections, receivables, utilities, expenses, cash flow, occupancy) with CSV export | 20–30 |

Rough totals: Phase 1 follow-ups **20–30 h**, Phase 2 **110–150 h**, Phase 3 **45–65 h**.

## Hosting, storage, email and recurring costs
Collections billing adds **no new paid service**. It uses the existing Supabase database and storage, Resend email, and the daily Vercel cron.

- **Storage.** About 18 rooms × (2 payment proofs + 1 VECO receipt) per month at roughly 0.5 MB each is about 30 MB a month, or roughly 0.35 GB a year. That fits the Supabase Free plan's 1 GB file storage for a couple of years; Pro ($25/month) includes 100 GB. The Free plan pauses projects after a week of inactivity, which a production app shouldn't rely on. *(Third-party summary of Supabase pricing; confirm on supabase.com/pricing.)*
- **Email.** About 18 tenants × 2 statements, plus reminders, is under 100 emails a month. Resend's free plan allows 3,000/month (100/day); Pro is $20/month for 50,000. *(From resend.com/pricing.)*
- **Cron.** The existing once-a-day job is enough. Vercel Hobby allows daily cron jobs with ±59-minute timing; Pro allows per-minute. *(From Vercel docs.)* Vercel's Hobby plan terms restrict commercial use; check which plan the app runs on. *(Not verified here.)*
- **SMS** for tenants without email is **not** built and would be a paid add-on (Semaphore or similar). Pricing not verified.

Sources: [Resend pricing](https://resend.com/pricing), [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase pricing summary (Jetadmin, 2026)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)

## Known limitations of this release
- Statements are a printable web page plus an email summary with a portal link; there's no PDF attachment yet.
- Approved collections payments get a receipt number shown in the portal, but no automatic receipt email yet. The old flow's receipt emails are unchanged.
- Penalties are assessed when drafts are prepared, not daily.
- The SQL migration was hand-written (see README) and should be diffed with Prisma's engine before deploying.
- Advisory locks are used through the Supabase transaction pooler; they're transaction-scoped and expected to work there, but haven't been exercised against the production pooler.
- `STAFF` users keep their existing full access; only the new `CARETAKER` role is restricted.
