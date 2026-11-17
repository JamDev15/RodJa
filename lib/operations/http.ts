import { invalid } from "@/lib/collections/errors";

export async function formValues(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw invalid("Send this as a form upload");
  }
}

/** The uploaded file in a form field; null when optional and absent. */
export function formFile(form: FormData, name: string, required = true): File | null {
  const v = form.get(name);
  if (v && typeof v !== "string" && v.size > 0) return v;
  if (required) throw invalid("Please attach a file");
  return null;
}

/** Text fields of a form as a plain object (files skipped). Checkboxes arrive as "on" → true. */
export function formObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v === "on" ? true : v;
  return out;
}

export function isMultipart(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
}
