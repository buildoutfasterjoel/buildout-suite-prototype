# Space deal permissions

Deal access today asks one question per listing: are you on this deal's team,
were you shared into it, does your role reach past your own book. That is right
for a sale deal, where one record holds both the marketing and the money.

A lease building is not one record. The building is a shell deal and each rented
space is its own child deal under it (`Listing.parentDealId`). The two halves of
a deal then live at different levels:

- **Marketing belongs to the building.** The website, the documents, the email
  and the demographics are the building's alone — a space page does not even
  show them (`BUILDING_OWNED_HREFS`). Reaching a space's own marketing therefore
  means reaching the building first.
- **Money belongs to the space.** Each space has its own broker team and its own
  voucher. Two brokers can work the same building and different suites, and
  neither may read the other's commission.

Resolving both halves against one listing gets both wrong. A marketing person
shared into a building is locked out of every space in it, and a broker who
works one suite cannot open the building the suite is in.

## The rule

**Marketing resolves on the shell. Money resolves on the space.**

| Viewer | Building page | Space page |
| --- | --- | --- |
| On the shell's broker team | Marketing ✓ · Vouchers index of the spaces they are on | Marketing ✓ · Voucher ✗ |
| On Space 1's broker team | Marketing ✓ · Vouchers index: Space 1 only | Space 1: both halves ✓ · Space 2: no access |
| Shared into the building | Marketing at their share level · no Vouchers index | Marketing ✓ on every space · Voucher ✗ |
| Back Office Manager (`view-other-vouchers`) | Vouchers index: every space | Voucher ✓ · marketing per role |

Three consequences worth stating plainly:

- **Working any space in a building earns that building's marketing.** That is
  where the space's own media and documents come from, so a suite broker who
  cannot open the building cannot do their job. It earns the building's
  marketing only — not the neighbouring suites'.
- **Being on the shell's team earns no space's money.** The shell team owns the
  assignment; the suite team owns the transaction.
- **A suite is reached by working it, or by a building share.** A broker on
  Suite 3 has no access to Suite 4 in either half. Marketing is one wall across
  the *building*, not across its suites: a large building would otherwise fill
  every one of its brokers' deal indexes with suites they do not work.

A shell has no voucher of its own — it already shows a Vouchers *index* instead
(`dealNav.ts:346`). So `backOffice` on a shell means "may open the index", and
the index filters its rows per space.

### What this does to the deals index

Space deals render as their own cards on `/listings` (`DealCard.tsx:158`), and
`visibleDeals` uses the same rule as the deal page. A suite broker's index is
therefore their building plus the suites they actually work — a neighbouring
suite resolves to `none` in both halves, so its card does not appear. That is
the reason marketing stops at the building rather than running through to every
suite under it.

A person shared into a building does see all of its suites on the index, because
a building share is an explicit grant to work that building's marketing, suites
included.

## Sharing moves to the building

A share is a marketing grant, and marketing is the building's. So the building
is the only place a share is granted. A space page shows who has access and
cannot change it.

This does not change what a share *is*: still one dimension (view / contribute),
still capped by the sharer's role, still never a voucher. The rules in
`dealShares.ts` stand unchanged. Only the record a share hangs on is now always
the shell.

## The resolver

`dealAccessFor` stays the single function every surface asks, and stays pure. It
gains a fourth argument naming the family around the listing:

```ts
export interface DealFamily {
  /** The shell this space hangs under. Undefined for a top-level deal. */
  shell?: Listing
  /** Shares granted on that shell. */
  shellShares?: DealShare[]
  /** A shell's child space deals. Set only when `listing` is the shell —
   *  a space never needs its siblings, because it grants nothing across them. */
  spaces?: Listing[]
}

export function dealAccessFor(
  listing: Listing,
  viewer: AccessViewer | undefined,
  shares: DealShare[],
  family?: DealFamily,
): DealAccess
```

The body resolves three memberships, then each half:

```
onThis     = on this listing's broker team
onShell    = on family.shell's broker team
onAnySpace = on any team in family.spaces

isSpace = listing.parentDealId != null
isShell = !isSpace && (family.spaces?.length ?? 0) > 0

marketing = (onThis || onShell || (isShell && onAnySpace))
  ? "contribute"
  : higher(role.marketing, sharedLevel(shellShares ?? shares, viewer))

backOffice = isShell
  ? higher(onAnySpace ? "view" : "none", role.backOffice)   // the index
  : onThis ? "contribute" : role.backOffice                 // a voucher
```

`sharedLevel` is today's inline share cap lifted into a named helper, so the
share list read is the shell's for a space and the listing's own otherwise.

A deal with no family passes `family` undefined and resolves exactly as today:
`onThis` gives both halves, everyone else gets role plus share. The existing
tests in `dealAccessFor.test.ts` must keep passing untouched — that is the
regression check on this refactor.

A shell team member on none of its spaces gets no Vouchers item rather than an
empty index page.

### Where the family comes from

`dealAccessFor` stays pure, so the store read lives one level up:

- `useDealAccess(listing)` resolves the shell (`getListing(parentDealId)`) and
  its shares (`dealShares.get(shellId)`) for a space, or the child spaces
  (`getChildDeals`) for a shell. Never both — a listing is one or the other.
- `visibleDeals` groups the listing array by `parentDealId` once and reuses the
  grouping for every row, rather than scanning per listing.

## Surfaces

1. **`dealAccess.ts`** — the rules above, plus `visibleDeals` grouping.
2. **`useDealAccess.ts`** — gather the family from the store.
3. **`$listingId/vouchers/index.tsx`** — filter rows with
   `canSeeVoucher(voucherTeamIds(space), viewerSeat, canViewOthers)`. Both
   functions already exist in `voucherRights.ts` and already drive
   `/backoffice/vouchers`; this index simply never called them.
4. **`SpaceDetailHeader.tsx`** — a real access cluster, see below.
5. **`DealHeroAccessAvatars.tsx`** — a `readOnly` prop that drops the gear
   button and the modal entirely.
6. **`$listingId/spaces.tsx`** — lock the rows the viewer cannot open, see
   below.

### The Spaces roster locks what it cannot open

A suite broker still needs to see that the rest of the building is in flight.
The roster keeps every row; the rows they cannot open stop being doors.

The file already has both shapes. `SuiteRowItem` renders a `<Link>` when
`row.dealId` is set and a plain `<div>` otherwise (`spaces.tsx:183`). A locked
row takes the plain shape: same label, same square footage, same lease rate —
all of them the building's own marketing facts, drawn from `Property.units`,
which this viewer already has.

Two things change inside a locked row:

- **The stage control becomes a label.** `SuiteStatusControl` renders an
  editable `DealStageSelect` for any suite with a deal (`spaces.tsx:58`). A
  locked row gets the read-only `StatusPill` branch instead, showing
  `dealStageLabel(deal.status, "space")` — you can see the suite is under
  contract, you cannot move it.
- **No chevron.** The trailing `faAngleRight` says "this opens"; a locked row
  does not.

Nothing about the suite's deal — its tenant, its brokers, its money — appears on
a locked row.

### The space header's access cluster

The space header today overlays `AvatarGroup` on its thumbnail — stacked
initials derived from `hash(space.id)`, showing nobody. It reads as an access
cluster and is decoration.

Replace it with `DealHeroAccessAvatars` in the controls row, left of
`DealStageSelect` — the same slot the building header uses
(`PropertyDetailHeader.tsx:194`), so the two headers read as one kind of page.
It shows:

- the ringed creator avatar, `dealCreator(space)`
- the space's own internal brokers, `dealTeamBrokers(space)`
- no share avatars — a space carries no shares once sharing moves to the shell
- no gear button and no modal

The people shared into the building are deliberately **not** listed here, even
though they can open the page. The building's cluster is where that list lives;
repeating it on each of six suites says the same thing six times.

`AvatarGroup` stays — the property card still uses it.

## Out of scope

- **Notes stays in the Back Office nav group.** A suite broker opening the
  building therefore reaches the building's Notes alongside the filtered
  Vouchers index. Accepted as-is; splitting Notes out is a separate change.
- **No new permission ids.** `access-other-listings`, `view-other-vouchers` and
  `edit-other-vouchers` keep their present meanings.
- **No new fixtures.** The existing 2 shells and 7 spaces exercise every row of
  the table; no entity or shape changes.

## The seed writes shares onto the building

`seedDealShares` loops every listing and writes shares by index, spaces included
(`seed.ts:3256`). Those space shares become unreachable once a space reads its
shell's list, and they would render as ghost avatars on the space header.

The fix is one line inside the loop: a share earned by a listing hangs on
`listing.parentDealId ?? listing.id`, deduplicated per member. So
`seed.test.ts:912` — "leaves a marketing-opened deal to a broker, and shares it
back" — must look for Maya's share on the parent rather than on the space.

The witness for the space half of that test is `createdById`, not
`marketingCreatedDeal`. Of the seven seeded spaces, three carry
`createdById: 'maya-brooks'` (`space-104-100`, `-200`, `-300`) and exactly one
satisfies `marketingCreatedDeal` (`space-107-100`) — and that one was *not*
created by Maya. `seedDealShares` grants on `createdById`, so the three are what
exercise the space path.

This changes seeded data, so **`SEED_VERSION` moves 76 → 77**
(`persistence.ts:5`). Without it a browser keeps the old IndexedDB snapshot and
the space headers still show ghost shares.

## Testing

`dealAccessFor.test.ts` gains a case per row of the access table, plus:

- a shell team member on no space gets `backOffice: "none"`
- a suite broker resolves `none` in both halves on a sibling suite, so its card
  leaves their deals index
- a building share reaches every space's marketing
- a deal with no family resolves identically with and without the argument

All pure, no store and no browser. Browser verification afterwards is the usual
breakage pass: open a building and a space as two different seats via "Viewing
as", confirm the sidebar, the gate redirect and the Vouchers index agree.
