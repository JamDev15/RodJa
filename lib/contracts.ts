import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Account, Contract, Property, Tenant, Unit } from "@prisma/client";
import { buildContractPdf, type ContractPdfInput } from "@/lib/pdf";
import { APP_URL, sendContractForSignature, sendSignedContract } from "@/lib/email";
import { logMessage } from "@/lib/message-log";
import { sendPushToAccount } from "@/lib/push";

export type ContractFull = Contract & {
  account: Account;
  tenant: Tenant & { unit: Unit & { property: Property } };
};

export const contractInclude = {
  account: true,
  tenant: { include: { unit: { include: { property: true } } } },
} as const;

export function newSignToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function contractHash(title: string, body: string): string {
  return crypto.createHash("sha256").update(`${title}\n\n${body}`, "utf8").digest("hex");
}

export function signUrl(token: string): string {
  return `${APP_URL}/sign/${token}`;
}

export function toPdfInput(c: ContractFull): ContractPdfInput {
  return {
    id: c.id,
    title: c.title,
    body: c.body,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    monthlyRent: c.monthlyRent,
    deposit: c.deposit,
    documentHash: c.documentHash,
    ownerSignature: c.ownerSignature,
    ownerSignedName: c.ownerSignedName,
    ownerSignedAt: c.ownerSignedAt,
    ownerSignedIp: c.ownerSignedIp,
    tenantSignature: c.tenantSignature,
    tenantSignedName: c.tenantSignedName,
    tenantSignedAt: c.tenantSignedAt,
    tenantSignedIp: c.tenantSignedIp,
    sentAt: c.sentAt,
    viewedAt: c.viewedAt,
    ownerName: c.account.ownerName,
    businessName: c.account.name,
    ownerEmail: c.account.email,
    tenantName: c.tenant.name,
    tenantEmail: c.tenant.email,
    tenantPhone: c.tenant.phone,
    propertyName: c.tenant.unit.property.name,
    propertyAddress: c.tenant.unit.property.address,
    unitNumber: c.tenant.unit.unitNumber,
  };
}

export async function contractPdf(c: ContractFull): Promise<Buffer> {
  return buildContractPdf(toPdfInput(c));
}

export function pdfFilename(c: Pick<Contract, "title" | "status">): string {
  const base = c.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "contract";
  return `${base}${c.status === "signed" ? "-signed" : ""}.pdf`;
}

/** Emails the tenant their signing link and drops a notice in their portal. */
export async function deliverForSignature(c: ContractFull): Promise<{ emailed: boolean }> {
  const log = {
    accountId: c.accountId,
    tenantId: c.tenantId,
    recipientType: "tenant" as const,
    recipientName: c.tenant.name,
    category: "contract" as const,
  };
  let emailed = false;
  if (c.tenant.email) {
    emailed = await sendContractForSignature({
      to: c.tenant.email,
      tenantName: c.tenant.name,
      ownerName: c.account.ownerName,
      title: c.title,
      signUrl: signUrl(c.signToken),
      log,
    });
  }
  await prisma.notice.create({
    data: {
      tenantId: c.tenantId,
      accountId: c.accountId,
      title: `Please sign: ${c.title}`,
      content: `${c.account.ownerName} sent you a contract to review and sign. Open Documents in your portal to sign it.`,
      type: "contract",
    },
  });
  await logMessage({ ...log, channel: "in_app", to: "Tenant portal", subject: `Please sign: ${c.title}`, body: "Contract sent for signature (see Documents).", status: "sent" });
  return { emailed };
}

/** After the tenant signs: both parties get the signed PDF; owner also gets a push. */
export async function deliverSignedCopies(c: ContractFull): Promise<void> {
  const pdf = await contractPdf(c);
  await sendSignedContract({
    to: c.account.email,
    name: c.account.ownerName,
    title: c.title,
    otherParty: c.tenant.name,
    pdf,
    log: { accountId: c.accountId, tenantId: c.tenantId, recipientType: "owner", recipientName: c.account.ownerName, category: "contract" },
  });
  if (c.tenant.email) {
    await sendSignedContract({
      to: c.tenant.email,
      name: c.tenant.name,
      title: c.title,
      otherParty: c.account.ownerName,
      pdf,
      log: { accountId: c.accountId, tenantId: c.tenantId, recipientType: "tenant", recipientName: c.tenant.name, category: "contract" },
    });
  }
  await sendPushToAccount(
    c.accountId,
    { title: "Contract signed ✍️", body: `${c.tenant.name} signed "${c.title}"`, url: `/dashboard/contracts/${c.id}` },
    { accountId: c.accountId, tenantId: c.tenantId, recipientType: "owner", recipientName: c.account.ownerName, category: "contract" }
  );
}
