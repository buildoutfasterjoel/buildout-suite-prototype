# Space deal permissions

Deal access today asks one question per listing: are you on this deal's team,
were you shared into it, does your role reach past your own book. That is right
for a sale deal, where one record holds both the marketing and the money.

A lease building is not one record. The building is a shell deal and each rented
space is its own child deal under it (`Listing.parentDealId`). The two halves of
a deal then live at different levels:

- **Marketing belongs to the building.** The media, the website, the documents
  and the brochure are the building's, and every space inherits them.
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
| On Space 1's broker team | Marketing ✓ · Vouchers index: Space 1 only | Space 1: both halves ✓ · Space 2: marketing ✓, voucher ✗ |
| Shared into the building | Marketing at their share level · no Vouchers index | Marketing ✓ on every space · Voucher ✗ |
| Back Office Manager (`view-other-vouchers`) | Vouchers index: every space | Voucher ✓ · marketing per role |

Two consequences worth stating plainly:

- **Working any space in a building earns that building's marketing.** That is
  where the space's own media and documents come from, so a suite broker who
  cannot open the building cannot do their job.
- **Being on the shell's team earns no space's money.** The shell team owns the
  assignment; the suite team owns the transaction.

A shell has no voucher of its own — it already shows a Vouchers *index* instead
(`dealNav.ts:346`). So `backOffice` on a shell means "may open the index", and
the index filters its rows per space.

### What this adds to the deals index

Space deals render as their own cards on `/listings` (`DealCard.tsx:158`), and
`visibleDeals` uses the same rule as the deal page. So a suite broker's index
grows: they now see every sibling suite in their building, and a person shared
into a building sees all of its suites. That follows from marketing being one
wall, and the card carries the suite label and address, never the commission. It
is the intended consequence, not a leak — but it is a visible change to how full
that page looks for a suite broker.

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
  /** Every space under the relevant shell — the shell's children when viewing
   *  the shell, the viewed space's siblings (itself included) when viewing a
   *  space. Undefined for a deal with no spaces. */
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

marketing = (onThis || onShell || onAnySpace)
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

- `useDealAccess(listing)` resolves the shell (`getListing(parentDealId)`), its
  shares (`dealShares.get(shellId)`), and the sibling or child spaces
  (`getChildDeals`), then passes them.
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
- **No seed change.** Nothing here moves `SEED_VERSION`; the existing 2 shells
  and 7 spaces exercise every row of the table.

## Testing

`dealAccessFor.test.ts` gains a case per row of the access table, plus:

- a shell team member on no space gets `backOffice: "none"`
- a suite broker reaches a sibling suite's marketing and not its voucher
- a building share reaches every space's marketing
- a deal with no family resolves identically with and without the argument

All pure, no store and no browser. Browser verification afterwards is the usual
breakage pass: open a building and a space as two different seats via "Viewing
as", confirm the sidebar, the gate redirect and the Vouchers index agree.
