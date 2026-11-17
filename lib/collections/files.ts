// Private storage for billing evidence (payment proofs, VECO receipts).
//
// Files are never exposed by a public URL. With Supabase configured they go
// to a PRIVATE bucket and are fetched server-side with the service key; with
// no Supabase (local development, tests) the bytes are kept in Postgres.
// Either way the only way to read one is /api/files/[id], which checks who
// is asking first (canReadFile).

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Actor } from "./actor";
import { invalid } from "./errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.COLLECTIONS_BUCKET ?? "collections-private";

type Kind = { mime: string; ext: string };

/** Identify the file by its content, not by the browser-supplied type or name. */
export function sniffFileType(bytes: Uint8Array): Kind | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return { mime: "image/png", ext: "png" };
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export type FilePurpose =
  | "PAYMENT_PROOF"
  | "VECO_RECEIPT"
  | "PROPERTY_LOGO"
  | "OCCUPANT_ID"
  | "OCCUPANT_PHOTO"
  | "LEASE_DOCUMENT"
  | "MOVEOUT_PHOTO"
  | "MAINTENANCE_PHOTO"
  | "MESSAGE_ATTACHMENT"
  | "CHECKLIST_PHOTO";

/** Purposes a tenant may read when the file belongs to their tenancy. IDs, inspection and checklist photos are office-only. */
const TENANT_READABLE = new Set(["PAYMENT_PROOF", "VECO_RECEIPT", "LEASE_DOCUMENT", "MAINTENANCE_PHOTO", "MESSAGE_ATTACHMENT"]);

export interface StoreFileInput {
  actor: Actor;
  accountId: string;
  propertyId: string | null;
  tenantId: string | null;
  purpose: FilePurpose;
  file: File;
}

export async function readUpload(file: File | null | undefined): Promise<{ bytes: Buffer; kind: Kind; sha256: string; name: string }> {
  if (!file || typeof file === "string" || file.size === 0) throw invalid("Please attach a file");
  if (file.size > MAX_UPLOAD_BYTES) throw invalid("File is too large (max 5 MB)");
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) throw invalid("Unsupported file type — upload a JPG, PNG, WEBP or PDF");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const name = (file.name || `upload.${kind.ext}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return { bytes, kind, sha256, name };
}

export async function storeFile(input: StoreFileInput, upload?: Awaited<ReturnType<typeof readUpload>>) {
  const u = upload ?? (await readUpload(input.file));
  const id = crypto.randomUUID();
  let storage: "SUPABASE_PRIVATE" | "DATABASE" = "DATABASE";
  let objectPath: string | null = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    objectPath = `${input.accountId}/${input.purpose.toLowerCase()}/${id}.${u.kind.ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": u.kind.mime, "x-upsert": "false" },
      body: new Uint8Array(u.bytes),
    });
    if (!res.ok) {
      console.error("Private upload failed:", res.status, await res.text().catch(() => ""));
      throw new Error("Could not store the file. Please try again.");
    }
    storage = "SUPABASE_PRIVATE";
  }

  return prisma.storedFile.create({
    data: {
      id,
      accountId: input.accountId,
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      purpose: input.purpose,
      fileName: u.name,
      mimeType: u.kind.mime,
      sizeBytes: u.bytes.length,
      sha256: u.sha256,
      storage,
      objectPath,
      data: storage === "DATABASE" ? new Uint8Array(u.bytes) : null,
      uploadedBy: input.actor.id,
      uploadedByRole: input.actor.role,
    },
    select: { id: true, sha256: true, mimeType: true, sizeBytes: true, fileName: true },
  });
}

/**
 * Admins of the owning account read everything in it. A tenant reads files
 * of their own tenancy whose purpose is tenant-readable (never ID documents
 * or inspection photos), plus their account's property logo. Caretakers
 * read nothing here; see canReadFileAsync for maintenance photos.
 */
export function canReadFile(actor: Actor | null, file: { accountId: string; tenantId: string | null; purpose?: string }): boolean {
  if (!actor) return false;
  if (actor.kind === "ADMIN") return file.accountId === actor.accountId;
  if (actor.kind === "TENANT") {
    if (file.accountId !== actor.accountId) return false;
    if (file.purpose === "PROPERTY_LOGO") return true;
    if (file.purpose && !TENANT_READABLE.has(file.purpose)) return false;
    return file.tenantId === actor.tenantId;
  }
  return false;
}

/** canReadFile, plus caretakers: maintenance photos of properties assigned to them. */
export async function canReadFileAsync(actor: Actor | null, file: { accountId: string; tenantId: string | null; purpose?: string; propertyId?: string | null }): Promise<boolean> {
  if (canReadFile(actor, file)) return true;
  if (actor?.kind !== "CARETAKER" || file.accountId !== actor.accountId) return false;
  if (file.purpose !== "MAINTENANCE_PHOTO" || !file.propertyId) return false;
  const assigned = await prisma.caretakerProperty.findFirst({ where: { userId: actor.id, propertyId: file.propertyId }, select: { id: true } });
  return !!assigned;
}

export async function readFileBytes(file: { storage: string; objectPath: string | null; data: Uint8Array | null }): Promise<Uint8Array | null> {
  if (file.storage === "DATABASE") return file.data ? new Uint8Array(file.data) : null;
  if (!SUPABASE_URL || !SUPABASE_KEY || !file.objectPath) return null;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file.objectPath}`, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}
