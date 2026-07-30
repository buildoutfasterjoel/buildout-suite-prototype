/**
 * Persona switching for the account dropdown.
 *
 * The persona is prototype scaffolding, not product state: it decides which
 * role the demo presents as, and persists in localStorage under `dev_role` so a
 * reload keeps the chosen vantage point. Kept free of React and of a direct
 * `window` reference so it is testable in Vitest's node environment.
 */

export type Persona = "principal" | "broker" | "marketing";

/** Display order in the "Viewing as" submenu. */
export const PERSONA_ORDER: readonly Persona[] = [
  "principal",
  "broker",
  "marketing",
];

export const PERSONA_LABELS: Record<Persona, string> = {
  principal: "Principal",
  broker: "Broker",
  marketing: "Marketing",
};

/** The slice of the Storage API this module needs. */
export type PersonaStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_role";
// Tracks CURRENT_USER.role in src/data/teammates.ts ("Broker"), so the
// identity card's default line doesn't contradict every other rendering of
// CURRENT_USER.role on a fresh demo.
const DEFAULT_PERSONA: Persona = "broker";

/** localStorage when there is a document, null during SSR. */
function browserStore(): PersonaStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isPersona(value: string | null): value is Persona {
  return value !== null && PERSONA_ORDER.includes(value as Persona);
}

/** The persisted persona, or Broker when absent, unrecognized, or on the server. */
export function readPersona(
  store: PersonaStore | null = browserStore(),
): Persona {
  if (!store) return DEFAULT_PERSONA;
  const stored = store.getItem(STORAGE_KEY);
  return isPersona(stored) ? stored : DEFAULT_PERSONA;
}

export function writePersona(
  persona: Persona,
  store: PersonaStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, persona);
}

/** The identity card's third line, e.g. "Marketing · Buildout". */
export function identityLine(persona: Persona, company?: string): string {
  const label = PERSONA_LABELS[persona];
  return company ? `${label} · ${company}` : label;
}
