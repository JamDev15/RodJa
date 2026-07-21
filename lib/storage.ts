const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "payment-proofs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Returns an error message if the file fails validation, or null if it's OK. */
export function validateProofFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return "File is too large (max 5MB)";
  if (!(file.type in ALLOWED_MIME_TYPES)) return "Unsupported file type (use JPG, PNG, WEBP, or PDF)";
  return null;
}

export async function uploadPaymentProof(
  file: File,
  tenantId: string,
  month: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const ext = ALLOWED_MIME_TYPES[file.type];
  if (!ext) return null;
  const path = `${tenantId}/${month}-${Date.now()}.${ext}`;
  const formData = new FormData();
  formData.append("", file);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "x-upsert": "true",
        },
        body: formData,
      }
    );
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch {
    return null;
  }
}
