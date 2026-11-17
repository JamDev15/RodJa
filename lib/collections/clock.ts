// Single source of "now" for collections billing, so tests can pin the date.
let fixed: Date | null = null;

export function currentTime(): Date {
  return fixed ? new Date(fixed) : new Date();
}

/** Tests only. Pass null to return to the real clock. */
export function setClockForTests(date: Date | null): void {
  if (process.env.NODE_ENV === "production") throw new Error("Clock override is not available in production");
  fixed = date;
}
