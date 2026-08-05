import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPlatformQr, validateProofFile } from "@/lib/storage";
import { platformSettingsUpdateSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const gcashNumber = (formData.get("gcashNumber") as string) || "";
  const mayaNumber = (formData.get("mayaNumber") as string) || "";
  const notificationEmail = (formData.get("notificationEmail") as string) || "";
  const gcashQr = formData.get("gcashQr") as File | null;
  const mayaQr = formData.get("mayaQr") as File | null;

  const parsed = platformSettingsUpdateSchema.safeParse({ gcashNumber, mayaNumber, notificationEmail });
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const existing = await prisma.platformSettings.findFirst();

  const data: { gcashNumber?: string | null; mayaNumber?: string | null; notificationEmail?: string | null; gcashQrUrl?: string; mayaQrUrl?: string } = {
    gcashNumber: parsed.data.gcashNumber || null,
    mayaNumber: parsed.data.mayaNumber || null,
    notificationEmail: parsed.data.notificationEmail || null,
  };

  if (gcashQr && gcashQr.size > 0) {
    const validationError = validateProofFile(gcashQr);
    if (validationError) return NextResponse.json({ error: `GCash QR: ${validationError}` }, { status: 400 });
    const url = await uploadPlatformQr(gcashQr, "gcash");
    if (url) data.gcashQrUrl = url;
  }
  if (mayaQr && mayaQr.size > 0) {
    const validationError = validateProofFile(mayaQr);
    if (validationError) return NextResponse.json({ error: `Maya QR: ${validationError}` }, { status: 400 });
    const url = await uploadPlatformQr(mayaQr, "maya");
    if (url) data.mayaQrUrl = url;
  }

  const updated = existing
    ? await prisma.platformSettings.update({ where: { id: existing.id }, data })
    : await prisma.platformSettings.create({ data });

  return NextResponse.json(updated);
}
