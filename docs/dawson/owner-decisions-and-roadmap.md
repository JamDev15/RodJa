# Decisions for Byron, remaining work, effort and costs

## Business rules to confirm
Everything below is already a setting or has a safe default; nothing questionable is switched on.

1. **Rent amount meaning.** For each room, is the rent figure charged *each* cycle (15th and 30th), or is it the *monthly* rent split across both? The app requires this choice per room.
2. **Statement timing.** How many days before the 15th/30th should statements be prepared and sent? When is payment due: on the 15th/30th, or N days after? Defaults are prepared and emailed 3 days before, due on the cycle date.
3. **Short months.** In February the 30th becomes the 28th/29th (the last day of the month). Alternatively it could move to March 1st.
4. **Once-a-month items.** Do water and internet go on the 15th statement or the 30th? The default is the 15th.
5. **Billing period wording.** Each statement covers the cycle date up to the day before the next cycle (billed in advance). Confirm that's how Dawson describes it.
6. **Partial cycles.** If someone moves in or out mid-cycle, is rent prorated? Setup now has a switch: *Bill the full cycle* (default) or *Prorate rent by days occupied*. Monthly items (water, internet, parking) are never prorated. Confirm which, and whether rounding to the centavo is acceptable.
7. **Late penalties** (off until all of these are confirmed):
   - percentage
   - grace period (days after the due date)
   - what it's charged on (the default is unpaid charges from that statement only, not carried balances or earlier penalties)
   - whether it repeats: Setup offers *once per statement* (default) or *again each later cycle while unpaid*, up to a maximum count you set. Repeats are always on the original statement's unpaid charges, never on earlier penalties
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
14. **Move-out procedure (SOP).** The move-out checklist is a generic placeholder. Provide Dawson's steps so the template (and which steps are required before approving a vacancy) can match.
15. **Deposit rules.** How much security deposit and advance rent each room takes, when advance rent is applied (first month? last month?), how long after move-out the refund is paid, and what can be deducted.
16. **Vacancy approval.** Who may approve a vacancy, and whether a tenant may leave with a balance still owed (the app allows it only with a recorded reason).
17. **Occupant IDs.** Which IDs are required for each occupant, and how long ID copies are kept after someone leaves (they're kept until deleted; no automatic deletion is built).
18. **Maintenance.** Which categories and urgency levels Dawson uses, and whether tenants should see caretaker notes (currently they don't unless the office repeats them).
19. **Messages.** Expected reply time, and whether the owner wants the hourly email notice or none.

## Remaining work and rough effort
Assumptions: one developer familiar with this codebase; estimates include tests; owner decisions are available; no paid integrations.

**Done on this branch:** Phase 1, the Phase 1 follow-ups (statement and receipt PDFs, receipt email, proration and repeating-penalty settings) and Phase 2 (household, IDs, move-in checklist, deposits and advance rent, lease terms/renewals/uploads, move-out, maintenance and work orders, messages, announcements, operations overview).

| Item | Est. hours |
|---|---|
| **Still to do for Phase 1 / 2** | |
| Production checks: `prisma migrate diff`, private bucket, a real-device run-through with the owner | 3–4 |
| Fit the move-out checklist and vacancy rules to Dawson's SOP once provided | 2–4 |
| Deposit amounts/rules as room settings once decided (decision 15) | 4–6 |
| Push notifications for new messages / work orders (the app already has web push for owners) | 4–6 |
| Automatic deletion of ID copies after a retention period (if wanted) | 3–4 |
| **Phase 3** | |
| Expenses with receipt attachments | 10–14 |
| Master water and common-area electricity records | 8–12 |
| Petty cash | 8–10 |
| Reports (income, collections, receivables, utilities, expenses, cash flow, occupancy, deposits held) with CSV export | 20–30 |

Rough totals: remaining Phase 1/2 items **16–24 h**, Phase 3 **46–66 h**.

## Hosting, storage, email and recurring costs
Collections billing adds **no new paid service**. It uses the existing Supabase database and storage, Resend email, and the daily Vercel cron.

- **Storage.** Phase 2 adds IDs, lease files and maintenance/inspection photos — a few hundred MB a year at most for 18 rooms. About 18 rooms × (2 payment proofs + 1 VECO receipt) per month at roughly 0.5 MB each is about 30 MB a month, or roughly 0.35 GB a year. That fits the Supabase Free plan's 1 GB file storage for a couple of years; Pro ($25/month) includes 100 GB. The Free plan pauses projects after a week of inactivity, which a production app shouldn't rely on. *(Third-party summary of Supabase pricing; confirm on supabase.com/pricing.)*
- **Email.** About 18 tenants × 2 statements, plus reminders, is under 100 emails a month. Resend's free plan allows 3,000/month (100/day); Pro is $20/month for 50,000. *(From resend.com/pricing.)*
- **Cron.** The existing once-a-day job is enough. Vercel Hobby allows daily cron jobs with ±59-minute timing; Pro allows per-minute. *(From Vercel docs.)* Vercel's Hobby plan terms restrict commercial use; check which plan the app runs on. *(Not verified here.)*
- **SMS** for tenants without email is **not** built and would be a paid add-on (Semaphore or similar). Pricing not verified.

Sources: [Resend pricing](https://resend.com/pricing), [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase pricing summary (Jetadmin, 2026)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)

## Known limitations of this release
- Penalties are assessed when drafts are prepared, not daily.
- The SQL migrations were hand-written (see README) and should be diffed with Prisma's engine before deploying.
- Advisory locks are used through the Supabase transaction pooler; they're transaction-scoped and expected to work there, but haven't been exercised against the production pooler.
- `STAFF` users keep their existing full access; only the new `CARETAKER` role is restricted.
- PDFs use the standard PDF font, so the peso sign prints as "PHP". A WEBP logo isn't embedded in the PDF (PNG/JPG are).
- Emails (receipts, message notices, announcements, lease-expiry notices) are best effort through Resend; a failed receipt email can be retried by re-sending, but there is no "resend" button yet.
- Lease renewals record the new rent for reference only; the billed rent still comes from the room's recurring charges.
- Tenant-facing Phase 2 features (messages, household, signed-lease upload) only appear for properties with statement billing turned on; other properties' tenant portals are unchanged.
- Maintenance photos are readable by every caretaker assigned to that property (not only the assignee).
- No automatic deletion of ID copies.
