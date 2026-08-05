/**
 * Merge store-side changes into a working-copy draft without stomping what the
 * broker has typed: a key is taken from `next` only when the store actually moved
 * it (`next !== base`) AND the draft still sits at its mount value
 * (`draft === base`). Identity comparison suffices — every write in this app
 * spreads a new object rather than mutating in place.
 */
export function reseedDraft<T extends object>(draft: T, base: T, next: T): T {
	let changed = false;
	const merged = { ...draft };
	for (const key of Object.keys(next) as (keyof T)[]) {
		if (next[key] !== base[key] && draft[key] === base[key]) {
			merged[key] = next[key];
			changed = true;
		}
	}
	return changed ? merged : draft;
}
