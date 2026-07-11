import type { EmailStatus } from "#/data/emails";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";

/** Status pill: label + indicator dot color (matches the mock's colored dots). */
export const EMAIL_STATUS_DISPLAY: Record<
  EmailStatus,
  { label: string; dotColor: string }
> = {
  draft: { label: "Draft", dotColor: "#94a3b8" },
  sent: { label: "Sent", dotColor: "#16a34a" },
  scheduled: { label: "Scheduled", dotColor: "#2563eb" },
};

/** Property-type display label (re-exported for convenience on the email pages). */
export { TYPE_LABELS };
