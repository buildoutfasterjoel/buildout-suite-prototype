# Space Deal Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve a lease deal's marketing against its building and its money against its space, so brokers working different suites in one building share the marketing and never see each other's commission.

**Architecture:** `dealAccessFor` stays the one pure resolver every surface asks. It gains a fourth `DealFamily` argument naming the shell above a space or the spaces below a shell; the hook layer reads those from the store. Three surfaces then stop leaking: the shell's Vouchers index filters per space, the Spaces roster locks rows it cannot open, and the space header grows a real access cluster.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Vitest · Blueprint React · Zustand-style `useDataStore`

**Spec:** `docs/superpowers/specs/2026-09-04-space-deal-permissions-design.md`

## Global Constraints

- **Package manager is Bun.** Run every script as `bun --bun run <script>`.
- **Tests:** `bunx vitest run <path>` for one file. A trailing `close timed out after 10000ms` / `something prevents Vite server from exiting` is a known non-gate in this repo — read the `Tests` line above it.
- **Type gate:** `vite build` does NOT type-check. The gate is `bunx tsc --noEmit`.
- **`dealAccess.ts` stays React-free and pure.** It must keep running under Vitest's node environment with no store and no DOM. Every store read lives in `useDealAccess.ts` or in a route.
- **No new permission ids.** `access-other-listings`, `view-other-vouchers`, `edit-other-vouchers` keep their present meanings.
- **Icons:** FontAwesome Pro, `pro-regular` weight, never pass `fixedWidth`.
- **Blueprint first.** No hand-rolled UI where a Blueprint component exists.
- **Commit style:** lowercase conventional prefix, a sentence that says what changed and why (`feat(deals): …`, `fix(seed): …`, `test(access): …`).

---

### Task 1: The resolver learns about the family

**Files:**
- Modify: `src/components/deals/dealAccess.ts`
- Test: `src/components/deals/dealAccessFor.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface DealFamily { shell?: Listing; shellShares?: DealShare[]; spaces?: Listing[] }`
  - `dealAccessFor(listing: Listing, viewer: AccessViewer | undefined, shares: DealShare[], family?: DealFamily): DealAccess`
  - `visibleDeals(listings: Listing[], viewer: AccessViewer | undefined, shares: ReadonlyMap<string, DealShare[]>): Listing[]` — signature unchanged, behaviour widened.
  - `canOpenDeal(access: DealAccess): boolean` — unchanged, used by later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/deals/dealAccessFor.test.ts`. The existing `viewer` and `share` helpers at the top of that file are reused as-is; these fixtures are new.

```ts
/* ------------------------------------------------------------------------- *
 * Lease families: a shell and its spaces.
 * ------------------------------------------------------------------------- */

/** A lease building. Sarah works the assignment; nobody else is on it. */
const shell = {
  id: "SH1",
  parentDealId: null,
  createdById: "sarah-chen",
  internalBrokers: [{ id: "b1", name: "Sarah Chen", email: "" }],
} as unknown as Listing;

/** Suite 100, worked by Marcus. */
const spaceA = {
  id: "SP-A",
  parentDealId: "SH1",
  createdById: "marcus-patel",
  internalBrokers: [{ id: "b2", name: "Marcus Patel", email: "" }],
} as unknown as Listing;

/** Suite 200, worked by Priya. Marcus must never reach it. */
const spaceB = {
  id: "SP-B",
  parentDealId: "SH1",
  createdById: "priya-raman",
  internalBrokers: [{ id: "b3", name: "Priya Raman", email: "" }],
} as unknown as Listing;

const shellFamily = { spaces: [spaceA, spaceB] };
const spaceFamily = (shellShares: DealShare[] = []) => ({ shell, shellShares });

describe("dealAccessFor — marketing resolves on the shell", () => {
  it("gives a suite broker the building's marketing and no shell voucher", () => {
    // Marcus works Suite 100. The media, website and documents he needs live on
    // the building, so working any suite has to open it.
    expect(dealAccessFor(shell, viewer("marcus-patel", ["broker"]), [], shellFamily)).toEqual({
      marketing: "contribute",
      backOffice: "view",
    });
  });

  it("gives a shell broker no Vouchers index when they work none of its spaces", () => {
    // Sarah owns the assignment, not the transactions. An index of nothing is a
    // worse page than no index.
    expect(dealAccessFor(shell, viewer("sarah-chen", ["broker"]), [], shellFamily)).toEqual({
      marketing: "contribute",
      backOffice: "none",
    });
  });

  it("gives a suite broker nothing at all on a sibling suite", () => {
    // The whole point: two brokers, one building, separate suites. Marketing is
    // one wall across the *building*, never across its suites.
    expect(
      dealAccessFor(spaceB, viewer("marcus-patel", ["broker"]), [], spaceFamily()),
    ).toEqual({ marketing: "none", backOffice: "none" });
  });

  it("gives a suite broker both halves on their own suite", () => {
    expect(
      dealAccessFor(spaceA, viewer("marcus-patel", ["broker"]), [], spaceFamily()),
    ).toEqual({ marketing: "contribute", backOffice: "contribute" });
  });

  it("gives the shell's broker every suite's marketing and no suite's money", () => {
    expect(
      dealAccessFor(spaceB, viewer("sarah-chen", ["broker"]), [], spaceFamily()),
    ).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("reads a space's marketing share off the shell, not off the space", () => {
    // Maya is shared into the building at contribute. She holds
    // edit-listing-website, so the cap leaves her at contribute.
    expect(
      dealAccessFor(
        spaceB,
        viewer("maya-brooks", ["marketing-assistant"]),
        [],
        spaceFamily([share("maya-brooks", "contribute")]),
      ),
    ).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("ignores a share written on the space itself", () => {
    // Sharing moved to the building. A share on a space is unreachable data,
    // and must not quietly keep working.
    expect(
      dealAccessFor(
        spaceB,
        viewer("maya-brooks", ["marketing-assistant"]),
        [share("maya-brooks", "contribute")],
        spaceFamily(),
      ),
    ).toEqual({ marketing: "none", backOffice: "none" });
  });

  it("still gives a Back Office Manager every suite's voucher", () => {
    expect(
      dealAccessFor(spaceB, viewer("tessa-nakamura", ["back-office-manager"]), [], spaceFamily()),
    ).toEqual({ marketing: "none", backOffice: "contribute" });
  });
});

describe("visibleDeals — a lease building", () => {
  const all = [shell, spaceA, spaceB];
  const noShares = new Map<string, DealShare[]>();

  it("gives a suite broker their building and their own suite only", () => {
    const seen = visibleDeals(all, viewer("marcus-patel", ["broker"]), noShares);
    expect(seen.map((l) => l.id)).toEqual(["SH1", "SP-A"]);
  });

  it("gives a building's guest every suite in it", () => {
    const shares = new Map<string, DealShare[]>([
      ["SH1", [share("maya-brooks", "view")]],
    ]);
    const seen = visibleDeals(all, viewer("maya-brooks", ["marketing-assistant"]), shares);
    expect(seen.map((l) => l.id)).toEqual(["SH1", "SP-A", "SP-B"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run src/components/deals/dealAccessFor.test.ts`

Expected: the new `describe` blocks FAIL. `dealAccessFor` currently ignores its fourth argument, so a suite broker resolves `{ marketing: "none", backOffice: "none" }` on the shell instead of `{ marketing: "contribute", backOffice: "view" }`. The pre-existing tests in the file must all still PASS — if any of them fails at this step, stop: the fixtures were written wrong, not the resolver.

- [ ] **Step 3: Add `DealFamily` and `sharedLevel` to `dealAccess.ts`**

Add below the `DealAccess` interface, above `const FULL`:

```ts
/**
 * The lease family around a listing, when it has one.
 *
 * Marketing belongs to the building and money belongs to the space, so
 * resolving either half needs a record the listing itself does not carry: a
 * space needs its shell, a shell needs its spaces. Passed in rather than read,
 * because this module stays pure — `useDealAccess` does the store work.
 *
 * Never both at once: a listing is a shell or a space, never the two.
 */
export interface DealFamily {
  /** The shell this space hangs under. Undefined for a top-level deal. */
  shell?: Listing;
  /** Shares granted on that shell — the only share list a space ever reads. */
  shellShares?: DealShare[];
  /** A shell's child space deals. Set only when `listing` is the shell. */
  spaces?: Listing[];
}
```

Add beside `canEditMarketing`:

```ts
/**
 * What a share opens for this viewer, capped by what their role may edit.
 *
 * Lifted out of `dealAccessFor` because a space resolves its share against its
 * shell's list rather than its own, so the cap now runs on one of two lists.
 */
function sharedLevel(shares: DealShare[], viewer: AccessViewer): AccessLevel {
  const share = shares.find((s) => s.member.id === viewer.id);
  if (!share) return "none";
  return share.level === "contribute" && canEditMarketing(viewer) ? "contribute" : "view";
}
```

- [ ] **Step 4: Replace the body of `dealAccessFor`**

Replace the whole existing function (signature and body, keeping its doc comment updated as below):

```ts
/**
 * What this viewer may do on this deal — the one function the whole feature
 * rests on. Pure, so it is testable without a store or a browser.
 *
 * **Marketing resolves on the shell. Money resolves on the space.** A lease
 * building is a shell deal and each rented suite is its own child deal, so the
 * two halves of one page answer to two different records:
 *
 *  1. **Marketing** is the building's — the website, documents, email and
 *     demographics only exist there. Working any suite in a building therefore
 *     opens the building, and being on the building's team opens every suite's
 *     marketing. It stops at the building: a broker on Suite 3 reaches nothing
 *     on Suite 4, or a large building would fill every one of its brokers'
 *     deal indexes with suites they do not work.
 *  2. **Money** is the suite's. Only its own broker team reaches its voucher —
 *     the shell's team does not, because the shell owns the assignment and the
 *     suite owns the transaction. A shell has no voucher at all: `backOffice`
 *     there means "may open the Vouchers index", and the index filters per row.
 *
 * A share is unchanged and still never touches the back office. It now always
 * hangs on the building, so a space reads `family.shellShares`.
 *
 * A deal with no family — every sale deal and every unsplit lease deal —
 * resolves exactly as it did before this argument existed.
 *
 * A viewer with no roster row falls through to full access rather than none: we
 * cannot resolve a ceiling for someone we can't find, and blanking the deal page
 * over a missing row is a worse failure than showing it.
 */
export function dealAccessFor(
  listing: Listing,
  viewer: AccessViewer | undefined,
  shares: DealShare[],
  family: DealFamily = {},
): DealAccess {
  if (!viewer) return FULL;

  const onThis = onDealTeam(listing, viewer);
  const onShell = family.shell ? onDealTeam(family.shell, viewer) : false;
  const onAnySpace = (family.spaces ?? []).some((s) => onDealTeam(s, viewer));
  // A lease deal is a shell only once it has children — the same rule
  // `dealShape` states. Before that it is a normal deal and resolves as one.
  const isShell = listing.parentDealId == null && (family.spaces?.length ?? 0) > 0;

  const role = roleAccess(viewer);
  // Marketing is the building's, so a space reads its shell's share list and
  // never its own. Every other shape reads the list it was handed.
  const marketingShares = family.shell ? (family.shellShares ?? NO_SHARES) : shares;

  return {
    marketing:
      onThis || onShell || (isShell && onAnySpace)
        ? "contribute"
        : higher(role.marketing, sharedLevel(marketingShares, viewer)),
    backOffice: isShell
      ? higher(onAnySpace ? "view" : "none", role.backOffice)
      : onThis
        ? "contribute"
        : role.backOffice,
  };
}
```

Move the `NO_SHARES` declaration from the bottom of the file to just above `dealAccessFor`, so it is defined before this use. Keep its comment.

- [ ] **Step 5: Widen `visibleDeals` to build the families once**

Replace the existing `visibleDeals`:

```ts
/**
 * The deals this viewer may know exist — every enumeration of the book goes
 * through here, the way `visibleContacts` gates the contact book.
 *
 * It asks exactly the question the deal page asks, family included: a suite
 * broker's index is their building plus the suites they work, and a
 * neighbouring suite's card does not appear. The two lookup maps are built once
 * rather than per row — a book of 27 listings scanned per listing is 27 scans
 * to answer one question.
 *
 * Listing a deal the viewer cannot open would be a row that goes nowhere, and
 * on a book of business the row itself is the leak — the address and the price
 * are on the card.
 */
export function visibleDeals(
  listings: Listing[],
  viewer: AccessViewer | undefined,
  shares: ReadonlyMap<string, DealShare[]>,
): Listing[] {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const spacesByShell = new Map<string, Listing[]>();
  for (const l of listings) {
    if (l.parentDealId == null) continue;
    const kids = spacesByShell.get(l.parentDealId);
    if (kids) kids.push(l);
    else spacesByShell.set(l.parentDealId, [l]);
  }

  return listings.filter((l) => {
    const shell = l.parentDealId ? byId.get(l.parentDealId) : undefined;
    const family: DealFamily = shell
      ? { shell, shellShares: shares.get(shell.id) ?? NO_SHARES }
      : { spaces: spacesByShell.get(l.id) };
    return canOpenDeal(dealAccessFor(l, viewer, shares.get(l.id) ?? NO_SHARES, family));
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bunx vitest run src/components/deals/dealAccessFor.test.ts`

Expected: PASS, every test in the file — the pre-existing ones included. Those are the regression check that a deal with no family still resolves exactly as before.

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`

Expected: no errors. `family` is optional, so no existing call site needs updating yet.

- [ ] **Step 8: Commit**

```bash
git add src/components/deals/dealAccess.ts src/components/deals/dealAccessFor.test.ts
git commit -m "feat(access): a lease deal's marketing resolves on its building, its money on its space"
```

---

### Task 2: The hooks read the family from the store

**Files:**
- Modify: `src/components/deals/useDealAccess.ts`

**Interfaces:**
- Consumes: `DealFamily`, `dealAccessFor`, `canOpenDeal` from Task 1.
- Produces:
  - `useDealFamily(listing: Listing): DealFamily`
  - `useDealAccess(listing: Listing): DealAccess` — signature unchanged, now family-aware.
  - `useOpenableSpaces(shellId: string): ReadonlySet<string>` — the child space deal ids this viewer may open. Task 5 consumes it.

There is no test in this task: these are store-bound React hooks, and the rules they feed are already pinned by Task 1's pure tests. Verification is `tsc` plus the browser pass in Task 7.

- [ ] **Step 1: Add the family hook**

Add to `src/components/deals/useDealAccess.ts`, after `useAccessViewer`:

```ts
/**
 * The lease family around one listing, resolved from the store.
 *
 * A space gets its shell and the shell's shares; a shell gets its spaces. Never
 * both — a listing is one or the other, and `dealAccessFor` reads whichever it
 * was given.
 *
 * The spaces are filtered out of the live `listings` map rather than read
 * through `getChildDeals`, so the hook re-runs when a space is added or a
 * broker changes hands. `getChildDeals` reads the store outside React and would
 * leave this stale.
 */
export function useDealFamily(listing: Listing): DealFamily {
  const shellId = listing.parentDealId;
  const listings = useDataStore((s) => s.listings);
  const shellShares = useDataStore((s) =>
    shellId ? (s.dealShares.get(shellId) ?? DEFAULT_DEAL_SHARES) : DEFAULT_DEAL_SHARES,
  );

  return useMemo(() => {
    if (shellId) {
      const shell = listings.get(shellId);
      return shell ? { shell, shellShares } : {};
    }
    const spaces = [...listings.values()].filter((l) => l.parentDealId === listing.id);
    return spaces.length > 0 ? { spaces } : {};
  }, [shellId, listing.id, listings, shellShares]);
}
```

Add `DealFamily` and `canOpenDeal` to the existing import from `./dealAccess`:

```ts
import {
  canOpenDeal,
  dealAccessFor,
  type AccessViewer,
  type DealAccess,
  type DealFamily,
} from "./dealAccess";
```

- [ ] **Step 2: Pass the family through `useDealAccess`**

Replace the body of `useDealAccess`:

```ts
export function useDealAccess(listing: Listing): DealAccess {
  const { shares } = useDealShares(listing.id);
  const viewer = useAccessViewer();
  const family = useDealFamily(listing);
  return useMemo(
    () => dealAccessFor(listing, viewer, shares, family),
    [listing, viewer, shares, family],
  );
}
```

- [ ] **Step 3: Add the openable-spaces hook**

Append to the same file:

```ts
/**
 * Which of a shell's spaces this viewer may actually open.
 *
 * The Spaces roster needs it per row: a suite the viewer cannot open still
 * shows — a broker should know the rest of the building is in flight — but it
 * stops being a link. Returned as a Set so a roster of twenty rows asks twenty
 * O(1) questions rather than re-resolving access per render.
 */
export function useOpenableSpaces(shellId: string): ReadonlySet<string> {
  const viewer = useAccessViewer();
  const listings = useDataStore((s) => s.listings);
  const shellShares = useDataStore(
    (s) => s.dealShares.get(shellId) ?? DEFAULT_DEAL_SHARES,
  );

  return useMemo(() => {
    const open = new Set<string>();
    const shell = listings.get(shellId);
    if (!shell) return open;
    for (const child of listings.values()) {
      if (child.parentDealId !== shellId) continue;
      // A space carries no shares of its own, so the third argument is empty by
      // construction — the shell's list is what `dealAccessFor` will read.
      const access = dealAccessFor(child, viewer, DEFAULT_DEAL_SHARES, {
        shell,
        shellShares,
      });
      if (canOpenDeal(access)) open.add(child.id);
    }
    return open;
  }, [shellId, listings, shellShares, viewer]);
}
```

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Run the full suite**

Run: `bun --bun run test`

Expected: PASS. Nothing here is directly tested, but `useDealAccess` feeds the sidebar and the gate, and a broken import would surface across the suite.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/useDealAccess.ts
git commit -m "feat(access): resolve a deal's lease family from the store and expose the openable spaces"
```

---

### Task 3: A share hangs on the building, in the seed too

**Files:**
- Modify: `src/data/seed.ts:3251-3270`
- Modify: `src/data/persistence.ts:5`
- Test: `src/data/seed.test.ts:912-926`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `seedDealShares(listings: Listing[]): Map<string, DealShare[]>` — signature unchanged; every key is now a top-level deal id.

**Why this task exists:** `seedDealShares` loops every listing and writes shares by index, spaces included. After Task 1 a space reads its shell's list, so those seven space entries are unreachable data — and they would still render as ghost avatars on the space header in Task 6.

- [ ] **Step 1: Update the failing seed test**

Replace `src/data/seed.test.ts:912-926` — the test named `leaves a marketing-opened deal to a broker, and shares it back`:

```ts
  it('leaves a marketing-opened deal to a broker, and shares it back', () => {
    // Maya can open a deal and cannot hold one, so she is never on its broker
    // list. Without the share she would have typed in a deal and lost it.
    //
    // A space's share hangs on its building: marketing is the building's, so
    // `dealAccessFor` reads the shell's list for a space and would never see a
    // share written on the space itself.
    const shares = seedDealShares(listings)
    const opened = deals.filter((l) => marketingCreatedDeal(l.id))
    expect(opened.length).toBeGreaterThanOrEqual(1)
    // One of the seeded spaces is marketing-created, so this covers both shapes.
    expect(opened.some((l) => l.parentDealId != null)).toBe(true)
    for (const l of opened) {
      expect(l.createdById, l.name).toBe('maya-brooks')
      expect(l.internalBrokers.map((b) => b.name), l.name).not.toContain('Maya Brooks')
      expect(
        (shares.get(l.parentDealId ?? l.id) ?? []).map((s) => s.member.id),
        l.name,
      ).toContain('maya-brooks')
    }
  })

  it('writes no share onto a space', () => {
    const shares = seedDealShares(listings)
    const spaceIds = listings.filter((l) => l.parentDealId != null).map((l) => l.id)
    expect(spaceIds.length).toBeGreaterThan(0)
    for (const id of spaceIds) expect(shares.has(id), id).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run src/data/seed.test.ts -t "share"`

Expected: `writes no share onto a space` FAILS — the seed currently keys shares by space id. (`leaves a marketing-opened deal…` may still pass, because `parentDealId ?? l.id` reads the space's own entry today; the new test is the one that pins the change.)

- [ ] **Step 3: Rewrite `seedDealShares`**

Replace `src/data/seed.ts:3251-3270` entirely:

```ts
export function seedDealShares(listings: Listing[]): Map<string, DealShare[]> {
  const map = new Map<string, DealShare[]>()
  const member = (id: string) => TEAMMATES.find((t) => t.id === id)
  const maya = member('maya-brooks')
  const riley = member('riley-park')

  /**
   * A share always hangs on the building. Marketing is the building's, so
   * `dealAccessFor` reads a space's shell for its share list and would never
   * find one written on the space — see `components/deals/dealAccess.ts`. A
   * member already granted keeps the level they were granted first.
   */
  const grant = (listing: Listing, who: Teammate, level: ShareLevel) => {
    const key = listing.parentDealId ?? listing.id
    const shares = map.get(key)
    if (!shares) {
      map.set(key, [{ member: who, level }])
      return
    }
    if (shares.some((s) => s.member.id === who.id)) return
    shares.push({ member: who, level })
  }

  listings.forEach((l, i) => {
    // A deal Maya opened is a deal Maya keeps. The create form grants this share
    // for real (see `CreateDealModal`); the seed grants it here for the deals
    // that arrive already opened by her, because without it she would have typed
    // in a deal and immediately lost it — `onDealTeam` reads the broker list,
    // and marketing is never on it.
    if (maya && (l.createdById === maya.id || i % 3 === 0)) grant(l, maya, 'contribute')
    if (riley && i % 6 === 2) grant(l, riley, 'view')
  })
  return map
}
```

If `Teammate` or `ShareLevel` is not already imported as a type in `seed.ts`, add them:
`import type { Teammate } from './teammates'` and `import type { ShareLevel } from './dealShares'`.
Both must be `import type` — `seed.ts` importing `dealShares.ts` at runtime is the import cycle that dies with a misleading "Cannot access 'SEED'".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bunx vitest run src/data/seed.test.ts`

Expected: PASS, whole file.

- [ ] **Step 5: Move `SEED_VERSION`**

In `src/data/persistence.ts:5`:

```ts
export const SEED_VERSION = 77;
```

Without this a browser keeps its old IndexedDB snapshot, the space shares survive there, and the header in Task 6 shows ghost avatars that no code path can explain.

- [ ] **Step 6: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`

Expected: no type errors; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/seed.ts src/data/seed.test.ts src/data/persistence.ts
git commit -m "fix(seed): hang a space's marketing share on its building, and move SEED_VERSION"
```

---

### Task 4: The shell's Vouchers index shows only the money you may see

**Files:**
- Modify: `src/data/spaceVouchers.ts`
- Modify: `src/routes/_shell/listings/$listingId/vouchers/index.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks. `canSeeVoucher(teamIds, viewerId, canViewOthers)` and `voucherTeamIds(deal)` already exist in `src/data/voucherRights.ts` and already drive `/backoffice/vouchers`.
- Produces: `SpaceVoucherRow` gains `teamIds: string[]`.

- [ ] **Step 1: Add `teamIds` to the row**

In `src/data/spaceVouchers.ts`, add to the `SpaceVoucherRow` interface after `stage`:

```ts
  /** The suite's deal team, as teammate ids — who this voucher belongs to.
   *  The index filters on it with `canSeeVoucher`, the same rule
   *  `/backoffice/vouchers` uses. */
  teamIds: string[]
```

In the `.map((child) => {` return object inside `spaceVouchers`, add:

```ts
        teamIds: voucherTeamIds(child),
```

Add the import at the top of the file:

```ts
import { voucherTeamIds } from './voucherRights'
```

- [ ] **Step 2: Filter the index rows**

In `src/routes/_shell/listings/$listingId/vouchers/index.tsx`, add the imports:

```ts
import { useMemo } from "react";
import { useCurrentUser } from "#/data/currentUser";
import { useCan } from "#/components/settings/users/useViewer";
import { canSeeVoucher, VIEW_OTHER_VOUCHERS } from "#/data/voucherRights";
```

Replace the two lines that read the rows:

```ts
  const rows = spaceVouchers(listingId);
  const total = rows.reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0);
```

with:

```ts
  // Scoped before the total is footed, so the header's figure and the rows
  // agree: a broker who works one suite must not read the building's whole
  // commission off a sum they cannot break down. Same rule and same functions
  // as /backoffice/vouchers — this index simply never asked.
  const viewerSeat = useCurrentUser((s) => s.id);
  const canViewOthers = useCan(VIEW_OTHER_VOUCHERS);
  const all = spaceVouchers(listingId);
  const rows = useMemo(
    () => all.filter((r) => canSeeVoucher(r.teamIds, viewerSeat, canViewOthers)),
    [all, viewerSeat, canViewOthers],
  );
  const total = rows.reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0);
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Run the full suite**

Run: `bun --bun run test`

Expected: PASS. If a test asserts a `SpaceVoucherRow` shape with `toEqual`, add `teamIds` to its expectation rather than loosening the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/data/spaceVouchers.ts "src/routes/_shell/listings/\$listingId/vouchers/index.tsx"
git commit -m "feat(vouchers): a building's index shows only the suites whose money you may see"
```

---

### Task 5: The Spaces roster locks the rows it cannot open

**Files:**
- Modify: `src/routes/_shell/listings/$listingId/spaces.tsx`

**Interfaces:**
- Consumes: `useOpenableSpaces(shellId)` from Task 2.
- Produces: nothing later tasks depend on.

A locked row keeps its label, square footage and lease rate — all facts about the *unit*, drawn from `Property.units`, which anyone with the building's marketing already has. It loses its link, its chevron, and its stage control.

- [ ] **Step 1: Add the imports**

In `src/routes/_shell/listings/$listingId/spaces.tsx`:

```ts
import { canAddSpaces, isLeaseParent, dealStageLabel } from "#/data/dealShape";
import { STATUS_COLORS } from "#/components/properties/propertyDisplay";
import { useOpenableSpaces } from "#/components/deals/useDealAccess";
```

(`canAddSpaces, isLeaseParent` is an existing import — add `dealStageLabel` to it rather than writing a second line. `StatusPill` is already imported from `#/components/deals/DealStageBadge`.)

- [ ] **Step 2: Teach `SuiteStatusControl` about a locked row**

Replace `SuiteStatusControl` (`spaces.tsx:37-61`):

```tsx
function SuiteStatusControl({ row, locked }: { row: SuiteRow; locked: boolean }) {
  const deal = row.dealId ? getListing(row.dealId) : null;
  if (!deal) {
    return (
      // 14px, not the pill's 12px default: this sits in the same column as the
      // stage control on the deal rows above, and those read at body size.
      <StatusPill color="var(--stage-inactive)" dot={false} fontSize={14}>
        {row.status}
      </StatusPill>
    );
  }
  if (locked) {
    // A suite someone else works. You may know it is under contract — that is
    // the building's business — but you may not move it, and the control is
    // what would say otherwise. Dotted, unlike the occupancy pill above: this
    // suite *is* on the ladder, it is just not yours to move.
    return (
      <StatusPill color={STATUS_COLORS[deal.status]} fontSize={14}>
        {dealStageLabel(deal.status, "space")}
      </StatusPill>
    );
  }
  return (
    // The row itself is a Link to the space, so a click meant for the stage
    // control must not also navigate. Same guard `DealCard` puts around its
    // action slot. The menu renders in a portal, so item clicks never reach here.
    <span
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <DealStageSelect listing={deal} />
    </span>
  );
}
```

- [ ] **Step 3: Give `SuiteRowItem` the locked shape**

Replace `SuiteRowItem` (`spaces.tsx:156-210`):

```tsx
function SuiteRowItem({
  row,
  listingId,
  canAddSpace,
  canOpen,
  onStartDeal,
}: {
  row: SuiteRow;
  listingId: string;
  canAddSpace: boolean;
  /** Whether this viewer may open the suite's deal. False locks the row. */
  canOpen: boolean;
  onStartDeal: (unitId: string) => void;
}) {
  const locked = row.dealId != null && !canOpen;
  const shared = (
    <>
      <span className="fw-semibold">{row.label}</span>
      <span className="text-muted">{row.sqft.toLocaleString()} SF</span>
      <span className="text-muted">
        {row.leaseRate != null ? `$${row.leaseRate} ${row.leaseRateUnits}` : ""}
      </span>
      <span className="ms-auto d-flex align-items-center gap-3">
        <SuiteStatusControl row={row} locked={locked} />
      </span>
    </>
  );

  // A suite with a deal is a link to that deal's page. A suite without one is
  // not — there is nowhere to go, so the row carries whatever action it does
  // support instead. A suite worked by somebody else is the third case: there
  // is somewhere to go and this viewer may not go there, so the row keeps the
  // building's own facts about the unit and drops the chevron that would
  // promise a door.
  if (row.dealId && canOpen) {
    return (
      <Link
        to="/listings/$listingId/spaces/$spaceId/overview"
        params={{ listingId, spaceId: row.dealId }}
        className="d-flex align-items-center gap-3 border rounded p-3 text-decoration-none text-body"
      >
        {shared}
        <FontAwesomeIcon icon={faAngleRight} className="text-muted" />
      </Link>
    );
  }

  return (
    <div className="d-flex align-items-center gap-3 border rounded p-3">
      {shared}
      {locked ? null : row.status === "Occupied" ? (
        <SuiteTenant row={row} shellId={listingId} />
      ) : (
        canAddSpace && (
          <Button variant="outline" onClick={() => onStartDeal(row.unitId)}>
            Start a deal
          </Button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 4: Resolve and pass `canOpen`**

In `SpacesTab`, add below `const rows = buildingSuites(listingId);`:

```tsx
  const openableSpaces = useOpenableSpaces(listingId);
```

Then at every `<SuiteRowItem …/>` render site in this file, add the prop:

```tsx
              canOpen={row.dealId == null || openableSpaces.has(row.dealId)}
```

A suite with no deal is never locked — there is nothing to be locked out of — which is why the `row.dealId == null` case reads as open.

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`

Expected: no errors. If it reports a missing `canOpen`, a `SuiteRowItem` render site was missed — `grep -n "SuiteRowItem" "src/routes/_shell/listings/\$listingId/spaces.tsx"` finds them all.

- [ ] **Step 6: Run the full suite**

Run: `bun --bun run test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/routes/_shell/listings/\$listingId/spaces.tsx"
git commit -m "feat(spaces): a suite you don't work shows its stage and stops being a door"
```

---

### Task 6: The space header gets a real access cluster

**Files:**
- Modify: `src/components/deals/DealHeroAccessAvatars.tsx`
- Modify: `src/components/deals/SpaceDetailHeader.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (Task 3 is what makes `useDealShares(space.id)` empty, so run this after it).
- Produces: `DealHeroAccessAvatars({ listing, manage }: { listing: Listing; manage?: boolean })` — `manage` defaults to `true`, so the building header is untouched.

- [ ] **Step 1: Add the `manage` prop**

In `src/components/deals/DealHeroAccessAvatars.tsx`, extend the doc comment and the signature:

```tsx
/**
 * The deal header's access cluster — the same shape the contact hero uses.
 *
 * The creator stands alone with an offset ring: they opened the deal, and that
 * doesn't change hands. Everyone else who can open it stacks into an
 * overlapping group beside them.
 *
 * `manage` is false on a space. Access to a suite is its broker team plus
 * whoever holds the building — neither is granted here, so a gear button would
 * open a modal with nothing to change. The cluster still identifies the people;
 * the avatars simply stop being buttons.
 */
export function DealHeroAccessAvatars({
  listing,
  manage = true,
}: {
  listing: Listing;
  /** False on a space: sharing lives on the building, so there is nothing to manage. */
  manage?: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const creator = dealCreator(listing);
  const team = dealTeamBrokers(listing);
  const { shares } = useDealShares(listing.id);
  // Undefined rather than a no-op: `HeroAccessAvatar` reads it to decide whether
  // the avatar is a button at all, and an avatar that looks clickable and does
  // nothing is worse than one that doesn't.
  const open = manage ? () => setManageOpen(true) : undefined;
  // A share row means the viewer is a guest on this deal, not on its team. Guests
  // read the access list; they don't hand it out.
  const readOnly = shares.some((s) => s.member.id === viewerId());
  const actionLabel = readOnly ? "see who has access" : "manage access";
```

- [ ] **Step 2: Make the gear and the modal conditional**

Still in `DealHeroAccessAvatars`, wrap the trailing `<Tooltip>` and `<ManageDealAccessModal>` so both disappear together:

```tsx
      {manage && (
        <>
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  appearance="muted"
                  size="icon-sm"
                  aria-label={readOnly ? "See who has access" : "Manage access"}
                  onClick={open}
                  className="hero-access__btn"
                >
                  <FontAwesomeIcon icon={faUserGear} />
                </Button>
              }
            />
            <Tooltip.Content>
              {readOnly ? "Who has access" : "Manage access"}
            </Tooltip.Content>
          </Tooltip>

          <ManageDealAccessModal
            listing={listing}
            open={manageOpen}
            onOpenChange={setManageOpen}
            readOnly={readOnly}
          />
        </>
      )}
```

Leave the three `onOpenShare={open}` props on the avatars exactly as they are — `open` is now `undefined` when `manage` is false, which is precisely what `HeroAccessAvatar` wants.

- [ ] **Step 3: Put the cluster in the space header**

In `src/components/deals/SpaceDetailHeader.tsx`, add the import:

```tsx
import { DealHeroAccessAvatars } from "#/components/deals/DealHeroAccessAvatars";
```

Then in the controls row (`SpaceDetailHeader.tsx:183`), add the cluster as the first child, so the people lead the row the same way they do on the building header:

```tsx
          <div className="d-flex align-items-center gap-3 flex-shrink-0">
            <DealHeroAccessAvatars listing={space} manage={false} />
            <div className="d-flex align-items-center gap-2">
              <DealStageSelect listing={space} />
            </div>
```

Update the comment directly above that `<div>` — it currently ends "…so neither of the building menu's two items has a space equivalent yet." Append:

```
                The access cluster leads it, as on the building: the same people,
                resolved from this suite's own broker team rather than the
                building's. No gear — sharing is the building's, and a suite has
                nothing of its own to hand out.
```

- [ ] **Step 4: Remove the fake avatar overlay**

Still in `SpaceDetailHeader.tsx`, delete the overlay `<div>` around `<AvatarGroup>` inside the thumbnail block:

```tsx
            <div className="position-absolute" style={{ right: 6, bottom: 6 }}>
              <AvatarGroup seed={seed} size="default" />
            </div>
```

Then:
- Drop the `import { AvatarGroup } from "#/components/properties/AvatarGroup";` line. Do **not** delete `AvatarGroup.tsx` — the property card still uses it.
- Delete `const seed = hash(space.id);` and the `hash` import if nothing else in the file uses either. Check with `grep -n "seed\|hash" src/components/deals/SpaceDetailHeader.tsx` before deleting.
- The thumbnail `<div>` keeps `position-relative` only if something else is still absolutely positioned inside it; if not, drop that class too.
- Trim the thumbnail comment: the sentence about avatars showing "who can see *this* suite" now describes the cluster in the controls row, not the thumbnail, so remove that clause and keep the rest (the per-suite photo rationale and the `getPhotoUrl` note).

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`

Expected: no errors. An unused-import error here is the signal that Step 4 missed a line.

- [ ] **Step 6: Run the full suite**

Run: `bun --bun run test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/deals/DealHeroAccessAvatars.tsx src/components/deals/SpaceDetailHeader.tsx
git commit -m "feat(spaces): a suite's header shows the brokers who actually work it"
```

---

### Task 7: Verify it in the browser

**Files:**
- No source changes expected. Any fix found here is a follow-up commit on the task that owns the file.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

This repo does not carry a committed E2E suite — do not add `@playwright/test` or `playwright.config.ts`. Drive the `playwright` MCP server interactively. The job is to catch **breakage**: the page loads, no console errors, the right state renders. Design is Joel's call; make no unsolicited visual changes.

- [ ] **Step 1: Start the dev server**

```bash
bun --bun run dev
```

Serves `http://localhost:3000`. Leave it running.

- [ ] **Step 2: Open a lease building and note its spaces**

Navigate to `/listings`, then open a lease shell (the seed has two; their cards show a Spaces roll-up).

Gotchas that have each burned a session:
- Never use `waitUntil: "networkidle"` — Vite's HMR websocket never closes and it always times out. Use `domcontentloaded` plus `browser_wait_for` on specific text.
- `browser_navigate` returns before the app hydrates; its snapshot shows only `main > status "Loading"`. Always follow it with `browser_wait_for` on text unique to the destination.
- Scope selectors to `main.app-shell__main` — TanStack devtools inject their own DOM, and a hidden `<h3>Tanstack Router</h3>` will match a bare heading query.
- Lists are Blueprint cards, not tables — `tbody tr` matches nothing on `/listings`.
- Snapshots run ~580 lines. They are written to `.playwright-mcp/`; grep them rather than reading whole.

Record which suite each broker works — the Spaces roster names them, and the next steps need two brokers on different suites.

- [ ] **Step 3: Check each seat against the spec's table**

Use the account menu's **Viewing as** to switch seats. For each of these, confirm the spec table's row:

1. **A broker who works one suite.** The building opens; its Vouchers section lists only their suite; the Spaces roster shows sibling suites with a stage pill, no chevron, and no navigation on click; their own suite opens fully. `/listings` shows the building and their suite, and no sibling suite card.
2. **A broker on the shell's team who works no suite.** The building opens with marketing; there is **no** Vouchers item in the sidebar. Every suite page opens at marketing only — no Voucher, no Invoices.
3. **Maya Brooks (Marketing Assistant).** A building shared with her opens; every suite under it opens at marketing; no Voucher anywhere; no gear button on any space header.
4. **Tessa Nakamura (Back Office Manager).** The building's Vouchers index lists every suite.

- [ ] **Step 4: Walk past the sidebar**

Type a blocked URL directly — e.g. `/listings/<shellId>/spaces/<spaceId>/financials` as the broker from case 1, using a **sibling** suite's id. `DealAccessGate` must land you on that space's Overview, or on the no-access Empty state, and must never flash the voucher for a frame.

- [ ] **Step 5: Check the console**

Run `browser_console_messages`. Expected: no errors and no React warnings from the pages touched. A `DataCloneError` from the dev server is the mask this repo puts over a Sass compile failure — if one appears, read the terminal running `dev`, not the browser.

- [ ] **Step 6: Close the browser**

Run `browser_close`. It does not exit on its own — leaving it running orphans ~8 Chrome processes and a temp profile in `/var/folders/`. Leave the MCP **server** running; it is meant to be long-lived.

- [ ] **Step 7: Report**

Report what rendered per seat, quoting the actual state. If a case disagrees with the spec's table, say which, and fix it in the file that owns it before claiming the plan is done.

---

## Done

Once Task 7 reports clean, hand off to Joel for design review. He opens the PR through `/ship`; the spec and this plan are deleted in a `chore(docs):` commit that goes out with the branch, and anything worth keeping — chiefly anything tried and reverted — goes into the PR body first.
