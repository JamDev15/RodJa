import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";

// A4 in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const BRAND = rgb(0.15, 0.39, 0.92);
const LINE = rgb(0.88, 0.9, 0.93);

/** Standard PDF fonts only cover WinAnsi; swap anything else for a safe stand-in. */
function makeSanitizer(font: PDFFont) {
  const cache = new Map<string, string>();
  return (text: string): string => {
    let out = "";
    for (const ch of text.replace(/₱/g, "PHP ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\t/g, "    ")) {
      if (ch === "\n") { out += ch; continue; }
      let mapped = cache.get(ch);
      if (mapped === undefined) {
        try {
          font.encodeText(ch);
          mapped = ch;
        } catch {
          mapped = "?";
        }
        cache.set(ch, mapped);
      }
      out += mapped;
    }
    return out;
  };
}

export function pesoText(n: number): string {
  return `PHP ${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function pdfDate(d: Date, withTime = false): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: withTime ? "Asia/Manila" : "UTC",
  }).format(d) + (withTime ? " (PHT)" : "");
}

/** Minimal flowing-layout writer: tracks the cursor and adds pages as needed. */
class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  safe: (t: string) => string;

  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont, private footer: string) {
    this.safe = makeSanitizer(font);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNo++;
    this.y = PAGE_H - MARGIN;
    this.page.drawText(this.safe(this.footer), { x: MARGIN, y: 28, size: 8, font: this.font, color: MUTED });
    this.page.drawText(`Page ${this.pageNo}`, { x: PAGE_W - MARGIN - 30, y: 28, size: 8, font: this.font, color: MUTED });
  }

  ensure(h: number) {
    if (this.y - h < MARGIN + 10) this.newPage();
  }

  wrap(text: string, size: number, font: PDFFont, width = CONTENT_W): string[] {
    const lines: string[] = [];
    for (const para of this.safe(text).split("\n")) {
      if (para.trim() === "") { lines.push(""); continue; }
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        const candidate = line + word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line.trim()) lines.push(line.trimEnd());
        // Hard-break single words longer than the line.
        let w = word.trimStart();
        while (font.widthOfTextAtSize(w, size) > width) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
          lines.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number; x?: number; width?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.font;
    const lh = size * 1.45;
    for (const line of this.wrap(text, size, font, opts.width)) {
      this.ensure(lh);
      this.y -= lh;
      if (line) this.page.drawText(line, { x: opts.x ?? MARGIN, y: this.y, size, font, color: opts.color ?? INK });
    }
    this.y -= opts.gap ?? 6;
  }

  rule(gap = 10) {
    this.ensure(gap * 2);
    this.y -= gap;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.7, color: LINE });
    this.y -= gap;
  }

  /** Two columns of label/value lines, side by side. */
  kv(rows: [string, string][], labelW = 120) {
    for (const [k, v] of rows) {
      const valueLines = this.wrap(v, 10, this.font, CONTENT_W - labelW);
      const h = valueLines.length * 14.5;
      this.ensure(h);
      this.page.drawText(this.safe(k), { x: MARGIN, y: this.y - 14.5, size: 9.5, font: this.font, color: MUTED });
      valueLines.forEach((line, i) =>
        this.page.drawText(line, { x: MARGIN + labelW, y: this.y - 14.5 * (i + 1), size: 10, font: this.bold, color: INK })
      );
      this.y -= h + 2;
    }
  }
}

async function embedSignature(doc: PDFDocument, dataUrl: string | null): Promise<PDFImage | null> {
  if (!dataUrl?.startsWith("data:image/png;base64,")) return null;
  try {
    return await doc.embedPng(Buffer.from(dataUrl.split(",")[1], "base64"));
  } catch {
    return null;
  }
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export interface ContractPdfInput {
  id: string;
  title: string;
  body: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  monthlyRent: number | null;
  deposit: number | null;
  documentHash: string | null;
  ownerSignature: string | null;
  ownerSignedName: string | null;
  ownerSignedAt: Date | null;
  ownerSignedIp: string | null;
  tenantSignature: string | null;
  tenantSignedName: string | null;
  tenantSignedAt: Date | null;
  tenantSignedIp: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  ownerName: string;
  businessName: string;
  ownerEmail: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string;
  propertyName: string;
  propertyAddress: string;
  unitNumber: string;
}

export async function buildContractPdf(c: ContractPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(c.title);
  doc.setAuthor(c.businessName);
  doc.setCreator("TenantHub (tenant-hub.app)");
  doc.setProducer("TenantHub");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `${c.title} · Contract ID ${c.id}`);

  w.text(c.businessName.toUpperCase(), { size: 9, bold: true, color: BRAND, gap: 2 });
  w.text(c.title, { size: 18, bold: true, gap: 4 });
  w.text(c.status === "signed" ? "Fully signed" : c.status === "sent" ? "Awaiting tenant signature" : "Draft — not yet signed", {
    size: 9, color: MUTED, gap: 10,
  });

  w.kv([
    ["Lessor (Owner)", `${c.ownerName} — ${c.businessName}`],
    ["Lessee (Tenant)", `${c.tenantName}${c.tenantEmail ? ` · ${c.tenantEmail}` : ""} · ${c.tenantPhone}`],
    ["Premises", `${c.propertyName}, Unit ${c.unitNumber} — ${c.propertyAddress}`],
    ...(c.startDate || c.endDate
      ? [["Term", `${c.startDate ? pdfDate(c.startDate) : "—"} to ${c.endDate ? pdfDate(c.endDate) : "—"}`] as [string, string]]
      : []),
    ...(c.monthlyRent != null ? [["Monthly rent", pesoText(c.monthlyRent)] as [string, string]] : []),
    ...(c.deposit != null ? [["Security deposit", pesoText(c.deposit)] as [string, string]] : []),
  ]);
  w.rule(8);

  w.text(c.body, { size: 10.5, gap: 14 });

  // Signatures
  w.ensure(170);
  w.rule(6);
  w.text("SIGNATURES", { size: 9, bold: true, color: MUTED, gap: 8 });
  const ownerImg = await embedSignature(doc, c.ownerSignature);
  const tenantImg = await embedSignature(doc, c.tenantSignature);
  const colW = (CONTENT_W - 24) / 2;
  const top = w.y;
  const drawSig = (x: number, label: string, img: PDFImage | null, name: string | null, at: Date | null) => {
    const boxH = 70;
    if (img) {
      const scale = Math.min(colW / img.width, boxH / img.height, 1);
      w.page.drawImage(img, { x, y: top - boxH, width: img.width * scale, height: img.height * scale });
    } else {
      w.page.drawText("Not yet signed", { x, y: top - boxH / 2, size: 10, font, color: MUTED });
    }
    w.page.drawLine({ start: { x, y: top - boxH - 4 }, end: { x: x + colW, y: top - boxH - 4 }, thickness: 0.8, color: INK });
    w.page.drawText(w.safe(name ?? "________________"), { x, y: top - boxH - 18, size: 10, font: bold, color: INK });
    w.page.drawText(w.safe(label), { x, y: top - boxH - 31, size: 8.5, font, color: MUTED });
    if (at) w.page.drawText(w.safe(`Signed ${pdfDate(at, true)}`), { x, y: top - boxH - 43, size: 8.5, font, color: MUTED });
  };
  drawSig(MARGIN, "Lessor (Owner)", ownerImg, c.ownerSignedName, c.ownerSignedAt);
  drawSig(MARGIN + colW + 24, "Lessee (Tenant)", tenantImg, c.tenantSignedName, c.tenantSignedAt);
  w.y = top - 130;

  // Audit trail
  w.newPage();
  w.text("Signature audit trail", { size: 14, bold: true, gap: 4 });
  w.text("Electronic signatures captured by TenantHub. Each party drew their signature and typed their full name, and agreed to sign electronically.", {
    size: 9, color: MUTED, gap: 10,
  });
  const rows: [string, string][] = [
    ["Contract ID", c.id],
    ["Document fingerprint", c.documentHash ? `SHA-256 ${c.documentHash}` : "—"],
  ];
  if (c.ownerSignedAt) rows.push(["Owner signed", `${c.ownerSignedName} · ${c.ownerEmail} · ${pdfDate(c.ownerSignedAt, true)}${c.ownerSignedIp ? ` · IP ${c.ownerSignedIp}` : ""}`]);
  if (c.sentAt) rows.push(["Sent to tenant", pdfDate(c.sentAt, true)]);
  if (c.viewedAt) rows.push(["First opened by tenant", pdfDate(c.viewedAt, true)]);
  if (c.tenantSignedAt) rows.push(["Tenant signed", `${c.tenantSignedName} · ${pdfDate(c.tenantSignedAt, true)}${c.tenantSignedIp ? ` · IP ${c.tenantSignedIp}` : ""}`]);
  w.kv(rows, 150);
  w.rule(8);
  w.text(
    "The document fingerprint is computed from the contract title and text at the moment the owner signed. The text cannot be edited after it is sent, so a matching fingerprint shows both parties signed the same terms. Electronic signatures are recognized under the Philippine Electronic Commerce Act (R.A. 8792).",
    { size: 8.5, color: MUTED }
  );

  return Buffer.from(await doc.save());
}

// ─── Invoices & receipts ─────────────────────────────────────────────────────

export interface InvoicePdfInput {
  type: "invoice" | "receipt";
  number: string;
  issuedAt: Date;
  dueDate: Date | null;
  periodLabel: string | null;
  items: { label: string; amount: number }[];
  total: number;
  notes: string | null;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  gcash: string | null;
  maya: string | null;
  bankDetails: string | null;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string;
  propertyName: string;
  unitNumber: string;
}

export async function buildInvoicePdf(inv: InvoicePdfInput): Promise<Buffer> {
  const isInvoice = inv.type === "invoice";
  const doc = await PDFDocument.create();
  doc.setTitle(`${isInvoice ? "Invoice" : "Receipt"} ${inv.number}`);
  doc.setAuthor(inv.businessName);
  doc.setCreator("TenantHub (tenant-hub.app)");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `${inv.businessName} · ${inv.number}`);

  // Header
  const top = w.y;
  w.page.drawText(w.safe(inv.businessName), { x: MARGIN, y: top - 20, size: 16, font: bold, color: INK });
  const ownerLines = [inv.ownerName, inv.ownerEmail, inv.ownerPhone].filter(Boolean) as string[];
  ownerLines.forEach((l, i) => w.page.drawText(w.safe(l), { x: MARGIN, y: top - 36 - i * 12, size: 9, font, color: MUTED }));

  const title = isInvoice ? "INVOICE" : "RECEIPT";
  const tw = bold.widthOfTextAtSize(title, 22);
  w.page.drawText(title, { x: PAGE_W - MARGIN - tw, y: top - 22, size: 22, font: bold, color: isInvoice ? BRAND : rgb(0.09, 0.64, 0.29) });
  const meta = [
    `No. ${inv.number}`,
    `${isInvoice ? "Issued" : "Date paid"}: ${pdfDate(inv.issuedAt)}`,
    ...(isInvoice && inv.dueDate ? [`Due: ${pdfDate(inv.dueDate)}`] : []),
  ];
  meta.forEach((l, i) => {
    const s = w.safe(l);
    w.page.drawText(s, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(s, 9.5), y: top - 40 - i * 13, size: 9.5, font, color: INK });
  });
  w.y = top - 40 - Math.max(ownerLines.length * 12, meta.length * 13) - 16;
  w.rule(6);

  w.text(isInvoice ? "BILL TO" : "RECEIVED FROM", { size: 8.5, bold: true, color: MUTED, gap: 0 });
  w.text(inv.tenantName, { size: 11, bold: true, gap: 0 });
  w.text(`${inv.propertyName}, Unit ${inv.unitNumber}`, { size: 9.5, color: MUTED, gap: 0 });
  w.text([inv.tenantEmail, inv.tenantPhone].filter(Boolean).join(" · "), { size: 9.5, color: MUTED, gap: 12 });
  if (inv.periodLabel) w.text(`Billing period: ${inv.periodLabel}`, { size: 10, gap: 10 });

  // Items table
  const amtX = PAGE_W - MARGIN;
  w.ensure(30);
  w.page.drawRectangle({ x: MARGIN, y: w.y - 22, width: CONTENT_W, height: 22, color: rgb(0.95, 0.96, 0.98) });
  w.page.drawText("Description", { x: MARGIN + 8, y: w.y - 15, size: 9, font: bold, color: MUTED });
  w.page.drawText("Amount", { x: amtX - 8 - bold.widthOfTextAtSize("Amount", 9), y: w.y - 15, size: 9, font: bold, color: MUTED });
  w.y -= 22;
  for (const item of inv.items) {
    w.ensure(24);
    const amount = pesoText(item.amount);
    w.page.drawText(w.safe(item.label), { x: MARGIN + 8, y: w.y - 16, size: 10, font, color: INK });
    w.page.drawText(amount, { x: amtX - 8 - font.widthOfTextAtSize(amount, 10), y: w.y - 16, size: 10, font, color: INK });
    w.y -= 24;
    w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 0.5, color: LINE });
  }
  w.ensure(34);
  const totalLabel = isInvoice ? "Total due" : "Amount received";
  const total = pesoText(inv.total);
  w.page.drawText(totalLabel, { x: amtX - 8 - 150, y: w.y - 22, size: 11, font: bold, color: INK });
  w.page.drawText(total, { x: amtX - 8 - bold.widthOfTextAtSize(total, 13), y: w.y - 22, size: 13, font: bold, color: INK });
  w.y -= 40;

  if (isInvoice && (inv.gcash || inv.maya || inv.bankDetails)) {
    w.text("HOW TO PAY", { size: 8.5, bold: true, color: MUTED, gap: 2 });
    if (inv.gcash) w.text(`GCash: ${inv.gcash}`, { size: 10, gap: 0 });
    if (inv.maya) w.text(`Maya: ${inv.maya}`, { size: 10, gap: 0 });
    if (inv.bankDetails) w.text(`Bank: ${inv.bankDetails}`, { size: 10, gap: 0 });
    w.text("After paying, upload your proof of payment in the tenant portal.", { size: 9, color: MUTED, gap: 12 });
  }
  if (!isInvoice) {
    w.text("PAID — Thank you!", { size: 12, bold: true, color: rgb(0.09, 0.64, 0.29), gap: 10 });
  }
  if (inv.notes) {
    w.text("NOTES", { size: 8.5, bold: true, color: MUTED, gap: 2 });
    w.text(inv.notes, { size: 9.5, gap: 10 });
  }
  w.text(
    isInvoice
      ? "This is a billing statement generated by TenantHub on behalf of the property owner."
      : "Acknowledgement receipt generated by TenantHub on behalf of the property owner. This is not a BIR-registered official receipt unless issued separately by the owner.",
    { size: 8, color: MUTED }
  );

  return Buffer.from(await doc.save());
}
