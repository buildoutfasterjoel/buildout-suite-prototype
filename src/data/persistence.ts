import { del, get, set } from "idb-keyval";
import type { DataSlice } from "./dataStore";

/** Bump when seed logic changes so stale snapshots are auto-discarded on load. */
<<<<<<< HEAD
export const SEED_VERSION = 9;
=======
export const SEED_VERSION = 6
>>>>>>> c3c4da7 (feat(deals): Phase 3 deal marketing editor)

const SNAPSHOT_KEY = "bo-proto:datastore";

interface Snapshot {
  version: number;
  slice: DataSlice;
}

export async function saveSnapshot(slice: DataSlice): Promise<void> {
  const snapshot: Snapshot = { version: SEED_VERSION, slice };
  await set(SNAPSHOT_KEY, snapshot);
}

export async function loadSnapshot(): Promise<DataSlice | null> {
  const snapshot = (await get(SNAPSHOT_KEY)) as Snapshot | undefined;
  if (!snapshot || snapshot.version !== SEED_VERSION) return null;
  return snapshot.slice;
}

export async function clearSnapshot(): Promise<void> {
  await del(SNAPSHOT_KEY);
}
