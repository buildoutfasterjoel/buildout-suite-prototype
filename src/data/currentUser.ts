/**
 * Who is looking — the signed-in identity, as a switchable seat.
 *
 * `CURRENT_USER` (teammates.ts) is the demo's *protagonist*: Ethan, whose book
 * the seed is written around and whose voice the hero arcs are in. The viewer
 * is whoever the account menu says is looking right now, defaulting to him.
 * Every rights, visibility and authorship decision reads the viewer; only the
 * seed and the hand-written stories read the protagonist.
 *
 * Persisted in localStorage under `dev_viewer` (like the old `dev_role` seat),
 * restored in an effect so SSR and the first client render agree. Nothing here
 * is world data; `SEED_VERSION` doesn't move.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { CURRENT_USER, TEAMMATES, findTeammate, type Teammate } from "#/data/teammates";

const STORAGE_KEY = "dev_viewer";

interface CurrentUserState {
  id: string;
  setId: (id: string) => void;
}

export const useCurrentUser = create<CurrentUserState>((set) => ({
  id: CURRENT_USER.id,
  setId: (id) => {
    if (!findTeammate(id)) return;
    set({ id });
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable — the session still works, it just won't survive a reload.
    }
  },
}));

/** The viewer as a roster member. Falls back to the protagonist for an unknown id. */
export function currentUser(): Teammate {
  return findTeammate(useCurrentUser.getState().id) ?? CURRENT_USER;
}

/** The viewer's id — the comparison every ownership and share check makes. */
export function viewerId(): string {
  return useCurrentUser.getState().id;
}

/** The viewer as a timeline actor — what a note logged right now is signed as. */
export function currentUserActor(): { name: string; avatarUrl?: string } {
  const u = currentUser();
  return { name: u.name, avatarUrl: u.avatarUrl };
}

/** Everyone a viewer can stand in as: the protagonist plus the roster. */
export const VIEWABLE_PEOPLE: Teammate[] = [CURRENT_USER, ...TEAMMATES];

/** The persisted seat, or the protagonist on the server / when absent. */
export function readStoredViewer(): string {
  if (typeof window === "undefined") return CURRENT_USER.id;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && findTeammate(stored) ? stored : CURRENT_USER.id;
  } catch {
    return CURRENT_USER.id;
  }
}

/** Restore the persisted seat once the client is up. Mount once, in the shell. */
export function useHydrateCurrentUser(): void {
  useEffect(() => {
    const stored = readStoredViewer();
    if (stored !== useCurrentUser.getState().id) useCurrentUser.setState({ id: stored });
  }, []);
}
