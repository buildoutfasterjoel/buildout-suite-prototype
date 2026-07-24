const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Map a natural-language due phrase to an ISO date, or null if unparseable. */
export function parseDueDate(input: string, from: Date = new Date()): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (s === "today") return iso(base);
  if (s === "tomorrow") { base.setDate(base.getDate() + 1); return iso(base); }
  if (s === "next week") { base.setDate(base.getDate() + 7); return iso(base); }

  const inDays = s.match(/^in (\d+) days?$/);
  if (inDays) { base.setDate(base.getDate() + Number(inDays[1])); return iso(base); }

  const wd = DAYS.findIndex((d) => s === d || s === `next ${d}`);
  if (wd >= 0) {
    let delta = (wd - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7; // "friday" on a Friday means next Friday
    base.setDate(base.getDate() + delta);
    return iso(base);
  }

  return null;
}
