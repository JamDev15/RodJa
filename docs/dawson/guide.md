# Collections — administrator guide and tenant walkthrough

## Administrator (owner or staff)

### One-time setup
1. **Dashboard → Collections.** Choose Dawson Residences, then **Set up billing for this property**.
2. **Setup → Billing schedule and rules.**
   - Billing cycle days: `15, 30`. When the 30th doesn't exist (February), the last day of the month is used.
   - Choose how many days before each cycle drafts are prepared, when statements are emailed, and when payment is due.
   - Choose which cycle carries once-a-month items (water, internet).
   - Water: ₱350 for one occupant, plus ₱200 for each additional occupant (up to 4).
   - Leave **late penalties**, **meter allowance** and **excess rate** blank until the owner confirms them (see the decisions list). While blank, nothing is charged.
   - Turn on VECO tracking and enter the payment instructions to print on statements.
   - Tick **Statement billing is on**.
3. **Statement logo.** Upload the property logo.
4. **Rooms.** For each room:
   - **Add rent.** Enter the amount and choose **charged every cycle** or **monthly total, split across both cycles**. You must choose; the app never assumes.
   - **Add internet / parking / other** as needed.
   - **Meter, VECO & water override.** Enter the water meter ID and VECO account number. A water override needs a reason.
5. **Tenants.** On each tenant's collections page (Collections → Accounts → tenant name), set **Occupants (1–4)**. Without it, no water is charged. Add a penalty exemption (with a reason) if one is agreed.
6. **Opening balances.** For anyone who already owes money, use **Bring in an existing balance** once.
7. **Caretakers.** Setup → Caretakers → **Add caretaker**. They sign in at the normal login page.

### Every cycle
1. **Statements.** The page opens on the next cycle to issue. Click **Prepare drafts**; this is safe to click again, as it only adds what's missing.
2. Open any draft to check it. You can **Add a charge** (miscellaneous needs a description), remove a line, or discard the draft.
3. Click **Issue all drafts** (or **Issue statement** on one). Issued statements appear in the tenant portal immediately. They're emailed on the distribution date, or right away with **Email to tenant now**. Tenants without an email see them only in the portal.

### Statement and receipt PDFs
- Issued statements have **Download PDF** (office and tenant). Statement emails attach the PDF.
- Approved payments have **Receipt PDF**. When a payment is approved (or recorded), the receipt is emailed to the tenant once, if they have an email and **Settings → send receipts automatically** is on.

### Payments
- **Overview → Payments waiting for review.** Open the proof, then:
  - **Approve**, or
  - **Approve a different amount** if the screenshot shows something else (recorded), or
  - **Reject** with a reason the tenant will see.
- Approved money is applied to the oldest unpaid charges first; anything extra becomes credit and is used by the next statement automatically.
- **Cash or direct payments:** tenant page → **Record a payment received**.
- **Mistakes:** an approved payment can be **reversed** with a reason (it stays in history). An issued charge can be **waived** or **reduced** with a reason, and an adjustment can be undone. Nothing is ever deleted.

### Water and VECO
- **Water meters:** see readings and usage, approve or reject proposed excess charges (approved ones go on the next draft), and void a mistaken latest reading.
- **VECO receipts:** verify or reject uploads, and see who is missing which month. Tenants with an email get one reminder per missing month; everyone sees a banner in their portal. VECO amounts never count as rent or income.

### Reading the overview
- **Charges issued** is what was billed for the selected month or cycle (excluding carried balances).
- **Payments received** is approved payments by the date paid.
- **Outstanding** and **Overdue** are as of today.
- These numbers measure different things, so they aren't expected to add up to each other.

## Operations (Dashboard → Operations)

### Overview
Occupancy and vacant rooms, open and urgent maintenance, leases ending in the next 60 days, move-outs in progress, upcoming move-ins, unfinished move-in checklists and unread messages.

### Checklists (once)
**Operations → Checklists.** Edit the move-in and move-out lists: one item per line, start a line with `*` to make it required. New checklists copy the current list; existing ones keep theirs. The move-out list is a generic starting point until Dawson's move-out procedure is written down.

### Each tenancy (Operations → Tenancies → name)
1. **Household.** Add everyone living in the room, including the tenant (tick *tenant of record*), up to 4. Upload each person's ID and photo — only the office can open them. When someone leaves, use **Moved out** (the record stays). If the number of people differs from the occupant count used for water, a warning links to the billing page; the water charge only changes when you change that count.
2. **Move-in checklist.** Start it, tick items as they happen (add a note or photo when useful), then **Mark checklist complete** — possible only when every required item is done.
3. **Lease.** **Record lease dates** (and the rent in the lease, for reference). **Renew** creates the next term from the day after the current one ends. Upload the owner's lease PDF; after it's printed and signed, upload the signed copy (or the tenant uploads it). Renewing doesn't change the bill — update the room's rent in Collections if the rent changes.
4. **Security deposit and advance rent.** **Record money received** for each fund. This money doesn't reduce the rent balance. **Apply to unpaid charges** uses it like a payment (oldest charges first) — e.g. advance rent for the first month, or damages at move-out. **Refund or keep** records money paid back or kept by the owner, with a reason. Every entry can be **Undone** with a reason; nothing is deleted.
5. **Move-out.** **Start move-out** with the planned date. On the move-out page:
   1. work through the move-out checklist;
   2. record the inspection notes and photos;
   3. record the final water meter reading;
   4. **Charge for damages** (posted to the tenant's balance);
   5. settle the deposit (apply → refund the rest) on the tenancy page;
   6. **Approve vacancy** — available only when the checklist, deposit and final reading are done. If the tenant still owes money you must record why. Approving ends the tenancy and marks the room vacant.

### Maintenance
- Tenant requests arrive as **Submitted**. **Assign** them to the property's caretaker (or a staff member); status becomes **Assigned**.
- **Update** to change status (In progress, Waiting, Completed, Closed), urgency, or add a note. Untick *Show this update to the tenant* for internal notes. Caretaker notes are internal unless you repeat them.
- **Log a request / work order** for a room or a common area.
- Requests from before this update show their old status with the new names (open → Submitted, resolved → Completed).

### Inbox
The **Operations** menu item shows how many tenant messages are unread. **Get alerts on Messenger** (top of the Inbox, once set up — see messenger-setup.md) sends you a Messenger message when a tenant writes, sends a payment or reports a repair. Replies a tenant sends from Messenger appear here marked *(via Messenger)*.

Private conversations with tenants (caretakers can't see them). Start one with **New message to a tenant**, reply with optional photo/PDF, **Close** when done (a reply reopens it). Tenants with an email get a notice when you reply; you get at most one email an hour per conversation when a tenant writes.

### Announcements
Post to every current tenant of the property; optionally email those with an address. Remove an announcement if posted by mistake.

## Money and reports (Operations → Expenses, Petty cash, Utilities, Reports)

### Expenses
**Record an expense**: category, what it was for, amount, date, who was paid, how, the OR/reference number, the room if it's for one room, and a photo/PDF of the receipt (kept private to the office). Leave *Paid with* as *Not paid yet* for bills you'll pay later, then use **Mark paid**. Mistakes are **Voided** with a reason; voided entries stay visible with *Show voided*.

### Petty cash
- **Top up** when cash is put in the box (this isn't an expense).
- **Spend** for each purchase, with the receipt photo — it's automatically listed under Expenses as paid from petty cash. Spending more than the box holds is refused.
- **Record a cash count** now and then: enter what you actually counted; any difference is saved as a shortage or overage with your explanation.
- **Undo** reverses an entry with a reason (undoing spending also voids its expense).

### Utilities
- **Record a bill** for the building's master water bill or the common-area electricity bill each month (one per month and type), with the scan. **Correct** fixes an unpaid bill; **Mark paid** records it as an expense. To undo a payment, void its expense on the Expenses page; the bill becomes unpaid again.
- **Building meter readings**: the main water meter and any common-area electric meter. Caretakers can also enter these from their phone.

### Reports
Pick a report and a month range (up to 24 months), then **Show** or **Download CSV** (opens in Excel or Google Sheets). Each report explains under the table exactly what it counts. In short:
- **Income**: verified payments by the date paid, split into rent, water, internet, parking, penalties, damages and credit.
- **Collections**: what was billed each month and how much of it has been paid so far.
- **Receivables aging**: who owes what today, by how late.
- **Utilities**: water billed to tenants and collected, against the master water bill; common-area electricity; VECO receipts received.
- **Expenses** by category, **Cash flow** (money in and out by month), **Occupancy** (room-days, move-ins/outs) and **Deposits held**.

## Caretaker
1. Sign in at the normal login page; you land on **Water meter readings**.
2. For each room, enter the reading and date, then **Save**. The first reading sets the starting point.
3. If the meter was **replaced or reset**, tick that box so the lower number is accepted as a new starting point.
4. Readings must be entered in date order. If one was wrong, ask the office to void it.
5. You won't see payments, balances or tenant finances.

**Building meters** (bottom of the readings page): enter the main water meter (or common-area electric meter) reading and date. One reading per meter per day; the office can void a wrong one.

**Work orders** (top menu): requests the office assigned to you. Open one, then **Update** to start (*In progress*), pause (*Waiting*, e.g. for parts) or finish (*Completed*), with a note. **Add a photo** of the work. Only the office can close a request. You see the room number, not the tenant's name or phone.

## Tenant walkthrough
1. Sign in at **/tenant/login** with your phone number and PIN.
2. **Home** shows your balance. Tap it, or **Bills** in the bottom bar.
3. **Bills** shows:
   - **Balance due**. Only payments the office has verified reduce it.
   - **Statements**: tap one to see every charge, the previous balance, any penalty, the total, the due date, and how to pay. You can print it.
4. **Send a payment:**
   1. Enter the amount; part of the balance is fine.
   2. Enter the date, method and reference number.
   3. Attach the screenshot or photo, then **Submit payment**.
   4. It shows **Pending review** until the office checks it, then **Approved** with what it was applied to, or **Not accepted** with the reason.
5. **VECO receipts:** pick the electricity bill month, attach a photo of the receipt, and upload. This doesn't change your rent balance.
6. **Statements and receipts as PDF:** open a statement → **Download PDF**; approved payments show **Download receipt**.
7. **Messages:** the **Messages** tab (a red number shows unread replies) → **Message the office**. Use Repairs for repairs and Bills for payments.
   - **Get alerts on Messenger** (if the office set it up): tap **Open Messenger**, then *Get Started*. You'll get a Messenger message when the office replies, a statement is ready, or a payment is checked, and you can reply in Messenger — it goes to the same conversation. Send **STOP** or tap **Turn off** to stop.
8. **Repairs:** tap **New**, describe the problem, then open **Updates, photos and notes** to add photos or notes and follow progress (Submitted → Assigned → In progress → Completed).
9. **Lease:** Documents → **Lease files** shows the lease from the office. Print it, sign it, then **Upload your signed lease**.
10. **Household:** Home shows the names the office recorded for your room.
