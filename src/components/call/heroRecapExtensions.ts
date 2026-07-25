import type { CallTarget } from "./useCallStore";
import { getContact } from "#/data/store";

/** A hero call = the target owner carries an overnight signal (the arc's Rosa). */
export function isHeroCall(target: CallTarget | null): boolean {
  if (!target) return false;
  return !!getContact(target.contactId)?.signal;
}
