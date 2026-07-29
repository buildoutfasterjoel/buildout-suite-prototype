# Syndication Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the syndication modal so each channel card shows a status badge, publication dates, an expiration countdown, and outbound links — split into `direct` and `email` delivery groups so email channels never claim confirmed state.

**Architecture:** Four layers, each independently testable. `src/data/listingSyndication.ts` owns the delivery-aware model and deterministic generation. `syndicationDisplay.ts` holds the pure badge/meta-line logic (the trickiest branching, so it gets real unit tests). `SyndicationChannelCard.tsx` renders one channel. `SyndicationStatus.tsx` keeps the header widget and becomes the modal's group layout.

**Tech Stack:** React 19 · TypeScript · Blueprint React (`@buildoutinc/blueprint-react`) · Bootstrap 5 utility classes · FontAwesome Pro (`pro-regular`) · Vitest

**Spec:** `docs/superpowers/specs/2026-07-29-syndication-modal-redesign-design.md`

## Global Constraints

- **Package manager is Bun.** Always `bun --bun run <script>`. Typecheck with `bunx tsc --noEmit`.
- **`vite build` does NOT type-check.** `bunx tsc --noEmit` is the type gate.
- **Do NOT use Playwright.** Verify with tsc + vitest; ask the user for visual confirmation.
- **Icons are `pro-regular`** by default (`pro-duotone` only for Alert/Banner). **Never pass `fixedWidth`** — it is deprecated in this codebase.
- **Never add margin utilities to an icon inside a Blueprint `Badge`** — Badge already applies flex gap.
- **No `clsx`/`classnames` in this project.** Compose classNames with template literals.
- **Blueprint `Field` parts require `Field.Root`.** Not used here, but do not introduce standalone `Field.Label`/`Field.Description`.
- **Tests are pure-logic `.test.ts` only.** There is no `test` block in `vite.config.ts` (default node environment) and zero `.test.tsx` files exist. Do **not** add jsdom or component-render tests; presentational work is verified by tsc and manual review.
- **Blueprint has no `info` theme color.** Informational states use the Seagull tokens added in Task 2.
- **Copy is verbatim from the spec.** The two disclaimers and all badge labels are exact strings.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/data/listingSyndication.ts` | Rewrite — delivery-aware roster, per-channel state/dates, anchored deterministic generation |
| `src/data/listingSyndication.test.ts` | Create — generator invariants and determinism |
| `src/main.scss` | Modify — add four `--channel-info-*` Seagull tokens |
| `src/components/listings/syndication/syndicationDisplay.ts` | Create — pure badge descriptors, timestamp formatter, meta-line segments |
| `src/components/listings/syndication/syndicationDisplay.test.ts` | Create — meta-line branching per state and delivery |
| `src/components/listings/syndication/SyndicationChannelCard.tsx` | Create — one channel card |
| `src/components/listings/SyndicationStatus.tsx` | Modify — header widget unchanged; modal body becomes two groups + disclaimers |

---

### Task 1: Delivery-aware syndication data model

**Files:**
- Modify: `src/data/listingSyndication.ts` (full rewrite of the 80-line file)
- Test: `src/data/listingSyndication.test.ts` (create)

**Interfaces:**
- Consumes: `hash(s: string): number` from `#/components/properties/propertyDisplay`; `Listing` from `#/data/types`.
- Produces:
  - `type SyndicationDelivery = "direct" | "email"`
  - `type DirectChannelState = "updated" | "pending" | "needs-attention" | "off" | "not-available"`
  - `type EmailChannelState = "update-sent" | "send-pending" | "off"`
  - `type SyndicationChannelState = DirectChannelState | EmailChannelState`
  - `interface SyndicationChannel { id, name, delivery, state, active, publishedAt, lastUpdatedAt, expiresInDays, adminUrl }`
  - `interface ListingSyndication { channels: SyndicationChannel[]; blockingIssues: string[] }`
  - `type SyndicationListing = Pick<Listing, "id" | "slug" | "publishedAt" | "dealType">`
  - `getListingSyndication(listing: SyndicationListing): ListingSyndication`
  - `SYNDICATION_NETWORK_NAMES: string[]` (kept — consumed by `listingWebsiteActivity.ts`)

**Note on the breaking change:** the old export was `networks`, not `channels`, and the old signature took `listingId: string`. `SyndicationStatus.tsx` is the only caller and is rewritten in Task 4 — it will not compile between Task 1 and Task 4. That is expected; Task 1's gate is vitest, and `bunx tsc --noEmit` becomes green again at Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/data/listingSyndication.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  getListingSyndication,
  SYNDICATION_NETWORK_NAMES,
  type SyndicationListing,
} from './listingSyndication'

/** A listing whose id survives the "no channels configured" branch (hash % 6 !== 0). */
function listingFor(id: string, publishedAt: string | null = '2026-07-20T15:00:00.000Z'): SyndicationListing {
  return { id, slug: 'oak-street-plaza', publishedAt, dealType: 'Sale' }
}

/** Ids that produce a populated roster — the generator returns [] for hash % 6 === 0. */
function populatedListings(): SyndicationListing[] {
  const found: SyndicationListing[] = []
  for (let i = 0; i < 60; i++) {
    const l = listingFor(`listing-${i}`)
    if (getListingSyndication(l).channels.length > 0) found.push(l)
  }
  return found
}

describe('roster', () => {
  it('exposes every channel name for the traffic-source pool', () => {
    expect(SYNDICATION_NETWORK_NAMES).toContain('CoStar')
    expect(SYNDICATION_NETWORK_NAMES).toContain('CommercialEdge Network')
    expect(SYNDICATION_NETWORK_NAMES).toHaveLength(8)
  })

  it('produces both delivery methods for a populated listing', () => {
    const { channels } = getListingSyndication(populatedListings()[0])
    expect(channels.filter((c) => c.delivery === 'direct')).toHaveLength(4)
    expect(channels.filter((c) => c.delivery === 'email')).toHaveLength(4)
  })
})

describe('determinism', () => {
  it('returns identical data for the same listing id', () => {
    const l = listingFor('stable-id')
    expect(getListingSyndication(l)).toEqual(getListingSyndication(l))
  })
})

describe('invariants', () => {
  it('never dates a channel before the listing went live', () => {
    const publishedAt = '2026-07-20T15:00:00.000Z'
    const anchor = new Date(publishedAt).getTime()
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.publishedAt) expect(new Date(c.publishedAt).getTime()).toBeGreaterThanOrEqual(anchor)
        if (c.lastUpdatedAt) expect(new Date(c.lastUpdatedAt).getTime()).toBeGreaterThanOrEqual(anchor)
      }
    }
  })

  it('reports no channel dates when the listing was never published', () => {
    for (let i = 0; i < 60; i++) {
      const { channels } = getListingSyndication(listingFor(`unpublished-${i}`, null))
      for (const c of channels) {
        expect(c.publishedAt).toBeNull()
        expect(c.lastUpdatedAt).toBeNull()
        expect(c.expiresInDays).toBeNull()
      }
    }
  })

  it('never gives an email channel a connection-health state', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'email') {
          expect(['update-sent', 'send-pending', 'off']).toContain(c.state)
        }
      }
    }
  })

  it('never gives an email channel an expiration or admin console', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'email') {
          expect(c.expiresInDays).toBeNull()
          expect(c.adminUrl).toBeNull()
        }
      }
    }
  })

  it('never marks an unavailable channel active', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.state === 'not-available') expect(c.active).toBe(false)
      }
    }
  })

  it('only ever uses off or not-available for an inactive channel', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (!c.active) expect(['off', 'not-available']).toContain(c.state)
      }
    }
  })

  it('builds admin URLs on a Buildout host, scoped to the listing slug', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.adminUrl) {
          expect(c.adminUrl).toBe(`https://admin.buildout.com/syndication/${c.id}/${l.slug}`)
        }
      }
    }
  })

  it('covers every direct state across the id space', () => {
    const seen = new Set<string>()
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'direct') seen.add(c.state)
      }
    }
    for (const state of ['updated', 'pending', 'needs-attention', 'off', 'not-available']) {
      expect(seen).toContain(state)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/data/listingSyndication.test.ts`
Expected: FAIL — `getListingSyndication` still returns `{ networks }` and takes a string, and `SyndicationListing` is not exported.

- [ ] **Step 3: Rewrite the module**

Replace the entire contents of `src/data/listingSyndication.ts`:

```ts
import { hash } from "#/components/properties/propertyDisplay";
import type { Listing } from "#/data/types";

/**
 * How a listing reaches a channel. `direct` channels are real integrations with
 * confirmable state; `email` channels receive an email Buildout sends on the
 * broker's behalf — there is no connection to report on, so the most we can
 * honestly say is when we last sent.
 */
export type SyndicationDelivery = "direct" | "email";

/** Direct integrations report confirmable state. */
export type DirectChannelState =
  | "updated" // on, pushed, data current
  | "pending" // on, queued, not yet confirmed by the channel
  | "needs-attention" // credential or mapping problem
  | "off" // healthy connection, syndication turned off
  | "not-available"; // no connection configured for this account

/**
 * Email channels get no "connected" and no "error": Buildout sends an email and
 * the channel decides what to do with it.
 */
export type EmailChannelState = "update-sent" | "send-pending" | "off";

export type SyndicationChannelState = DirectChannelState | EmailChannelState;

interface ChannelDefinition {
  id: string;
  name: string;
  delivery: SyndicationDelivery;
}

/**
 * Fixed roster. Delivery method is a property of the channel, not something
 * derived per listing.
 */
const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  { id: "commercialedge-network", name: "CommercialEdge Network", delivery: "direct" },
  { id: "rcm1-marketplace", name: "RCM1 Marketplace", delivery: "direct" },
  { id: "apartmentbuildings-com", name: "apartmentbuildings.com", delivery: "direct" },
  { id: "brevitas", name: "Brevitas", delivery: "direct" },
  { id: "costar", name: "CoStar", delivery: "email" },
  { id: "loopnet", name: "LoopNet", delivery: "email" },
  { id: "crexi", name: "Crexi", delivery: "email" },
  { id: "ten-x", name: "Ten-X", delivery: "email" },
];

/**
 * Every channel name, flattened. Also consumed by `listingWebsiteActivity` as a
 * traffic-source pool, so it must stay exported.
 */
export const SYNDICATION_NETWORK_NAMES: string[] = CHANNEL_DEFINITIONS.map(
  (c) => c.name,
);

export interface SyndicationChannel {
  id: string;
  name: string;
  delivery: SyndicationDelivery;
  state: SyndicationChannelState;
  /** Whether syndication is currently turned on for this channel. */
  active: boolean;
  /** ISO timestamp the listing first reached this channel; null if it never has. */
  publishedAt: string | null;
  /** ISO timestamp of the most recent push (direct) or send (email). */
  lastUpdatedAt: string | null;
  /** Days until the channel drops the listing. Direct channels only. */
  expiresInDays: number | null;
  /** Deep link into the channel's admin console. Direct channels only. */
  adminUrl: string | null;
}

/** Deterministic per-listing syndication status. */
export interface ListingSyndication {
  /** Empty array means no channels are configured for this listing at all. */
  channels: SyndicationChannel[];
  /** Issues limiting syndication reach, e.g. missing syndicatable photos. */
  blockingIssues: string[];
}

/** The listing fields syndication needs — a full `Listing` satisfies this. */
export type SyndicationListing = Pick<
  Listing,
  "id" | "slug" | "publishedAt" | "dealType"
>;

const DAY_MS = 86_400_000;

const PHOTO_ISSUE =
  "Properties without syndicatable photos are not accepted by all partners and generate fewer leads. Check the appropriate boxes in the Media forms for any syndicatable photos you own.";

/**
 * A timestamp `days` and `minutes` after the listing went live. Returns null
 * when the listing was never published — a channel cannot have received a
 * listing that does not exist yet.
 */
function afterPublish(
  anchor: number | null,
  days: number,
  minutes: number,
): string | null {
  if (anchor == null) return null;
  return new Date(anchor + days * DAY_MS + minutes * 60_000).toISOString();
}

/**
 * Deterministic per-listing syndication status derived from the listing id, so
 * values stay stable across renders (same approach as `getListingTraffic`).
 * Dates are anchored to `listing.publishedAt` so no channel can claim it
 * published before the listing went live.
 */
export function getListingSyndication(
  listing: SyndicationListing,
): ListingSyndication {
  const h = hash(listing.id);

  if (h % 6 === 0) {
    return { channels: [], blockingIssues: [] };
  }

  const anchor = listing.publishedAt
    ? new Date(listing.publishedAt).getTime()
    : null;

  const channels: SyndicationChannel[] = CHANNEL_DEFINITIONS.map((def, i) => {
    const roll = (h >>> (i + 8)) % 5;
    const wantsActive = ((h >>> i) & 1) === 1;

    // Spread timestamps deterministically, always forward from the anchor.
    const firstDelay = (h >>> (i + 3)) % 3;
    const updateDelay = firstDelay + ((h >>> (i + 5)) % 5);
    const minutes = ((h >>> (i + 11)) % 96) * 15;

    if (def.delivery === "email") {
      const state: EmailChannelState = !wantsActive
        ? "off"
        : roll === 0
          ? "send-pending"
          : "update-sent";
      // An "off" channel may still have history from before it was paused.
      const everSent = state !== "off" || ((h >>> (i + 16)) & 1) === 1;
      return {
        ...def,
        state,
        active: wantsActive,
        publishedAt: everSent ? afterPublish(anchor, firstDelay, 0) : null,
        lastUpdatedAt: everSent
          ? afterPublish(anchor, updateDelay, minutes)
          : null,
        expiresInDays: null,
        adminUrl: null,
      };
    }

    const state: DirectChannelState =
      roll === 0
        ? "not-available"
        : !wantsActive
          ? "off"
          : roll === 1
            ? "needs-attention"
            : roll === 2
              ? "pending"
              : "updated";
    const active = state !== "not-available" && wantsActive;
    const everPublished =
      state !== "not-available" &&
      (state !== "off" || ((h >>> (i + 16)) & 1) === 1);
    const publishedAt = everPublished ? afterPublish(anchor, firstDelay, 0) : null;

    return {
      ...def,
      state,
      active,
      publishedAt,
      lastUpdatedAt: everPublished
        ? afterPublish(anchor, updateDelay, minutes)
        : null,
      // Nothing to expire until the listing actually reached the channel.
      expiresInDays: publishedAt ? 1 + ((h >>> (i + 20)) % 210) : null,
      adminUrl:
        state === "not-available"
          ? null
          : `https://admin.buildout.com/syndication/${def.id}/${listing.slug}`,
    };
  });

  const blockingIssues = h % 4 === 0 ? [PHOTO_ISSUE] : [];

  return { channels, blockingIssues };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/data/listingSyndication.test.ts`
Expected: PASS, all 11 tests.

If "covers every direct state across the id space" fails, the id space sampled in `populatedListings()` is too small — raise the loop bound from 60 to 200 rather than weakening the assertion.

- [ ] **Step 5: Confirm the traffic-source consumer still compiles**

Run: `bunx tsc --noEmit 2>&1 | grep listingWebsiteActivity`
Expected: no output. `SYNDICATION_NETWORK_NAMES` changed from a `readonly` tuple to `string[]`, and `listingWebsiteActivity.ts:20` spreads it into a `string[]` — that still holds.

Errors in `SyndicationStatus.tsx` are expected here and are fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/data/listingSyndication.ts src/data/listingSyndication.test.ts
git commit -m "feat(syndication): model channels by delivery method

Direct integrations carry confirmable state, dates, an expiration, and an
admin console. Email channels carry only send history, because Buildout
emails them on the broker's behalf and cannot confirm what they post.
Channel dates are anchored to the listing's publish time.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Seagull tokens and pure display logic

**Files:**
- Modify: `src/main.scss:10-20` (the existing `:root` semantic-var block)
- Create: `src/components/listings/syndication/syndicationDisplay.ts`
- Test: `src/components/listings/syndication/syndicationDisplay.test.ts`

**Interfaces:**
- Consumes: `SyndicationChannel`, `SyndicationChannelState` from `#/data/listingSyndication`; `formatDate(iso: string | null): string` from `#/components/deals/dealDisplay` (returns `MM/DD/YYYY`, or `--` when null).
- Produces:
  - `interface ChannelBadge { icon: IconDefinition; color: string; label: string }`
  - `channelBadge(state: SyndicationChannelState): ChannelBadge`
  - `interface MetaSegment { text: string; tone?: "warning" }`
  - `channelMetaSegments(channel: SyndicationChannel): MetaSegment[]`
  - `formatChannelTimestamp(iso: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/components/listings/syndication/syndicationDisplay.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { channelBadge, channelMetaSegments } from './syndicationDisplay'
import type { SyndicationChannel } from '#/data/listingSyndication'

function channel(over: Partial<SyndicationChannel> = {}): SyndicationChannel {
  return {
    id: 'commercialedge-network',
    name: 'CommercialEdge Network',
    delivery: 'direct',
    state: 'updated',
    active: true,
    // Midday UTC deliberately: these dates are asserted as MM/DD/YYYY, and an
    // evening-UTC timestamp would roll to the next day for a runner at UTC+9.
    publishedAt: '2026-07-22T12:00:00.000Z',
    lastUpdatedAt: '2026-07-22T14:21:00.000Z',
    expiresInDays: 177,
    adminUrl: 'https://admin.buildout.com/syndication/commercialedge-network/oak-street-plaza',
    ...over,
  }
}

/** Segments are joined by the card, so assert on the clause list. */
const texts = (c: SyndicationChannel) => channelMetaSegments(c).map((s) => s.text)

describe('channelBadge', () => {
  it('confirms a direct push in success green', () => {
    expect(channelBadge('updated')).toMatchObject({ label: 'Updated', color: 'var(--bp-success)' })
  })

  it('uses the informational token for in-flight states, not brand primary', () => {
    expect(channelBadge('pending').color).toBe('var(--channel-info)')
    expect(channelBadge('send-pending').color).toBe('var(--channel-info)')
  })

  it('never dresses a completed email send as a confirmation', () => {
    const sent = channelBadge('update-sent')
    expect(sent.label).toBe('Update sent')
    expect(sent.color).toBe('var(--stage-inactive)')
    expect(sent.color).not.toBe('var(--bp-success)')
  })

  it('flags a broken connection with warning', () => {
    expect(channelBadge('needs-attention')).toMatchObject({
      label: 'Needs attention',
      color: 'var(--bp-warning)',
    })
  })
})

describe('channelMetaSegments — direct', () => {
  it('reports published, last updated, and expiration', () => {
    expect(texts(channel())).toEqual([
      'Published 07/22/2026',
      expect.stringContaining('Updated 07/22/2026'),
      'Expires in 177 days',
    ])
  })

  it('warns when the expiration is within 30 days', () => {
    const segs = channelMetaSegments(channel({ expiresInDays: 12 }))
    expect(segs.at(-1)).toEqual({ text: 'Expires in 12 days', tone: 'warning' })
  })

  it('does not warn at 31 days', () => {
    expect(channelMetaSegments(channel({ expiresInDays: 31 })).at(-1)?.tone).toBeUndefined()
  })

  it('singularises a one-day countdown', () => {
    expect(texts(channel({ expiresInDays: 1 }))).toContain('Expires in 1 day')
  })

  it('omits expiration entirely when there is nothing to expire', () => {
    expect(texts(channel({ expiresInDays: null }))).toEqual([
      'Published 07/22/2026',
      expect.stringContaining('Updated 07/22/2026'),
    ])
  })

  it('keeps history for a paused channel', () => {
    expect(texts(channel({ state: 'off', active: false }))).toEqual([
      'Not syndicating',
      'Last published 07/22/2026',
    ])
  })

  it('says so plainly when a paused channel never published', () => {
    expect(
      texts(channel({ state: 'off', active: false, publishedAt: null, lastUpdatedAt: null, expiresInDays: null })),
    ).toEqual(['Not syndicating', 'Never published'])
  })

  it('explains an unavailable channel instead of showing empty dates', () => {
    expect(
      texts(channel({ state: 'not-available', active: false, publishedAt: null, lastUpdatedAt: null, expiresInDays: null, adminUrl: null })),
    ).toEqual(['No connection configured for this account'])
  })
})

describe('channelMetaSegments — email', () => {
  const email = (over: Partial<SyndicationChannel> = {}) =>
    channel({ id: 'loopnet', name: 'LoopNet', delivery: 'email', state: 'update-sent', expiresInDays: null, adminUrl: null, ...over })

  it('reports the last send and refuses to imply the posting is confirmed', () => {
    expect(texts(email())).toEqual([
      expect.stringContaining('Last sent 07/22/2026'),
      'Posting not confirmed',
    ])
  })

  it('reports a queued send', () => {
    expect(texts(email({ state: 'send-pending' }))).toEqual(['Update queued to send'])
  })

  it('keeps send history for a paused email channel', () => {
    expect(texts(email({ state: 'off', active: false }))).toEqual([
      'Not sending',
      expect.stringContaining('Last sent 07/22/2026'),
    ])
  })

  it('says so plainly when nothing was ever sent', () => {
    expect(texts(email({ state: 'off', active: false, publishedAt: null, lastUpdatedAt: null }))).toEqual([
      'Not sending',
      'No updates sent',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/components/listings/syndication/syndicationDisplay.test.ts`
Expected: FAIL — cannot resolve `./syndicationDisplay`.

- [ ] **Step 3: Add the Seagull tokens**

In `src/main.scss`, inside the existing `:root` block, after the `--side-buyer` line (currently line 19):

```scss
  // Informational accents — Seagull, deliberately not the brand primary the
  // cards' own links and switches already own. Used by the syndication modal
  // for in-flight channel states and the email-channel panel.
  --channel-info: #{colors.$seagull-600};
  --channel-info-surface: #{colors.$seagull-50};
  --channel-info-border: #{colors.$seagull-200};
  --channel-info-strong: #{colors.$seagull-700};
```

- [ ] **Step 4: Write the display module**

Create `src/components/listings/syndication/syndicationDisplay.ts`:

```ts
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowsRotate,
  faCircleCheck,
  faCircleExclamation,
  faCircleMinus,
  faEnvelope,
} from "@fortawesome/pro-regular-svg-icons";
import { formatDate } from "#/components/deals/dealDisplay";
import type {
  SyndicationChannel,
  SyndicationChannelState,
} from "#/data/listingSyndication";

export interface ChannelBadge {
  icon: IconDefinition;
  /** CSS color for the icon only — badge text keeps its inherited color. */
  color: string;
  label: string;
}

/**
 * Blueprint's Badge has no semantic success/warning variant, so the chrome
 * stays neutral and a colored icon carries the meaning. In-flight states use
 * the Seagull `--channel-info` token rather than `--bp-primary`: primary is the
 * action color the card's links and switch already use, and a state badge
 * wearing it would read as clickable.
 */
const BADGES: Record<SyndicationChannelState, ChannelBadge> = {
  updated: {
    icon: faCircleCheck,
    color: "var(--bp-success)",
    label: "Updated",
  },
  pending: {
    icon: faArrowsRotate,
    color: "var(--channel-info)",
    label: "Pending",
  },
  "needs-attention": {
    icon: faCircleExclamation,
    color: "var(--bp-warning)",
    label: "Needs attention",
  },
  off: { icon: faCircleMinus, color: "var(--stage-inactive)", label: "Off" },
  "not-available": {
    icon: faCircleMinus,
    color: "var(--stage-inactive)",
    label: "Not available",
  },
  // Grey, not green: a sent email is not a confirmed posting.
  "update-sent": {
    icon: faEnvelope,
    color: "var(--stage-inactive)",
    label: "Update sent",
  },
  "send-pending": {
    icon: faEnvelope,
    color: "var(--channel-info)",
    label: "Send queued",
  },
};

export function channelBadge(state: SyndicationChannelState): ChannelBadge {
  return BADGES[state];
}

/** One clause of a card's meta line. The card joins these with a separator. */
export interface MetaSegment {
  text: string;
  /** "warning" renders in `text-warning`; muted is the default. */
  tone?: "warning";
}

/** An expiration this close deserves to be noticed, not just counted. */
const EXPIRING_SOON_DAYS = 30;

/** "07/22/2026 12:21 PM PDT" — date, time, and the viewer's zone. */
export function formatChannelTimestamp(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${formatDate(iso)} ${time}`;
}

function expirationSegment(days: number): MetaSegment {
  const text = `Expires in ${days} ${days === 1 ? "day" : "days"}`;
  return days <= EXPIRING_SOON_DAYS ? { text, tone: "warning" } : { text };
}

/**
 * The meta line for one channel. Branches on delivery method first: an email
 * channel has no expiration and no confirmed posting, so it must never borrow
 * a direct channel's phrasing.
 */
export function channelMetaSegments(channel: SyndicationChannel): MetaSegment[] {
  if (channel.state === "not-available") {
    return [{ text: "No connection configured for this account" }];
  }

  if (channel.delivery === "email") {
    if (channel.state === "send-pending") {
      return [{ text: "Update queued to send" }];
    }
    if (channel.state === "off") {
      return [
        { text: "Not sending" },
        {
          text: channel.lastUpdatedAt
            ? `Last sent ${formatChannelTimestamp(channel.lastUpdatedAt)}`
            : "No updates sent",
        },
      ];
    }
    // update-sent
    return [
      {
        text: channel.lastUpdatedAt
          ? `Last sent ${formatChannelTimestamp(channel.lastUpdatedAt)}`
          : "No updates sent",
      },
      { text: "Posting not confirmed" },
    ];
  }

  if (channel.state === "off") {
    return [
      { text: "Not syndicating" },
      {
        text: channel.publishedAt
          ? `Last published ${formatDate(channel.publishedAt)}`
          : "Never published",
      },
    ];
  }

  const segments: MetaSegment[] = [];
  segments.push({
    text: channel.publishedAt
      ? `Published ${formatDate(channel.publishedAt)}`
      : "Not yet published",
  });
  if (channel.lastUpdatedAt) {
    segments.push({
      text: `Updated ${formatChannelTimestamp(channel.lastUpdatedAt)}`,
    });
  }
  if (channel.expiresInDays != null) {
    segments.push(expirationSegment(channel.expiresInDays));
  }
  return segments;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun --bun run test src/components/listings/syndication/syndicationDisplay.test.ts`
Expected: PASS, all 16 tests (4 badge + 8 direct + 4 email).

The timestamp assertions use `stringContaining('07/22/2026')` precisely because the time-of-day and zone abbreviation depend on the runner's timezone — do not tighten them to exact strings.

- [ ] **Step 6: Verify the SCSS still compiles**

Run: `bun --bun run build 2>&1 | tail -20`
Expected: build succeeds. A failure mentioning `$seagull-600` means the token name is wrong — check against `node_modules/@buildoutinc/blueprint-tokens/build/scss/_colors.scss`.

- [ ] **Step 7: Commit**

```bash
git add src/main.scss src/components/listings/syndication/syndicationDisplay.ts src/components/listings/syndication/syndicationDisplay.test.ts
git commit -m "feat(syndication): add channel badge and meta-line display logic

Badges keep neutral Blueprint chrome and let a colored icon carry meaning.
In-flight states use new Seagull --channel-info tokens rather than brand
primary, which the cards' links and switches already own. A completed
email send stays grey, since it is not a confirmed posting.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The channel card

**Files:**
- Create: `src/components/listings/syndication/SyndicationChannelCard.tsx`

**Interfaces:**
- Consumes: `channelBadge`, `channelMetaSegments` from `./syndicationDisplay`; `SyndicationChannel` from `#/data/listingSyndication`; Blueprint `Badge`, `Switch`, `Tooltip`.
- Produces: `SyndicationChannelCard({ channel, websiteUrl, websiteLabel, onToggle }): JSX.Element` where `onToggle: (active: boolean) => void` and `websiteLabel` is `"Sale Website"` or `"Lease Website"`.

No test — this is presentational, and the project has no component-render test setup (see Global Constraints). Its branching logic already has unit coverage in Task 2.

- [ ] **Step 1: Write the card**

Create `src/components/listings/syndication/SyndicationChannelCard.tsx`:

```tsx
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCircleExclamation,
} from "@fortawesome/pro-regular-svg-icons";
import type { SyndicationChannel } from "#/data/listingSyndication";
import { channelBadge, channelMetaSegments } from "./syndicationDisplay";

function ChannelLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="d-inline-flex align-items-center gap-1"
    >
      {children}
      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
    </a>
  );
}

/**
 * One syndication channel: identity and status on the first line, the dates
 * that matter on the second, and where to go next on the third.
 */
export function SyndicationChannelCard({
  channel,
  websiteUrl,
  websiteLabel,
  onToggle,
}: {
  channel: SyndicationChannel;
  websiteUrl: string;
  websiteLabel: string;
  onToggle: (active: boolean) => void;
}) {
  const badge = channelBadge(channel.state);
  const segments = channelMetaSegments(channel);
  const unavailable = channel.state === "not-available";

  return (
    <div
      className={`border rounded bg-body px-3 py-2${unavailable ? " opacity-75" : ""}`}
    >
      <div className="d-flex align-items-center justify-content-between gap-2">
        <div
          className="d-flex align-items-center gap-2"
          style={{ minWidth: 0 }}
        >
          <span className="fw-medium text-truncate">{channel.name}</span>
          <Badge variant="secondary" appearance="muted">
            <FontAwesomeIcon icon={badge.icon} style={{ color: badge.color }} />
            {badge.label}
          </Badge>
          {channel.state === "needs-attention" && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="text-warning">
                    <FontAwesomeIcon icon={faCircleExclamation} />
                  </span>
                }
              />
              <Tooltip.Content side="top">
                This connection needs attention before it can syndicate
                reliably.
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
        <Switch
          checked={channel.active}
          disabled={unavailable}
          onCheckedChange={onToggle}
          aria-label={`Toggle syndication to ${channel.name}`}
        />
      </div>

      <div className="fs-small text-muted mt-1">
        {segments.map((segment, i) => (
          <span key={segment.text}>
            {i > 0 && <span className="mx-1">·</span>}
            <span className={segment.tone === "warning" ? "text-warning" : undefined}>
              {segment.text}
            </span>
          </span>
        ))}
      </div>

      {!unavailable && (
        <div className="d-flex flex-wrap gap-3 fs-small mt-1">
          <ChannelLink href={websiteUrl}>{websiteLabel}</ChannelLink>
          {channel.adminUrl && (
            <ChannelLink href={channel.adminUrl}>Admin Dash</ChannelLink>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm the Badge import path**

Run: `ls node_modules/@buildoutinc/blueprint-react/dist/ui/ | grep -i badge`
Expected: a `Badge` entry. If the `ui/Badge` subpath does not resolve, check how `Badge` is imported in `src/components/listings/WebsiteActivityLog.tsx` and match it exactly.

- [ ] **Step 3: Typecheck the new file in isolation**

Run: `bunx tsc --noEmit 2>&1 | grep SyndicationChannelCard`
Expected: no output. Errors in `SyndicationStatus.tsx` are still expected until Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/components/listings/syndication/SyndicationChannelCard.tsx
git commit -m "feat(syndication): add the channel card

Three lines per channel: identity and badge, the dates that matter, and
the outbound links. Unavailable channels drop their link row and disable
their switch rather than showing empty fields.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The modal — two groups and both disclaimers

**Files:**
- Modify: `src/components/listings/SyndicationStatus.tsx` (rewrite the modal body; header widget logic stays)

**Interfaces:**
- Consumes: `getListingSyndication`, `SyndicationChannel`, `SyndicationDelivery` from `#/data/listingSyndication`; `SyndicationChannelCard` from `./syndication/SyndicationChannelCard`; `getListingWebsiteSettings` from `#/data/listingWebsiteSettings`.
- Produces: `SyndicationStatus({ listing }: { listing: Listing })` — unchanged public signature, so `$listingId.tsx` and `PropertyDetailHeader.tsx` need no edits.

- [ ] **Step 1: Confirm the website-settings helper's shape**

Run: `sed -n '35,55p' src/data/listingWebsiteSettings.ts`
Expected (already verified): `getListingWebsiteSettings(listing: Listing): ListingWebsiteSettings` with `websiteUrl: \`https://properties.buildout.com/${listing.slug}\``. Pass `listing` straight through.

- [ ] **Step 2: Rewrite the component**

Replace the entire contents of `src/components/listings/SyndicationStatus.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faEnvelope,
  faCircleWifi,
  faCircleInfo,
} from "@fortawesome/pro-regular-svg-icons";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import {
  getListingSyndication,
  type SyndicationChannel,
  type SyndicationDelivery,
} from "#/data/listingSyndication";
import { getListingWebsiteSettings } from "#/data/listingWebsiteSettings";
import { SyndicationChannelCard } from "./syndication/SyndicationChannelCard";

const AFFILIATION_DISCLAIMER =
  "Buildout has no financial, legal, commercial, or partnership affiliation with CoStar Group, Inc., LoopNet, or Crexi, Inc. No association or relationship between these companies should be implied or inferred. Buildout assists customers in sending email updates to these unaffiliated channels when listings are added, updated, or removed.";

const GROUPS: {
  delivery: SyndicationDelivery;
  label: string;
  /** How this group's "n of m" count reads — these channels behave differently. */
  verb: string;
}[] = [
  { delivery: "direct", label: "Direct connections", verb: "syndicating" },
  { delivery: "email", label: "Email updates", verb: "sending" },
];

/**
 * Header widget: an at-a-glance syndication status button that opens a modal
 * with per-channel status, dates, links, on/off toggles, and the disclaimers
 * that qualify each group.
 */
export function SyndicationStatus({ listing }: { listing: Listing }) {
  const { channels: initialChannels, blockingIssues } =
    getListingSyndication(listing);
  const [channels, setChannels] = useState(initialChannels);
  const rep = listing.internalBrokers[0];
  const websiteUrl = getListingWebsiteSettings(listing).websiteUrl;
  const websiteLabel =
    listing.dealType === "Lease" ? "Lease Website" : "Sale Website";

  const published = listing.publishedAt != null;
  // A Closed or Lost deal that was published is off-market now — show its history
  // without implying it is still live.
  const offMarket =
    published && (listing.status === "closed" || listing.status === "inactive");
  const activeCount = channels.filter((c) => c.active).length;
  const label = !published
    ? "Not published"
    : offMarket
      ? "Previously published"
      : activeCount === 0
        ? "Published"
        : `Published · syndicating to ${activeCount}/${channels.length}`;

  const needsAttention =
    blockingIssues.length > 0 ||
    channels.some((c) => c.state === "needs-attention");
  const statusColor =
    !published || offMarket
      ? "var(--stage-inactive)"
      : needsAttention
        ? "var(--bp-warning)"
        : "var(--stage-active)";

  const toggle = (id: string, active: boolean) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active } : c)),
    );
  };

  const toggleGroup = (delivery: SyndicationDelivery, active: boolean) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.delivery !== delivery || c.state === "not-available"
          ? c
          : { ...c, active },
      ),
    );
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="d-flex align-items-center gap-0-5 fs-small">
        <FontAwesomeIcon icon={faCircleWifi} style={{ color: statusColor }} />
        {label}
      </div>
      <Modal>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Modal.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Manage syndication"
                  >
                    <FontAwesomeIcon icon={faGear} />
                  </Button>
                }
              />
            }
          />
          <Tooltip.Content>Syndication Settings</Tooltip.Content>
        </Tooltip>

        <Modal.Content size="lg" scrollable centered>
          <Modal.Header>
            <Modal.Title>Syndication</Modal.Title>
            {/*
              The old copy said "pushed ... via API", which is only true of the
              direct group. Email channels are not an API push.
            */}
            <Modal.Description>
              Where this listing reaches other listing sites, and when it last
              did.
            </Modal.Description>
          </Modal.Header>

          <Modal.Body className="d-flex flex-column gap-4">
            {blockingIssues.length > 0 && (
              <Alert severity="warning" withIcon>
                <FontAwesomeIcon icon={faTriangleExclamation} />
                <Alert.Title>Photos limit your reach</Alert.Title>
                <ul className="mb-0 ps-3">
                  {blockingIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {channels.length === 0 ? (
              <Empty className="py-6">
                <Empty.Media>
                  <FontAwesomeIcon icon={faGear} aria-hidden />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No syndication channels configured</Empty.Title>
                  Connect listing sites in profile or account settings to start
                  syndicating this listing.
                </Empty.Content>
              </Empty>
            ) : (
              GROUPS.map((group) => {
                const groupChannels = channels.filter(
                  (c) => c.delivery === group.delivery,
                );
                if (groupChannels.length === 0) return null;
                return (
                  <SyndicationGroup
                    key={group.delivery}
                    label={group.label}
                    verb={group.verb}
                    channels={groupChannels}
                    informational={group.delivery === "email"}
                    websiteUrl={websiteUrl}
                    websiteLabel={websiteLabel}
                    onToggle={toggle}
                    onToggleAll={(active) => toggleGroup(group.delivery, active)}
                  />
                );
              })
            )}
          </Modal.Body>

          <Modal.Footer>
            <Modal.Close render={<Button variant="ghost">Close</Button>} />
            {rep && (
              <Button
                variant="primary"
                nativeButton={false}
                render={<a href={`mailto:${rep.email}`} />}
              >
                <FontAwesomeIcon icon={faEnvelope} />
                Send Rep Email
              </Button>
            )}
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}

/**
 * One delivery-method group. The email group renders on an informational
 * surface with its affiliation disclaimer inside, so the note is visually
 * scoped to the channels it actually names. Deliberately not an Alert:
 * nothing is wrong with these channels.
 */
function SyndicationGroup({
  label,
  verb,
  channels,
  informational,
  websiteUrl,
  websiteLabel,
  onToggle,
  onToggleAll,
}: {
  label: string;
  verb: string;
  channels: SyndicationChannel[];
  informational: boolean;
  websiteUrl: string;
  websiteLabel: string;
  onToggle: (id: string, active: boolean) => void;
  onToggleAll: (active: boolean) => void;
}) {
  const eligible = channels.filter((c) => c.state !== "not-available");
  const activeCount = channels.filter((c) => c.active).length;
  const allActive = eligible.length > 0 && eligible.every((c) => c.active);

  const body = (
    <div className="d-flex flex-column gap-2">
      {channels.map((channel) => (
        <SyndicationChannelCard
          key={channel.id}
          channel={channel}
          websiteUrl={websiteUrl}
          websiteLabel={websiteLabel}
          onToggle={(active) => onToggle(channel.id, active)}
        />
      ))}
      {informational && (
        <p
          className="d-flex gap-2 fs-small text-muted mb-0 mt-1"
          style={{ maxWidth: "62ch" }}
        >
          <FontAwesomeIcon
            icon={faCircleInfo}
            style={{ color: "var(--channel-info-strong)", marginTop: "0.2em" }}
          />
          <span>{AFFILIATION_DISCLAIMER}</span>
        </p>
      )}
    </div>
  );

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between gap-3 pb-2 border-bottom">
        <span className="text-uppercase fw-medium fs-small text-muted">
          {label}
        </span>
        <div className="d-flex align-items-center gap-2">
          <span className="fs-small text-muted">
            {activeCount} of {channels.length} {verb}
          </span>
          <Switch
            checked={allActive}
            disabled={eligible.length === 0}
            onCheckedChange={onToggleAll}
            aria-label={`Toggle all ${label.toLowerCase()}`}
          />
        </div>
      </div>
      {informational ? (
        <div
          className="rounded p-3"
          style={{
            background: "var(--channel-info-surface)",
            border: "1px solid var(--channel-info-border)",
          }}
        >
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck the whole project**

Run: `bunx tsc --noEmit`
Expected: clean — no output. This is the first point since Task 1 where the project fully type-checks.

If `Alert.Title` or `Empty.Title` errors, they are unchanged from the original file — re-check the diff for a dropped import rather than changing the Alert structure.

- [ ] **Step 4: Run the full test suite**

Run: `bun --bun run test`
Expected: all tests pass, including the two new files. A biome warning and a react/module Vitest stderr line are known non-gates in this repo — ignore them.

- [ ] **Step 5: Build**

Run: `bun --bun run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/SyndicationStatus.tsx
git commit -m "feat(syndication): split the modal by delivery method

Direct connections and email updates become separate groups, each with
its own master switch and count. The affiliation disclaimer moves onto an
informational Seagull panel wrapping the email channels it names, rather
than sitting unscoped at the bottom of the modal.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand off for visual review**

Run: `bun --bun run dev` and report the URL. Per CLAUDE.md, do **not** drive the browser — ask the user to open a listing detail page, click the syndication gear, and confirm:

1. Both groups render, with the email group on the tinted Seagull panel and its disclaimer inside.
2. Cards show three lines; the expiration turns amber on any channel at ≤30 days.
3. `Not available` cards are muted with a disabled switch and no links.
4. The per-group master switches toggle only their own group and skip unavailable channels.
5. An unpublished listing shows no channel dates.

---

## Verification Summary

| Gate | Command |
| --- | --- |
| Types | `bunx tsc --noEmit` |
| Tests | `bun --bun run test` |
| Build | `bun --bun run build` |
| Visual | Manual — user confirms in the dev server |
