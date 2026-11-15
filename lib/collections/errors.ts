/** Expected, user-facing failures from collections services (mapped to 4xx). */
export class BillingError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export const notFound = (what = "Not found") => new BillingError(what, 404);
export const forbidden = (what = "You don't have access to this") => new BillingError(what, 403);
export const conflict = (what: string) => new BillingError(what, 409);
export const invalid = (what: string) => new BillingError(what, 400);
