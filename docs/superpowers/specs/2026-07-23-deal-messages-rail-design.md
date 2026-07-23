# Deal Messages Rail — Design

**Date:** 2026-07-23
**Status:** Approved, pending implementation plan

## Summary

Add a **Messages** panel to the deal's **Activities** tab: a right-hand chat rail
where teammates can leave messages to each other on a deal. It mirrors the
two-column layout of the Overview tab (main content + right rail), but the rail
is wider (~420px) to give the chat room to breathe. Messages persist to the deal
store (Zustand + IndexedDB), so they survive reloads.

## Current state

- **Activities tab** (`src/routes/_shell/listings/$listingId/activities.tsx`)
  renders `DealActivity` (in `DealStubs.tsx`) full-width — a merged feed of the
  deal's logged activities and its stage history.
- **Overview tab** (`overview.tsx`) uses a two-column pattern: a `flex-grow-1`
  main column and a fixed-width right rail (`DealContextRail`, ~340px) that is
  `d-none d-xl-block border-start`.
- The data layer already defines `DealMessage` (`{ id, author, text, timestamp }`)
  in `src/data/types.ts` and a `messages: DealMessage[]` field on `Listing`.
  Seed data (`seed.ts`) currently generates 0–2 messages per deal using random
  faker names + lorem text. **Nothing renders or writes these today.**
- `CURRENT_USER` (`src/data/teammates.ts`) is the signed-in user — John Whitfield,
  initials "JW". `TEAMMATES` is the roster of other people.
- Store mutations follow the `addDealDocument` → `patchListing` → `persist()`
  pattern in `store.ts`. Components read reactively via
  `useDataStore((s) => s.listings.get(listingId))`.

## Design

### Layout

The Activities route changes from full-width to a two-column layout matching
Overview, but with a wider rail:

- Left: existing `DealActivity` feed, `flex-grow-1`, `minWidth: 0`.
- Right: new `DealMessagesRail`, fixed `width: 420`, `flex-shrink-0`,
  `d-none d-xl-block border-start`.

Below the `xl` breakpoint the rail is hidden (same responsive rule as Overview).

### `DealMessagesRail` component

New file: `src/components/deals/DealMessagesRail.tsx`.

Structure (full-height flex column so the composer pins to the bottom):

1. **Header** — "Messages" title (matches the rail section heading style used in
   `DealContextRail`, e.g. `h6 fw-semibold`).
2. **Message list** — scrollable (`overflow-y: auto`, `flex-grow-1`), rendered as
   chat bubbles:
   - **Current user's own messages** (author === `CURRENT_USER.name`):
     right-aligned, primary-tinted bubble, no avatar.
   - **Teammates' messages**: left-aligned, with avatar (initials fallback),
     author name, and a relative/short timestamp.
   - Auto-scroll to the newest message on mount and after sending.
   - **Empty state** via Blueprint `Empty` when the deal has no messages.
3. **Composer** — pinned to the bottom (`border-top`, padding):
   - A text input (Blueprint `Input` or `Textarea`) + a send `Button`.
   - **Enter** sends; empty/whitespace-only input is ignored.
   - On send: call `addDealMessage(listingId, { author: CURRENT_USER.name, text })`,
     then clear the input.

The component subscribes to the deal reactively:
`const listing = useDataStore((s) => s.listings.get(listingId))` (or reads
`listing.messages` from a passed-in listing that itself comes from a reactive
read) so newly sent messages appear immediately.

### Store action

Add to `src/data/store.ts`, modeled on `addDealDocument`:

```ts
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

(Use whatever id/uuid helper the codebase already uses if `crypto.randomUUID`
isn't the local convention.)

### Seed update

Reseed `messages` in `seed.ts` so the chat reads convincingly:

- Draw authors from `CURRENT_USER` + `TEAMMATES` (real names/initials).
- Use a small pool of realistic, deal-related lines (e.g. "Sent the OM over to
  the buyer's counsel.", "Any update on the estoppel?", "Confirmed the tour for
  Thursday at 2.").
- Include at least one message from the current user on some deals so the
  right-aligned bubble style is visible in the demo.
- Keep counts modest (e.g. 2–5) and timestamps recent, ordered chronologically.

## Components / boundaries

- `DealMessagesRail` — presentational + composer; depends on `addDealMessage`,
  `CURRENT_USER`, and the deal's `messages`. Self-contained and independently
  understandable.
- `addDealMessage` — single store mutation, mirrors existing action shape.
- Activities route — only changes layout (wraps `DealActivity` + adds the rail).

## Out of scope (YAGNI)

- Editing/deleting messages.
- Read receipts, typing indicators, reactions, @-mentions, attachments.
- Real-time/multi-user sync — this is a single-session prototype.
- Notifications or unread badges elsewhere in the app.

## Testing

- Manual: send a message, confirm it appears right-aligned and persists across a
  reload; confirm seeded teammate messages render left-aligned with avatars;
  confirm empty state on a deal with no messages.
- No new unit tests required unless `addDealMessage` warrants one alongside the
  existing store/action tests.
