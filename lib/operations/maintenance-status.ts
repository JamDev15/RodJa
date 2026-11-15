// Pure maintenance status rules (safe to import from client components).

export const STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "WAITING", "COMPLETED", "CLOSED"] as const;
export type MaintenanceStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  SUBMITTED: "Submitted",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const LEGACY: Record<string, MaintenanceStatus> = { open: "SUBMITTED", in_progress: "IN_PROGRESS", resolved: "COMPLETED", closed: "CLOSED" };

export function normalizeStatus(s: string): MaintenanceStatus {
  if ((STATUSES as readonly string[]).includes(s)) return s as MaintenanceStatus;
  return LEGACY[s] ?? "SUBMITTED";
}

/** Raw status values that mean each normalized status (for filtering old and new rows together). */
export function rawStatuses(statuses: MaintenanceStatus[]): string[] {
  const out = new Set<string>(statuses);
  for (const [raw, norm] of Object.entries(LEGACY)) if (statuses.includes(norm)) out.add(raw);
  return [...out];
}

export const OPEN: MaintenanceStatus[] = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "WAITING"];
export const OPEN_RAW = rawStatuses(OPEN);

/** Which status moves each role may make. */
const CARETAKER_MOVES: Partial<Record<MaintenanceStatus, MaintenanceStatus[]>> = {
  ASSIGNED: ["IN_PROGRESS", "WAITING", "COMPLETED"],
  IN_PROGRESS: ["WAITING", "COMPLETED"],
  WAITING: ["IN_PROGRESS", "COMPLETED"],
};

export function allowedMoves(role: "ADMIN" | "CARETAKER", from: MaintenanceStatus): MaintenanceStatus[] {
  if (role === "CARETAKER") return CARETAKER_MOVES[from] ?? [];
  if (from === "CLOSED") return ["IN_PROGRESS"]; // reopen
  return STATUSES.filter((s) => s !== from && s !== "SUBMITTED");
}

