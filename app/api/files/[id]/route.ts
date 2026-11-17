import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/collections/actor";
import { canReadFileAsync, readFileBytes } from "@/lib/collections/files";

/**
 * The only way to read billing evidence. Checks the caller against the file
 * (owning account's admins, or the tenant it belongs to) on every request.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const actor = await currentActor();
  const file = await prisma.storedFile.findUnique({ where: { id } });
  // Same response for "missing" and "not yours", so ids can't be probed.
  if (!file || !(await canReadFileAsync(actor, file))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bytes = await readFileBytes(file);
  if (!bytes) return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
