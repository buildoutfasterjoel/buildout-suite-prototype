# Deal Messages Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent "Messages" chat rail to the deal's Activities tab so teammates can leave messages on a deal.

**Architecture:** The Activities route gains a two-column layout mirroring Overview — the existing `DealActivity` feed on the left, a new ~420px `DealMessagesRail` on the right. The rail reads the deal's `messages` reactively from the Zustand store and appends new ones through a new `addDealMessage` action (following the existing `addDealDocument` → `patchListing` → `persist()` pattern). Seed data is reworked to use real teammate authors.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Zustand (`useDataStore`) · Blueprint React components · FontAwesome Pro · Vitest.

## Global Constraints

- Package manager is Bun; run everything with `bun --bun run …`.
- All UI uses Blueprint React components imported from the `ui` subpath; spacing/layout via Bootstrap utility classes.
- FontAwesome icons default to `pro-regular`. Never pass `fixedWidth` to `FontAwesomeIcon`.
- IDs generated with `crypto.randomUUID()`; timestamps as `new Date().toISOString()`.
- The signed-in user is `CURRENT_USER` (John Whitfield) from `src/data/teammates.ts`.
- `DealMessage` shape is fixed: `{ id: string; author: string; text: string; timestamp: string }`.
- Do not restructure unrelated component visuals.

---

### Task 1: `addDealMessage` store action

**Files:**
- Modify: `src/data/store.ts` (add action near `addDealDocument` ~line 193; add `DealMessage` to the `./types` import block at lines 1-12)
- Test: `src/data/addDealMessage.test.ts` (create)

**Interfaces:**
- Consumes: `useDataStore` (existing), `patchListing` (private, existing in `store.ts`), `DealMessage`, `Listing` types.
- Produces: `addDealMessage(listingId: string, message: { author: string; text: string }): Listing | undefined` — appends a `DealMessage` (id + timestamp stamped internally) to `listing.messages`, persists, and returns the updated `Listing`, or `undefined` if the listing is missing.

- [ ] **Step 1: Write the failing test**

Create `src/data/addDealMessage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { addDealMessage } from "#/data/store";

function anyDealId(): string {
  const first = [...useDataStore.getState().listings.values()][0];
  if (!first) throw new Error("no seeded listings");
  return first.id;
}

describe("addDealMessage", () => {
  it("appends a message with a generated id and timestamp", () => {
    const id = anyDealId();
    const before = useDataStore.getState().listings.get(id)!.messages.length;

    const updated = addDealMessage(id, { author: "John Whitfield", text: "Hello team" });

    expect(updated).toBeDefined();
    const messages = useDataStore.getState().listings.get(id)!.messages;
    expect(messages.length).toBe(before + 1);
    const last = messages[messages.length - 1];
    expect(last.author).toBe("John Whitfield");
    expect(last.text).toBe("Hello team");
    expect(last.id).toBeTruthy();
    expect(last.timestamp).toBeTruthy();
  });

  it("returns undefined for an unknown listing", () => {
    expect(addDealMessage("does-not-exist", { author: "X", text: "Y" })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test -- addDealMessage`
Expected: FAIL — `addDealMessage` is not exported from `store.ts`.

- [ ] **Step 3: Add `DealMessage` to the type import in `store.ts`**

In the `import type { … } from './types'` block (lines 1-12), add `DealMessage` to the list (e.g. after `DealDocument`):

```ts
  DealDocument,
  DealMessage,
} from './types'
```

- [ ] **Step 4: Implement the action**

Add immediately after `addDealDocument` (~line 197) in `src/data/store.ts`:

```ts
/** Append a message to a deal's Messages thread (shows in the Activities-tab rail). */
export function addDealMessage(
  listingId: string,
  message: { author: string; text: string },
): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  const full: DealMessage = {
    id: crypto.randomUUID(),
    author: message.author,
    text: message.text,
    timestamp: new Date().toISOString(),
  }
  return patchListing(listingId, { messages: [...existing.messages, full] })
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun --bun run test -- addDealMessage`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add src/data/store.ts src/data/addDealMessage.test.ts
git commit -m "feat(deals): addDealMessage store action"
```

---

### Task 2: `DealMessagesRail` component

**Files:**
- Create: `src/components/deals/DealMessagesRail.tsx`

**Interfaces:**
- Consumes: `addDealMessage` (Task 1); `useDataStore` from `#/data/dataStore`; `CURRENT_USER` from `#/data/teammates`; `initials`, `formatDateTime` from `./dealDisplay`; Blueprint `Avatar`, `Button`, `Input`, `InputGroup`, `Empty`; `faPaperPlaneTop` (pro-regular) or `faMessage`.
- Produces: `export function DealMessagesRail({ listingId }: { listingId: string }): JSX.Element` — a full-height flex column (header + scrollable bubble list + bottom composer).

- [ ] **Step 1: Create the component**

Create `src/components/deals/DealMessagesRail.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlaneTop, faComments } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { addDealMessage } from "#/data/store";
import { CURRENT_USER } from "#/data/teammates";
import { initials, formatDateTime } from "./dealDisplay";
import type { DealMessage } from "#/data/types";

/** One chat row — current user's own messages align right in a tinted bubble. */
function MessageRow({ message }: { message: DealMessage }) {
  const mine = message.author === CURRENT_USER.name;
  if (mine) {
    return (
      <div className="d-flex flex-column align-items-end">
        <div
          className="px-3 py-2 rounded bg-primary-subtle text-body"
          style={{ maxWidth: "85%", borderRadius: 12 }}
        >
          {message.text}
        </div>
        <div className="text-muted fs-small mt-1">
          {formatDateTime(message.timestamp)}
        </div>
      </div>
    );
  }
  return (
    <div className="d-flex align-items-start gap-2">
      <Avatar size="sm" className="flex-shrink-0 mt-1">
        <Avatar.Fallback>{initials(message.author)}</Avatar.Fallback>
      </Avatar>
      <div style={{ minWidth: 0, maxWidth: "85%" }}>
        <div className="d-flex align-items-baseline gap-2">
          <span className="fw-semibold text-truncate">{message.author}</span>
          <span className="text-muted fs-small flex-shrink-0">
            {formatDateTime(message.timestamp)}
          </span>
        </div>
        <div
          className="px-3 py-2 rounded bg-body-secondary text-body mt-1"
          style={{ borderRadius: 12 }}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}

/**
 * Right-hand "Messages" rail on the Activities tab — a per-deal chat thread with
 * a composer pinned to the bottom. Reads messages reactively so sends appear at
 * once and survive reloads (persisted through addDealMessage).
 */
export function DealMessagesRail({ listingId }: { listingId: string }) {
  const messages =
    useDataStore((s) => s.listings.get(listingId)?.messages) ?? [];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    addDealMessage(listingId, { author: CURRENT_USER.name, text });
    setDraft("");
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="px-3 py-3 border-bottom">
        <h6 className="mb-0 fw-semibold">Messages</h6>
      </div>

      <div
        ref={listRef}
        className="flex-grow-1 overflow-y-auto d-flex flex-column gap-3 p-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <Empty className="py-6">
            <Empty.Media>
              <FontAwesomeIcon icon={faComments} aria-hidden />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No messages yet</Empty.Title>
              Start the conversation for this deal.
            </Empty.Content>
          </Empty>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>

      <div className="p-3 border-top">
        <InputGroup>
          <Input
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            variant="primary"
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Send message"
          >
            <FontAwesomeIcon icon={faPaperPlaneTop} />
          </Button>
        </InputGroup>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check / build the module**

Run: `bun --bun run build`
Expected: builds with no TypeScript errors referencing `DealMessagesRail`. If `faPaperPlaneTop` is unresolved in `pro-regular`, substitute `faPaperPlane` and rebuild.

- [ ] **Step 3: Commit**

```bash
git add src/components/deals/DealMessagesRail.tsx
git commit -m "feat(deals): DealMessagesRail chat component"
```

---

### Task 3: Wire the rail into the Activities route

**Files:**
- Modify: `src/routes/_shell/listings/$listingId/activities.tsx`

**Interfaces:**
- Consumes: `DealMessagesRail` (Task 2), existing `DealActivity` from `#/components/deals/DealStubs`, `getStore` from `#/data/store`.
- Produces: two-column Activities layout (feed left, messages rail right).

- [ ] **Step 1: Replace the route component with the two-column layout**

Replace the whole file contents of `src/routes/_shell/listings/$listingId/activities.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealActivity } from "#/components/deals/DealStubs";
import { DealMessagesRail } from "#/components/deals/DealMessagesRail";

export const Route = createFileRoute("/_shell/listings/$listingId/activities")({
  component: ActivitiesRoute,
});

function ActivitiesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <DealActivity listing={listing} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-flex border-start"
        style={{ width: 420 }}
      >
        <DealMessagesRail listingId={listingId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify wiring**

Run: `bun --bun run build`
Expected: builds clean, no errors.

- [ ] **Step 3: Manual check (ask the user to verify in `bun --bun run dev`)**

Open a deal → Activities tab. Confirm: feed on the left, Messages rail on the right at ≥xl width; seeded teammate messages render left-aligned with avatars; typing a message and pressing Enter (or clicking send) shows it right-aligned in a tinted bubble; the list scrolls to the newest; a page reload keeps sent messages.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/_shell/listings/$listingId/activities.tsx"
git commit -m "feat(deals): add Messages rail to Activities tab"
```

---

### Task 4: Reseed deal messages from the teammate roster

**Files:**
- Modify: `src/data/seed.ts` (message generation ~lines 1179-1187; import at line 36)

**Interfaces:**
- Consumes: `faker`, `TEAMMATES` (already imported line 36), `CURRENT_USER` (add to import).
- Produces: realistic `messages` arrays authored by real teammates + the current user.

- [ ] **Step 1: Add `CURRENT_USER` to the teammates import**

Change line 36 of `src/data/seed.ts` from:

```ts
import { TEAMMATES, type AccessTier, type ContactShare } from './teammates'
```

to:

```ts
import { CURRENT_USER, TEAMMATES, type AccessTier, type ContactShare } from './teammates'
```

- [ ] **Step 2: Replace the message generation block**

Replace the existing block (~lines 1179-1187):

```ts
    const messages = Array.from(
      { length: faker.number.int({ min: 0, max: 2 }) },
      () => ({
        id: faker.string.uuid(),
        author: `${faker.person.firstName()} ${faker.person.lastName()}`,
        text: faker.lorem.sentence(),
        timestamp: faker.date.recent({ days: 30 }).toISOString(),
      }),
    )
```

with:

```ts
    const MESSAGE_LINES = [
      'Sent the OM over to the buyer’s counsel this morning.',
      'Any update on the estoppel certificates?',
      'Confirmed the tour for Thursday at 2pm.',
      'Seller countered at asking minus 3%. Discussing internally.',
      'Loan commitment letter is in — uploading to Files now.',
      'Can we get the T-12 refreshed before the call?',
      'Buyer’s inspection is scheduled for next week.',
      'Title came back clean, no surprises.',
      'Pushing the LOI deadline to Friday per their request.',
      'Great meeting today — momentum is good on this one.',
    ]
    const messageAuthors = [CURRENT_USER, ...TEAMMATES]
    const messageCount = faker.number.int({ min: 2, max: 5 })
    const messages = Array.from({ length: messageCount }, () => {
      const author = faker.helpers.arrayElement(messageAuthors)
      return {
        id: faker.string.uuid(),
        author: author.name,
        text: faker.helpers.arrayElement(MESSAGE_LINES),
        timestamp: faker.date.recent({ days: 30 }).toISOString(),
      }
    }).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
```

- [ ] **Step 3: Build to verify the seed compiles**

Run: `bun --bun run build`
Expected: builds clean.

- [ ] **Step 4: Manual check (ask the user)**

In `bun --bun run dev`, use the demo-reset control (GlobalNavbar reset) or clear IndexedDB so the seed regenerates, then open a deal's Activities tab and confirm messages show real teammate names, chronological order, and at least some deals include a right-aligned message from John Whitfield.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(deals): seed deal messages from teammate roster"
```

---

## Self-Review

- **Spec coverage:** Layout/two-column rail (Task 3) · `DealMessagesRail` component with messenger bubbles, empty state, auto-scroll, composer + Enter-to-send (Task 2) · `addDealMessage` store action (Task 1) · teammate reseed (Task 4). All spec sections covered.
- **Placeholder scan:** No TBD/TODO; all code shown in full.
- **Type consistency:** `addDealMessage(listingId, { author, text })` signature identical across Tasks 1–2; `DealMessage` shape matches `types.ts`; `CURRENT_USER.name` used for author identity in both the component and seed.
- **Note:** If `faPaperPlaneTop` isn't in the installed `pro-regular` set, fall back to `faPaperPlane` (Task 2 Step 2 covers this). Message persistence relies on `patchListing` calling `persist()` (existing behavior).
