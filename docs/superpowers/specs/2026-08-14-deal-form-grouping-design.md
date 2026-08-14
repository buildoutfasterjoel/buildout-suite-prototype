# Deal form grouping — design

Branch: `joel/deal-form-grouping`

Apply the Listing form's group/cluster hierarchy to the Deal edit form
(`/listings/:id/edit`), using the deal's own fields, and promote the shared shell
into a neutral home so the two forms stop depending on each other by accident.

## Why now

An audit of `fieldWidgets.tsx` (asked for after the listing-form grouping shipped
in #146) found that the label-gutter redesign had reached the Deal edit page
without anyone looking at it. `fieldWidgets` lives in `listings/edit/` but four
`deals/edit/` modules import it, so the gutter arrived on a form that was never
laid out for it:

- The broker **Split %** input collapses to **16px** at a 900px viewport —
  `col-md-4` minus the fixed 164px gutter. The value on the record is unreachable.
- "Deal Type" and the four read-only `(calc)` rows are raw top-labeled `Field`s
  sitting in the same grids as gutter-labeled fields.
- `SwitchRow` silently flipped label/switch order on the Deal page, and
  `FieldGrid` went `g-3` → `g-4`.

Contacts, properties, and tasks were **not** affected — nothing outside
`listings/edit/` and `deals/edit/` imports the widgets, and the SCSS class names
are prefixed such that no other element can match them. That containment is the
one thing this work must not break.

Redesigning the Deal form turns the accident into the intent: both long record
forms deliberately share one shell, and the layouts that the gutter broke get
fixed rather than papered over.

## Decisions

Four decisions were settled in brainstorming. Each records the alternative so a
later reader knows it was considered, not missed.

**1. Keep the three existing groups; do the work in clusters.**
Setup & Status / Transaction Terms / Financials stay as the group titles. The
alternatives — re-cutting into four groups (splitting brokers into "The Team"),
or collapsing to two ("Deal Setup" / "Money") — were rejected because the Deal
form carries 21 scalar fields to the Listing form's ~150. It is not big enough
to justify discarding section names brokers already know, and the two-group cut
would leave Financials an eight-cluster stack that reads as a wall again.

**2. A repeater becomes a table only when it is read down a column.**

The first pass of this decision said "repeaters become Blueprint tables with
column headers," generalizing from Unit Mix and Rent Roll (`b63507b`). That is
wrong, and `AdditionalTypesEditor` (`PropertySection.tsx:60`) disproves it: it
carries **two** fields per row — Type and Subtype — and deliberately is not a
table. It keeps per-cell gutter labels in a flex row with `flexBasis: 0` so the
pair splits the cluster width evenly. Field count per row is not the criterion.

The criterion is whether there is a column to scan:

| Repeater | Rows | Fields/row | Form |
|---|---|---|---|
| Unit Mix · Rent Roll | many | up to 10 | table — values compared down columns |
| Additional Property Types | 0–2 | 2 | stacked flex, per-field labels |
| Sale Bullets · Alias | few | 1 | stacked, one label for the set |

A header row earns its keep when there is something to compare down it. At two
rows there is nothing to compare, and the header costs more than it returns.

This also relocates the 16px input bug. The cause was `col-md-4` squeezing a
164px gutter inside a narrow grid column — **not** the gutter itself.
`AdditionalTypesEditor` already carries the fix: drop the grid column, use
`flex-grow-1` + `flexBasis: 0` so fields split the cluster's ~700px evenly. That
fix is independent of whether anything becomes a table.

Applied to the three deal repeaters:

- **Brokers** — Name + Split %, typically 1–3 rows (internal often 1, outside
  often 0). Additional-Property-Types shaped. → **stacked flex.**
- **Income / Expense line items** — Label + Amount, can reach 5–8 rows, and
  today has *no* per-field labels (placeholder "Label") plus a Total. It is
  already a headerless table. → **table**, with Item / Amount headers and Total
  in the footer.
- **Scenarios** — a named case plus three numbers plus reorder controls, 2–3
  rows. Each row is a titled thing rather than a record in a list. → **one small
  card each**, close to how it reads today.

**3. The four computed figures become readouts, not fields.**
They are outputs, so they stop being dressed as inputs. Each renders as a bold
body-size figure inside the cluster whose inputs produce it — the computed cap
rate sits under the entered one, which is exactly the comparison a broker wants.
Rejected: a separate read-only "Computed" cluster (keeps the fake inputs, just
consistently styled), and hiding all four behind a disclosure (hides numbers the
broker checks *while* typing the inputs that drive them).

**4. The shared shell moves to `src/components/common/recordForm/`.**
Both forms import from one place and the BEM prefix becomes honest. Rejected:
importing across the folder boundary (keeps `listing-form__` classes on deal
tiles and leaves the trap in place for the next audit), and copying the pattern
into `deals/edit/` (guaranteed drift, and only partial isolation since the
widgets stay shared regardless).

### Scope guardrail

This shell is for the two **long** record forms only — Listing edit and Deal
edit. Short forms — modals, filter flyouts, anything under roughly six fields —
keep plain stacked Blueprint `Field`s. The 164px gutter and the tile stack earn
their cost across twenty-plus fields and lose money on four.

Two conventions go into CLAUDE.md's Design System section as well as into the
module's header comment, because a convention that lives only in a spec
disappears when the spec is deleted on ship:

1. The record-form shell is for long record forms only — not for modals, filter
   flyouts, or anything under roughly six fields.
2. A repeater becomes a table only when it is read down a column (Decision 2).
   Field count per row is not the test.

## Module layout

```
src/components/common/recordForm/
  FieldGroup.tsx     FieldGroup · SubGroup · AdditionalFields      (moved)
  fieldWidgets.tsx   Text/Number/Date/Select/Combo/YesNoNa/Switch  (moved)
                     FieldGrid · Col · BulletsField · + Readout    (new)
  recordForm.scss    __subgroup-* · __more-* · __grid-table        (moved, renamed)
```

`listings/edit/listingForm.scss` **stays**, keeping its `listing-form__` prefix
for the three genuinely listing-only rules: `__coord-map`, `__channel-card`,
`__channel-icon`. Only the shell rules move. `__grid-table` moves because the
Deal form's two line-item tables need the same min-width floor.

`listingFormGroups.ts` stays put. The Deal form gets `deals/edit/dealFormGroups.ts`
beside it, same split — group list plus visibility rules, testable without
rendering.

Note on the rename: the SCSS nests rules as `&__x` inside `.listing-form`, which
compiles to flat `.listing-form__x` class selectors — **not** descendant
selectors. There is no `.listing-form` wrapper element anywhere in the TSX.
Containment therefore comes from the BEM prefix, not from CSS nesting, so
"sharing the shell" is a prefix rename, not a re-wrap. Nothing outside these
files can match the names either before or after.

Of the 13 `listing-form__` usages across 4 files, only **8 in 2 files** get
renamed — `FieldGroup.tsx` (7: the subgroup and disclosure classes) and
`UnitsSection.tsx` (1: `__grid-table`). The other 5 stay untouched with their
existing prefix, in `CoordinatePickerMap.tsx` (1) and
`MarketingVisibilitySection.tsx` (4), because those rules stay in
`listingForm.scss`.

## Group and cluster map

### Setup & Status · `faGear`

| Cluster | Gutter description | Contents |
|---|---|---|
| Classification | What kind of deal this is, and where it stands. | Deal Type *(read-only)* · Status |
| Listing Dates | When the listing agreement starts and ends. | Listed On · Listing Expiration |
| Internal Brokers | Who at your brokerage is on this deal. | stacked rows: Name · Split % |
| Outside Brokers | Co-brokers outside your brokerage. | stacked rows: Name · Split % |

### Transaction Terms · `faFileContract`

Hidden entirely when `dealShape(listing) === "shell"`, as today.

| Cluster | Gutter description | Contents |
|---|---|---|
| Price & Commission | What it sells for, and what you earn on it. | Sale Price · Gross Commission % · Gross Commission $ |
| Milestones | Confidence, and the dates that close it out. | Close Probability · Contract Executed · Close Date |

### Financials · `faChartLine`

Sale only (`dealType !== "Lease"`), as today.

| Cluster | Gutter description | Contents |
|---|---|---|
| Pricing | What the asset is priced at. | Asking Price · NOI · Cap Rate % · Hide price → **readout: computed cap rate** |
| Income | What the asset takes in. | GSI · Other Income · Vacancy % · line-item table → **readouts: total scheduled, vacancy cost, gross income** |
| Expenses | What it costs to run. | Operating Expenses · line-item table |
| Debt | How the purchase is financed. | Loan Amount · Down Payment · Debt Service · Cash Flow |
| Scenarios | Alternate underwriting cases. | one card each: Name · NOI · Cap Rate % · Cash Flow, reorderable |

Readout placement follows the calc dependencies in `src/data/listingFinancials.ts`:

- `totalScheduledIncome(GSI, otherIncome)` → Income
- `vacancyCost(GSI, vacancyPct)` → Income
- `grossIncome(totalScheduled, vacancyCost)` → Income
- `capRate(noi, askingPrice)` → Pricing

NOI therefore sits in Pricing, not Income: it is the numerator of the computed
cap rate, and the `noi()` helper (gross − opex) is never called on this form, so
NOI is a broker-entered input rather than a derived one.

`Hide price` joins the Pricing cluster at the *bound* tier (8px) beneath Asking
Price, because it governs whether that price is shown. It currently floats after
the calc rows inside a `maxWidth: 360` wrapper, which the new `SwitchRow` no
longer needs.

## Widget work

- **`Readout`** (new, in `fieldWidgets.tsx`) — muted small label, bold body-size
  figure, indented to align under the input column. Replaces the four
  `Field` + readOnly `Input` rows. Body-size bold rather than KPI tiles: this
  page already stacks many headings and figures.
- **Repeaters**, each to the precedent matching its own shape (see Decision 2):
  - `BrokerEditor` → stacked flex rows on the `AdditionalTypesEditor` pattern
    (`flex-grow-1` + `flexBasis: 0`, remove button hugging at the 8px bound tier).
    Drops the `col-md-7` / `col-md-4` / `col-md-1` grid that caused the 16px
    input, and with it the `align-items-end` + `pb-1` alignment that was
    calibrated for stacked labels.
  - `LineItemEditor` → Blueprint `Table dense` + `record-form__grid-table`,
    mirroring `UnitsSection`. Item / Amount headers; the existing Total moves
    into the table footer.
  - `ScenarioEditor` → one card per scenario, keeping the name input as the card
    title and the up/down controls beside it; the three numbers stay
    gutter-labeled fields inside the card, laid out with the same `flexBasis: 0`
    split rather than `col-md-4`.
- **Responsive floor** — a `min-width` on the control plus a stacked-label
  collapse below `md`. Fixes the Listing form's own clipping at 900px
  (`Property Use` renders as `O(`, `Investment Type` wraps to `Va A`) in the same
  stroke, since it is the same missing floor.
- **Read-only field variant** so Deal Type stops being the odd one out.
- **Delete** the dead commented-out `TextField` body at `fieldWidgets.tsx:71-92`
  (unreachable code after an unconditional `return`).

## Invariants

Presentation-only change. No data-model change, no `SEED_VERSION` move, no route
change, no new vocabulary. These must all still hold afterward:

- **Three re-seed effects** in `DealEditor` — ingestion-status transition,
  stage-gate history length, and conflict resolution — untouched, including
  `gateBase`'s advancing-ref behavior and the deliberate *absence* of a fourth
  ref on the resolve path.
- **`dealSavePatch`** and the single Save/Cancel bar — untouched.
- **Bi-directional Sale Price ↔ Commission % / $** math preserved exactly
  (`setSalePrice` / `setCommissionPct` / `setCommissionAmount`).
- **Ingestion arbitration rows.** `NumberField`'s `fieldKey` on `askingPrice` and
  `noi` must survive the move into clusters. Neither may ever be placed inside an
  `AdditionalFields` disclosure: Blueprint's `Collapsible` keeps closed content
  mounted at `display: none`, so `getElementById` resolves but `scrollIntoView`
  is a silent no-op and the field stays invisible. The no-disclosure decision
  satisfies this today; this note exists so nobody adds one later.
- **`?review=ingestion`** still scrolls to the first disputed field this page owns.
- **Gating** — `shape !== "shell"` hides Transaction Terms; `isSale` hides
  Financials.
- **Containment** — nothing in `contacts/`, `properties/`, or `tasks/` gains a
  dependency on the shell, and no short form adopts it.

## Testing

- `bunx tsc --noEmit` — the gate that actually catches the file move
  (`vite build` does not type-check).
- `bun --bun run test` — 940 tests currently pass; the move must keep them green.
  One known non-gate: a `react`/`module is not defined` line on stderr.
- New `dealFormGroups.test.ts`, mirroring `listingFormGroups.test.ts`, covering
  group visibility across shell / lease / sale.
- Playwright verification of five states: lease deal (Setup + Terms, no
  Financials), sale deal (all three groups), shell deal (Setup only),
  `?review=ingestion` arbitration row rendering and scrolling, and a 900px
  viewport with no control narrower than its content.

## Out of scope

- The pre-existing hydration mismatch at `GlobalNavbar.tsx:172` (the "New"
  dropdown trigger, at collapsed-navbar widths). Unrelated to this work.
- Any change to the Listing form's grouping. It gains only the responsive floor
  and the shell's new home.
- The Deal form's state logic, per Invariants.
