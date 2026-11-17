# Messenger alerts — setup

Tenants and office users can get alerts on Facebook Messenger, and tenants can reply there (the reply lands in their conversation in the app). Until the settings below are added, the feature is invisible and nothing is sent.

## What gets sent

| To | When |
|---|---|
| Tenant | The office sends or replies to a message · a statement is issued/sent · a payment is verified or not accepted · an announcement is posted |
| Office users who connected | A tenant writes (at most hourly per conversation) · a tenant sends a payment proof · a tenant reports a repair |

Each event is sent at most once per person. Tenants connect from **Messages → Get alerts on Messenger**; office users from **Operations → Inbox**. Either side can turn it off there, and tenants can send **STOP** in Messenger.

## Meta's rules (why a template is needed)

- Normal messages can only be sent within **24 hours** of the person's last message to the Page. The app uses this whenever it can.
- Outside that window, Meta only allows **utility messages** from a pre-approved template. The old `ACCOUNT_UPDATE` tag is no longer usable (Meta removed it on 27 April 2026), so the app doesn't use tags.
- Without a template, alerts outside the window are skipped (and listed as not sent in **Message History**).

## One-time setup (about 1–2 hours, plus Meta's review time)

1. **Facebook Page.** Use (or create) the Dawson Residences Page. Note its Page ID and its username (the part after facebook.com/).
2. **Meta developer app.** At developers.facebook.com create an app (type *Business*), add the **Messenger** product, and connect the Page. Generate a **Page access token**. Copy the **App secret** (App settings → Basic).
3. **Webhook.** In Messenger → Webhooks set:
   - Callback URL: `https://<your-domain>/api/messenger/webhook`
   - Verify token: any long random text (the same value goes in `MESSENGER_VERIFY_TOKEN`)
   - Subscribe the Page to: `messages`, `messaging_postbacks`, `messaging_referrals`, `message_template_status_update`.
4. **Get Started button.** Enable it for the Page (Messenger profile) so the connect link works for first-time users.
5. **Permissions / App Review.** The app needs `pages_messaging` and, for templates, `page_utility_messaging`. While the app is in development mode only people with a role on the app can receive messages; to message tenants, submit the app for **App Review** with a short screencast of a tenant connecting from the portal. *(Review requirements and timing are set by Meta and weren't verified here.)*
6. **Utility templates (recommended).** Create two templates on the Page (category `UTILITY`, language `en`), each with three body parameters — the person's name, the update, and the link. Example text:
   - `tenant_account_update`: "Hi {{1}}, there's an update on your rental account: {{2}} See the details here: {{3}} Thank you."
   - `office_update`: "Hi {{1}}, {{2}} Open the dashboard: {{3}} Thank you."
   Meta rejects templates that start or end with a parameter, so keep words before and after.
7. **Environment variables** (Vercel → Settings → Environment Variables), then redeploy:

| Variable | Value |
|---|---|
| `MESSENGER_PAGE_ID` | Page ID |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Page access token (secret) |
| `MESSENGER_APP_SECRET` | App secret (secret; used to verify every webhook call) |
| `MESSENGER_VERIFY_TOKEN` | The verify token from step 3 |
| `MESSENGER_PAGE_USERNAME` | Page username for m.me links (optional; falls back to the Page ID) |
| `MESSENGER_TEMPLATE_TENANT` | e.g. `tenant_account_update` (optional) |
| `MESSENGER_TEMPLATE_OFFICE` | e.g. `office_update` (optional) |
| `MESSENGER_TEMPLATE_LANGUAGE` | `en` (default) |
| `MESSENGER_GRAPH_VERSION` | `v25.0` (default) |

8. **Test.** Sign in as a tenant → Messages → **Open Messenger** → press Get Started. The tenant should get "You're connected". Reply from the office in the Inbox; the tenant should get the alert.

## Security and privacy

- Connect links carry a signed, 7-day token; tampered or expired links are refused, and moved-out tenants or caretakers can't connect.
- Every webhook call is checked against the app secret (`X-Hub-Signature-256`); unsigned calls are rejected.
- Alerts carry a short summary and a link; balances and statements still require signing in. Messages from the office are quoted in the alert (first 300 characters).
- Messenger is Meta's service; tenants choose to connect it.

## Costs

The app itself adds no cost. Meta's pricing for Messenger utility messages wasn't verified here; check Meta's current Messenger pricing before relying on templates at volume. Messages inside the 24-hour window are normally not charged.

## Not verified here

- No real Facebook Page or Meta app was available, so sending to Meta's Graph API and Meta's webhook delivery were tested against a stand-in, not live.
- App Review requirements and template approval behaviour are Meta's and may change.

Sources: [Meta — Send a message (window, tags)](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages), [Meta — Utility messages](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/utility-messages), [Meta — m.me links and ref](https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/m-me-links), [Message tags deprecation summary](https://singhamandeep.com/message-tags-deprecated/)
