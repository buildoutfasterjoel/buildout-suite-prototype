# Syndication Modal — Channel Detail, Links, and Disclaimers

> Design spec. Rebuilds the syndication modal (`src/components/listings/SyndicationStatus.tsx`) and its data source (`src/data/listingSyndication.ts`) so each channel card carries a real status badge, publication dates, an expiration countdown, and outbound links — and so the modal distinguishes channels Buildout is genuinely integrated with from channels it merely emails on the broker's behalf.

## Motivation

Today each channel is a card with a name, a colored-dot connection status, and an on/off switch. That answers "is this on?" and nothing else. A broker looking at the modal cannot tell when the listing reached a channel, when it will fall off, or where to go to see it live.

The reference screenshot supplies the missing data (status badge, Links, Published, Last Updated, Expiration, Admin Dash) plus two disclaimers. It also exposes a modeling gap: some channels are direct integrations with confirmable state, while CoStar, LoopNet, and Crexi receive **emails sent on the broker's behalf**. There is no connection to those channels, so a badge reading "Updated" or "Connected" would assert something Buildout cannot know. That distinction — not Sale vs. Lease — is the modal's real organizing principle.

## Goals

- Every channel card shows status, the dates that matter, and where to go next.
- The modal never claims confirmed state for a channel Buildout only emails.
- Both disclaimers appear, each attached to the content it qualifies rather than pooled in a footer.
- Keep the card-plus-switch shape, which reads well and is already familiar.

## Non-goals

- **No new blocking conditions.** The photo alert keeps firing off the existing `blockingIssues` data.
- **No real integrations.** All values stay deterministically derived per listing, matching the `getListingTraffic` / `getListingWebsiteActivity` pattern.
- **No Sale/Lease grouping.** A `Listing` carries a single `dealType`, so there is only ever one to show.
- **No changes to the header widget's summary label** beyond what the wider roster implies.

---

## Data model — `src/data/listingSyndication.ts`

A channel's **delivery method** determines which fields exist on it.

```ts
export type SyndicationDelivery = "direct" | "email"

/** Direct integrations report confirmable state. */
export type DirectChannelState =
  | "updated"          // on, pushed, data current
  | "pending"          // on, queued, not yet confirmed by the channel
  | "needs-attention"  // credential or mapping problem
  | "off"              // healthy connection, syndication turned off
  | "not-available"    // no connection configured for this account

/**
 * Email channels get no "connected" and no "error": Buildout sends an email and
 * the channel decides what to do with it. The only honest facts are whether we
 * are sending and when we last sent.
 */
export type EmailChannelState = "update-sent" | "send-pending" | "off"
```

### Roster

Replaces the flat six names. Delivery method is a fixed property of the channel, not something derived.

| Delivery | Channels |
| --- | --- |
| `direct` | CommercialEdge Network, RCM1 Marketplace, apartmentbuildings.com, Brevitas |
| `email` | CoStar, LoopNet, Crexi, Ten-X |

`SYNDICATION_NETWORK_NAMES` remains exported as the flattened list of all channel names — `src/data/listingWebsiteActivity.ts` consumes it as a traffic-source pool and must keep working.

### Per-channel fields

```ts
export interface SyndicationChannel {
  id: string
  name: string
  delivery: SyndicationDelivery
  state: DirectChannelState | EmailChannelState
  active: boolean
  /** ISO timestamp the listing first reached this channel; null if it never has. */
  publishedAt: string | null
  /** ISO timestamp of the most recent push (direct) or send (email). */
  lastUpdatedAt: string | null
  /** Days until the channel drops the listing. Direct channels only; null for email. */
  expiresInDays: number | null
  /** Deep link into the channel's admin console. Direct channels only. */
  adminUrl: string | null
}
```

Email channels always carry `expiresInDays: null` and `adminUrl: null` — an expiration and an admin console are both things a real integration has.

### Generation

Stays deterministic off `hash(listing.id)` so values are stable across renders, with one change: **dates are anchored to `listing.publishedAt`**. A channel must never claim it published before the listing went live, and every channel date is derived as an offset forward from that anchor. When `listing.publishedAt` is `null`, every channel reports `publishedAt: null` and `lastUpdatedAt: null` regardless of state.

This requires the signature to change from `getListingSyndication(listingId: string)` to `getListingSyndication(listing: Listing)`. There is exactly one caller (`SyndicationStatus.tsx`).

Invariants the generator must hold:

- No channel date precedes `listing.publishedAt`.
- An `email` channel never produces `needs-attention` or `not-available`.
- A `not-available` channel is never `active`.
- A channel with `active: false` has state `off` (or `not-available`).

### Links

The listing-site link reuses `getListingWebsiteSettings(listing).websiteUrl`, so the modal and the Website tab show the same URL rather than two independently invented ones. Its label follows `listing.dealType` — "Sale Website" or "Lease Website".

`adminUrl` is `https://admin.buildout.com/syndication/{channel.id}/{listing.slug}`, opened in a new tab. There is no real admin console to reach; this is a prototype affordance, not a working link. It stays on a Buildout-owned host rather than inventing URLs on the channels' own domains.

---

## The card — `syndication/SyndicationChannelCard.tsx`

### Status badge

Blueprint's `Badge` ships only `variant="primary|secondary|outline"` × `appearance="accent|muted"` — no semantic success or warning variant. So the badge uses neutral `secondary`/`muted` chrome and lets a **colored icon carry the meaning**. This matches the existing muted-`Badge` usage in `WebsiteActivityLog.tsx` and `ClientReportCompanies.tsx`.

Blueprint sets Bootstrap's `$prefix` to `bp-` (`blueprint-theme/scss/bridge/_vars.scss`), so the theme colors are available as `--bp-success`, `--bp-warning`, `--bp-primary`, etc. Two constraints worth recording: the theme map has **no `info` color** (only primary, secondary, success, warning, destructive, accent, muted), and `--stage-active` is `$buildout-blue-500` — blue, not green — so it is the wrong token for a confirmation check.

Informational states use **Seagull** (`$seagull-*`, hue ~216–227 — cyan-leaning, distinct from buildout-blue's ~259) rather than `--bp-primary`. Primary is the brand action color used by the card's own links and switch; a state badge wearing it would read as clickable.

| State | Icon | Icon color | Label |
| --- | --- | --- | --- |
| `updated` | `faCircleCheck` | `--bp-success` | Updated |
| `pending` | `faArrowsRotate` | `--channel-info` | Pending |
| `needs-attention` | `faCircleExclamation` | `--bp-warning` | Needs attention |
| `off` | `faCircleMinus` | `--stage-inactive` | Off |
| `not-available` | `faCircleMinus` | `--stage-inactive` | Not available |
| `update-sent` | `faEnvelope` | `--stage-inactive` | Update sent |
| `send-pending` | `faEnvelope` | `--channel-info` | Send queued |

`update-sent` stays grey while `send-pending` is Seagull: a queued send is in flight and informational, but a completed send is not a confirmation and must not borrow the weight of one.

Only the **icon** is tinted; badge text keeps its inherited color. That keeps `seagull-600` (oklch 61% lightness) doing non-text duty, where its contrast on the neutral badge is adequate.

The header widget's own status dot keeps its current `--stage-active` / `--bp-warning` / `--stage-inactive` treatment — it summarizes the listing, not a channel, and is out of scope.

### New tokens — `src/main.scss`

Defined alongside the existing `--stage-*` / `--side-*` block (`src/main.scss:11-19`), which already maps SCSS tokens to local semantic vars. This is preferred over inlining `var(--color-seagull-600, #hex)` at the call site, since it names the role rather than the color:

```scss
--channel-info: #{colors.$seagull-600};          // informational icon
--channel-info-surface: #{colors.$seagull-50};   // email group panel
--channel-info-border: #{colors.$seagull-200};   // email group border
--channel-info-strong: #{colors.$seagull-700};   // disclaimer info icon
```

`update-sent` is deliberately **not** green. Green reads as confirmation, and nothing about an outbound email is confirmed.

All icons are `pro-regular` per the project icon rule.

### Anatomy

Three rows, switch pinned right on the first:

```
CommercialEdge Network  [✓ Updated]                        ──●
Published 07/22/2026 · Updated 07/22/2026 12:21 PM PDT · Expires in 177 days
↗ Sale Website   ↗ Admin Dash
```

Row 2 is `fs-small text-muted` with `·` separators; row 3 is `fs-small` links with a trailing external-link icon.

### Per-state content

- **Direct, live** (`updated` / `pending`) — as above. **Expiration turns `text-warning` at ≤ 30 days**; a countdown that cannot raise a hand is decoration.
- **Off** keeps its history rather than going blank: `Not syndicating · Last published 07/10/2026`. If it never published: `Not syndicating · Never published`.
- **Not available** renders muted with a disabled switch and no link row.
- **Needs attention** keeps the existing warning tooltip explaining the connection must be fixed before it can syndicate reliably.
- **Email** reads `Last sent 07/22/2026 12:21 PM PDT · Posting not confirmed`, where "Posting not confirmed" carries an info tooltip: Buildout emails this channel on the broker's behalf, so the channel controls whether and when the listing appears. Link row shows the listing website only — no Admin Dash.

---

## Modal shell — `SyndicationStatus.tsx`

### Groups

Two sections, `direct` then `email`. Each group header row carries an uppercase label, an `n of m on` count, and a **per-group master switch**. This replaces today's single global "Syndicate to all networks" row, which stops making sense once the two halves behave differently. The master switch skips `not-available` channels, as the current `toggleAll` already does.

A group with no channels is omitted entirely. When *both* are empty the existing `Empty` state renders as it does today.

### The email group's surface

The direct group renders plain on the modal background. The email group and its disclaimer are wrapped in one informational panel — `--channel-info-surface` background, `1px solid --channel-info-border`, rounded, padded — so the two delivery methods are distinguishable before a word is read:

```
EMAIL UPDATES                                  2 of 4 sending
┌─ --channel-info-surface · --channel-info-border ──────────┐
│ ╭───────────────────────────────────────────────────────╮ │
│ │ LoopNet            [✉ Update sent]           ──●  On  │ │
│ │ Last sent 07/22/2026 12:21 PM PDT · Not confirmed     │ │
│ │ ↗ Sale Website                                        │ │
│ ╰───────────────────────────────────────────────────────╯ │
│ ⓘ Buildout has no financial, legal, commercial, or        │
│   partnership affiliation with CoStar Group, Inc., …      │
└───────────────────────────────────────────────────────────┘
```

Cards stay white inside the panel so they still read as cards. The disclaimer gains a `faCircleInfo` icon in `--channel-info-strong`.

This is deliberately *not* an `Alert`: nothing is wrong with these channels, and warning chrome would misreport a normal configuration. The tint's job is to scope the disclaimer visually to the channels it names — which is the reason the groups were split at all.

### Disclaimers

Each sits with the content it qualifies:

1. **Top alert** — the photo warning, still driven by the existing `blockingIssues` array. The framing softens from "Syndication is blocked" to the screenshot's advisory tone, because missing photos reduce reach rather than halting syndication: *"Properties without syndicatable photos are not accepted by all partners and generate fewer leads. Check the appropriate boxes in the Media forms for any syndicatable photos you own."* Stays `severity="warning"` with a `pro-duotone` icon per the project Alert rule.
2. **Inside the email group's panel**, below its cards — the affiliation note, `fs-small text-muted` with a `faCircleInfo` icon in `--channel-info-strong`: *"Buildout has no financial, legal, commercial, or partnership affiliation with CoStar Group, Inc., LoopNet, or Crexi, Inc. No association or relationship between these companies should be implied or inferred. Buildout assists customers in sending email updates to these unaffiliated channels when listings are added, updated, or removed."*

   The screenshot sets this in italics; here it sits on a tinted panel with an icon, which already separates it from the cards, so italics would only cost legibility at small size.

Placing the affiliation note with the channels it names, instead of at the bottom of the modal, is the whole reason the two-group split earns its complexity.

### Unchanged

Modal stays `size="lg" scrollable centered` — three-line cards need height, not width, and the body already scrolls. The trigger button, tooltip, header copy, Close, and Send Rep Email footer action all stay as they are. The header widget's `Published · syndicating to n/m` label needs no change; it just counts a larger roster.

---

## Files

| File | Change |
| --- | --- |
| `src/main.scss` | Add the four `--channel-info-*` Seagull tokens to the existing semantic-var block |
| `src/data/listingSyndication.ts` | Rewrite: delivery-aware roster, per-channel state and dates, anchored generation |
| `src/data/listingSyndication.test.ts` | New: determinism plus the four generator invariants |
| `src/components/listings/SyndicationStatus.tsx` | Header widget, modal shell, groups, disclaimers |
| `src/components/listings/syndication/SyndicationChannelCard.tsx` | New: one card and its badge |

`SyndicationStatus.tsx` is 234 lines today and would roughly double if the card stayed inline, so the card and its badge move out. The modal file then reads as layout and the card file as one channel's presentation.

## Verification

- `bunx tsc --noEmit` — `vite build` does not type-check.
- `bun --bun run test` — the new generator test plus the existing suite.
- Manual: open the modal on a published listing, an unpublished listing, and a closed listing; confirm date anchoring, the ≤30-day expiration warning, and both disclaimers.
