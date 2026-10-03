import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/tokens";

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#080c14;color:#e5e7eb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px">
<div style="max-width:420px;text-align:center"><h1 style="font-size:22px;color:#fff">${title}</h1><p style="color:#9ca3af">${body}</p>
<p><a href="/" style="color:#60a5fa">Go to TenantHub</a></p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/** One-click unsubscribe from workflow (marketing) emails and SMS. Account/billing emails still arrive. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const accountId = verifySignedToken("unsubscribe", token);
  if (!accountId) return page("Link not valid", "This unsubscribe link is invalid or has expired.", 400);

  await prisma.account.updateMany({ where: { id: accountId }, data: { marketingOptOut: true } });
  return page("You're unsubscribed", "You won't receive marketing emails or texts from TenantHub anymore. Important account and billing messages will still reach you.");
}
