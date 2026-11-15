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

## Caretaker
1. Sign in at the normal login page; you land on **Water meter readings**.
2. For each room, enter the reading and date, then **Save**. The first reading sets the starting point.
3. If the meter was **replaced or reset**, tick that box so the lower number is accepted as a new starting point.
4. Readings must be entered in date order. If one was wrong, ask the office to void it.
5. You won't see payments, balances or tenant finances.

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
