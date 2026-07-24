# Buildout Listing Creation & Property Edit Form — Field & Logic Reference

> Purpose: a plain-language inventory of every field a user can fill out when creating/editing a property listing, and every show/hide/required/relabel rule tied to it — intended as source material for a prototype PRD. Organized by what the user actually sees, not by how it's built.

---

## How the flow works, end to end

1. **Creation entry point** — clicking "New Listing" opens a choice of three paths: start from an existing property record, start from scratch, or upload documents and let AI extract the details. Each path leads to a short wizard that captures just the essentials (address, property type, broker, sale-or-lease) and checks for a possible duplicate address before actually creating the listing.
2. **Full property edit form** — immediately after creation (and for all later edits), the user lands on one large, single-page form with a left-hand section navigator. This is the same form for "create" and "edit" — a brand-new listing just starts blank. It adapts heavily based on: whether the listing is for Sale, Lease, or both; the property's type/subtype (Office, Retail, Industrial, Land, Multifamily, Condo, Hospitality, etc.); the listing's current deal status; and a number of company-level settings (which features/sections a given account even has turned on).

---

## PART 1 — Creating a New Listing (entry wizard)

### Choosing a starting point
Clicking "New Listing" shows up to three options, each conditionally available:

| Option | Shown when |
|---|---|
| From an Existing Property | The account has CRM/research-database access |
| From Scratch | Always available |
| From Documents | The org has document-upload listing creation enabled |

### Path A — From an Existing Property
One screen:
- **Select an existing property** — type-ahead search by name/address. Required.
- **Broker(s)** — appears only if the account doesn't have a single default broker auto-assigned. "Primary Broker" plus "+ Add another broker" rows (2nd, 3rd, …), each removable except the primary, up to a configured max. Required.
- "Create new listing" stays disabled until required fields are complete.

### Path B — From Scratch
A multi-step wizard.

**Step B1 — "Create a new listing"**
Always-visible fields:
- **Country** — dropdown, only shown if the org operates in multiple countries. Required.
- **Address** — free text with live autocomplete (picking a suggestion fills City/State/Zip/County). Required.
- **City** — required. **State/Province** — dropdown, label/options/required-ness change per Country, disappears if the country has no state concept. **Zip/Postal Code** — required where applicable, disappears for countries without postal codes.
- **Broker(s)** — same picker as Path A; hidden if a default broker is configured.
- **Primary Property Type** — dropdown. Required.

Conditionally-visible fields (only appear if pre-filled by an earlier AI document-extraction step): County, Property Name, **Sale or Lease** (dropdown — also becomes required, independent of AI data, if the org's proposal-document feature is on and the user clicks "View Proposal"), a pair of **AI Content Generation** toggles that swap between "sale description/highlights" and "lease description/highlights" depending on the Sale/Lease answer (both default off), Location Description, Building Size, Building Class (A/B/C), **Sale Price** (only if Sale/Lease = Sale), **Lease Rate** (only if Sale/Lease = Lease), Lot Size, Number of Units, Zoning, Year Built, Year Renovated, Occupancy %, and an optional feedback text box (shown only after a successful AI import).

AI-populated fields show a sparkle icon until hand-edited; AI-estimated (not exact-match) fields also show an info tooltip: "An exact match wasn't found in the document, so this value was predicted based on context. Please review for accuracy."

Buttons: **Search/Create Listing** (label changes once a search has run with no match found; disabled until required fields are complete), **View Proposal** (only if proposal feature is on and Sale/Lease is answered), **Back**.

**Step B2 (conditional) — Address Correction** — shown only if the search finds possible existing matches. Radio list: "Address Entered" plus each suggested match (defaults to the top match). Broker(s) field repeats if not already assigned. Buttons: Back, Create Listing.

**Step B3 (automatic)** — if no matches are found, the listing is created directly from Step B1 with an informational banner ("address not found in Insights, creating new property").

### Path C — From Documents
Three parts:

**C1 — Upload modal:** drag-and-drop or browse; PDF/Word/Excel/PowerPoint; up to 5 files/batch. Shows per-file errors (wrong type, over limit) and a validation banner. "Upload Files" disabled until at least one valid file is present.

**C2 — Background processing toast** (no fields): cycles through uploading → extracting → done (success, or success-with-issues, or error), each with an appropriate call-to-action button ("Confirm details" / "Review").

**C3 — "Review Listing Details" modal:** two dynamic sections decided once when the screen opens:
- **"Action Required"** — shown only if required fields came back empty (Country, Address, City, State, Zip, Property Type, Broker(s), Sale or Lease), each flagged with a warning icon.
- **"Review for Accuracy"** — every other extracted field, same set as Step B1's conditional fields, same sparkle/info-icon treatment, same Sale/Lease-driven gating (Sale Price vs. Lease Rate, AI toggle pair).

Buttons: **Delete** (with confirmation, only if this review session is persisted), **View Proposal** (same gating as Path B), **View Property Details** (requires all required fields resolved; can trigger the same Address Correction sub-step as Path B if duplicates are found).

### Notes for the prototype
- **Broker assignment** is identical across all paths and hidden whenever a single default broker is configured — treat it as one reusable field group.
- **Sale/Lease** is the single biggest pivot in the creation flow: it gates Sale Price vs. Lease Rate and which AI-generation toggle pair shows.
- **Country** drives State and Zip's presence, labels, and required-ness as one dependent group, not three independent fields.
- A large "detail" field cluster (Property Name, Location Description, Building Size/Class, Lot Size, Units, Zoning, Year Built/Renovated, Occupancy) only ever appears when AI extraction supplied a value — there's no manual "add more fields" affordance at creation time. Everything else gets filled in on the full edit form next.

---

## PART 2 — The Full Property Edit Form

Used to both create (right after the wizard above) and later edit a listing. Left-hand navigation includes: **Database** (conditional), **Settings**, **Brokers**, **Branding** (conditional), **Custom Fields** (conditional), **Location**, **Transit** (conditional), **Property**, **Building**, **Units** (conditional), **Land** (conditional), **Sale**, **Lots**, **Condos** (conditional), **Financials**, **Lease**, **Lease Spaces**, **Disclaimer & Notes**.

A company-level **"streamlined sync" mode** (used by certain integration-connected accounts) is the single biggest branching factor in the whole form: it removes the Units and Land sections outright and, within Location/Property/Building/Sale, replaces the large "additional fields" panels with a short fixed set of essentials only. Sections below call this out wherever it applies. A separate company setting can force **all optional/collapsed sections to display expanded by default** instead of collapsed.

### 1. Database *(conditional section)*
Shown only if the user has access to at least one research/comps database.
- **Database** — dropdown (grouped list). Conditionally required.

### 2. Settings
A small header with **Created**/**Updated** timestamps (shown only if both exist) plus two values that live entirely inside the Sale/Lease Marketing Visibility panels below (Syndication on/off, "hide from other brokers") — no separate controls here, this area just displays/carries them.

### 3. Brokers
| Field | Type | Notes |
|---|---|---|
| Primary Broker | Dropdown of eligible users | Required. Becomes **read-only** with a "why can't I change this?" tooltip if the listing is actively syndicated under that broker externally — must be taken off market first to change. |
| 2nd Broker, 3rd Broker, … | Repeatable rows, hidden until "Add another broker" is clicked | Optional, up to a configured max |
| "Property's Office" vs. "Other Office" | Radio per broker row | Switching to "Other Office" swaps the normal user dropdown for an outside-brokerage search field |
| Pending Invites | Read-only table (email + Cancel) | Lists outstanding invitations to outside brokers who haven't joined yet |

**Dynamic behavior:** switching a row to Outside Broker clears/disables the inside picker and enables the outside search (and vice versa). Searching and picking an unrecognized name opens an "Invite New Outside Broker" modal pre-filled with that name; if the person turns out to already exist as an outside broker, they're auto-selected instead. Once assigned, a row shows the broker's name with a "remove" control. Checking "Push to Connect" (syndication) marks **Investment Type** (in the Sale section) as required. If Property Use is a "value-add" type and no Investment Type is chosen yet, it auto-defaults to "Core."

### 4. Branding *(conditional section)*
Shown only if the company has more than one brand/template option.
- **Branding** — dropdown, required, no blank option.

### 5. Custom Fields *(conditional section)*
Shown only if the company has configured custom property fields. Renders whatever fields the company defined (varies per account).

### 6. Location
| Field | Type | Required | Notes |
|---|---|---|---|
| Country | Dropdown | Required | Visible as a field only for international properties; otherwise set silently. Determines whether State/Zip/County are required, whether Zip/County even show, and whether "A+" is offered as a Building Class option. |
| Country Name Override | Text | Required | Only for international properties, or if a non-standard country is chosen elsewhere in the flow. |
| Currency / Currency Format / Language | Dropdowns | Required/Optional | Only for international properties. Currency auto-selects based on Country (unless already manually set), which cascades into every currency-labeled field across the form (see Financials). |
| Measurement System | Dropdown (Imperial/Metric) | Optional | Only shown if the company allows metric; switching it relabels every length/area field across the whole form (feet↔meters, sq ft↔sq m) and shows/hides the matching imperial-only or metric-only fields. |
| Address | Text, with live autocomplete | Required | |
| City / State-Province / Zip | Text or dropdown | Required | State's type/label and Zip's presence depend on Country, as above. |
| Hide Address | Checkbox | Optional | Reveals **Display Address As** (override text) when checked. |
| Override Map Location | Checkbox | Optional | Reveals **Latitude/Longitude** fields plus an interactive map. |
| County / Market / Submarket / Cross Streets | Text | Optional | County only where the country tracks counties. |
| Location Description | Rich text w/ AI-assist | Optional | |
| Display Location Description for Syndication | Checkbox | Optional | Hidden entirely without syndication permissions. |
| **"Show/Hide Additional Fields"** | Expand/collapse | — | Not shown at all in streamlined-sync mode. Otherwise reveals: Township, Range, Section, Side of Street, Street Parking (Y/N/NA), Signal Intersection (Y/N/NA), Road Type, Market Type, Nearest Highway, Nearest Airport. Expanded by default if the company has the "always show everything" setting. |

**Dynamic behavior:** any change to Address/City/State/Zip/Country/Hide-Address (while Lat/Long isn't manually overridden) silently re-geocodes the property in the background. Entering a Zip auto-fills City/State/County when they're empty. A non-standard Country reveals the free-text Country Name Override.

### 7. Transit *(conditional section)*
Shown only if the company has transit-overview enabled. Displays a checklist of nearby transit lines, or a "not available for this location" message if none are found.

### 8. Property
| Field | Type | Required | Notes |
|---|---|---|---|
| Primary Property Type | Dropdown (Office, Retail, Industrial, Land, Multifamily, Special Purpose, Hospitality, Residential in some contexts) | Required | Drives the subtype list and downstream section visibility (see "Type effects" below). |
| Property Type Label Override | Text | Optional | Hidden behind an "Override label" link until clicked. |
| Primary Property Subtype | Dropdown, filtered to the chosen type | Required | |
| Additional Property Type(s) | Repeatable type+subtype rows, removable | Optional | |
| Property Name / Zoning / APN# | Text | Optional | |
| Alias(es) | Repeatable text rows | Optional | |
| Lot Size + unit | Number + dropdown | Conditionally required | Auto-marked required whenever the property is "land-like" (Land type, Mobile Home Park subtype, or Retail Pad subtype), unless the company has disabled that requirement or the auto-toggle is turned off for this property. |
| **If streamlined sync:** Lot Frontage, Power Description only | Text | Optional | |
| **Otherwise**, "Show/Hide Additional Fields" reveals a large block | Mixed | Optional | Lot Frontage, Lot Depth, Corner Property, Traffic Count (+ Street/Frontage variants), Site Description, Amenities, Waterfront, MLS ID#, Thomas Guide Page #, Power (+ description), Rail Access, Gas/Propane (+ description). |

**Type effects (Property Type/Subtype driving other sections):** Office reveals Building Class; Retail reveals Retail Clientele; Industrial reveals a cluster of industrial-only building/lease fields (dock doors, cranes, warehouse %, rail access, etc.); Land reveals Rail Access plus the Lots and Land sections while hiding Units/Building-general fields; Multifamily makes Number of Units visible and required; Hospitality hides the "Include Rent Roll" option; selecting a Condo subtype (under Office/Retail/Industrial) swaps the standard Financials section for Condo-specific financial fields; Multifamily/Hospitality/Self-Storage hide the "For Lease" option entirely (these are treated as sale-only types).

### 9. Building
| Field | Type | Notes |
|---|---|---|
| Building Size, Occupancy %, Year Built, Year Last Renovated, Number of Floors, Average Floor Size, Ceiling Height, Minimum Ceiling Height, Office Space (industrial) | Number | Optional |
| Building Class | Dropdown A/B/C (+A+ for eligible countries/subtypes) | Optional |
| Tenancy | Dropdown: Single / Multiple | Optional. Driving other rules (see Lease Spaces). |
| Industrial-only cluster (Grade Level Doors, Dock High Doors, always shown; plus Drive-in Bays, Number of Cranes, Dock/Crane/Sprinkler descriptions, hidden in streamlined sync) | Mixed | Shown for Industrial property type |
| **If streamlined sync:** Number of Units, Column Space, Number of Parking Spaces, Parking Ratio | Mixed | Conditional |
| **Otherwise**, "Show/Hide Additional Fields" reveals a very large block | Mixed | Overhead Door Height, Column Space, Gross Leasable Area, Load Factor, Construction Status, Parking Ratio/Spaces/Price/Type, Laundry/Plumbing/Exterior/Interior descriptions, Sprinklers, Trailer Parking, Warehouse %, Framing, Condition, Security Guard, Handicap Access, Freight Elevator, Number of Elevators/Escalators, Central HVAC, Broadband Type, Centrix Equipped, Roof, Free Standing, LEED Certified, Retail Clientele Type, Number of Buildings, Construction Description, Walls, Ceilings, Floor Coverings, Restrooms, Landscaping, Corridors, HVAC, Foundation, Elevators, Exterior Walls, Mezzanine, Office Buildout, Parking Description, Utilities Description, Loading Description. |

### 10. Units *(conditional section — hidden in streamlined sync)*
| Field | Type | Notes |
|---|---|---|
| Number of Units | Number | Conditionally required (company toggle) |
| Include Unit Mix | Checkbox | Reveals the Unit Mix table and a "Syndicate Unit Mix" checkbox |
| Rent Roll | Sub-form | See Part 2, section 15 below |
| Unit Mix breakdown | Sub-form | See Part 2, section 14 below |

### 11. Land *(conditional section — hidden in streamlined sync)*
| Field | Type | Notes |
|---|---|---|
| Number of Lots, Best Use | Number/Text | Optional |
| "Show/Hide Additional Fields" reveals | Mixed | Irrigation/Water/Telephone/Cable (each Y/N/NA + description), Sewer (Y/N/NA), Environmental Issues, Topography, Soil Type, Easements Description |

### 12. Sale
| Field | Type | Required | Notes |
|---|---|---|---|
| Sale Closing Info, Sale Title | Text | Optional | |
| Sale Description, Sale Bullets | Rich text w/ AI-assist | Optional | Feed the "Property Description"/"Property Highlights" of generated marketing documents |
| Property Use | Dropdown: Net Leased Investment / Investment / Owner-User / Business for Sale / Development | Optional | |
| Investment Type | Type-specific control | Conditionally required | Required when pushing to syndication/distribution network, or when "Buildout Buyer Network" is turned on in Sale Marketing Visibility |
| Includes Real Estate | Checkbox | Optional | Hidden in streamlined sync |
| Years Left on Lease (NNN), NNN Lease Expiration | Dropdown/Date | Optional | "NNN only" group; hidden in streamlined sync |
| Commission % | Number | Optional | Confirmation popup if entered over 10% (per-company setting); hidden in streamlined sync |
| Auction | Checkbox | Optional | Reveals Auction Date/Time/Location/Starting Bid/URL |
| Tax per unit | Currency | Optional | Hidden in streamlined sync |
| "Show/Hide Additional Fields" (non-sync only) reveals | Mixed | Sale Terms, Reimbursement, Capital Costs, Loan Due Date, Loan Description, Taxes, Tax Value (Land/Improvements/Personal Property), Assessed Value, 1031 Exchange (Y/N/NA), Consider Exchange (Y/N/NA), Land Ownership, Land Legal Description |

**Deal status control:** a "pizza tracker" with stages Proposal / Active / Under Contract / Closed / Inactive. Selecting **Closed** reveals Close Date (auto-filled today) and a Buyer/Referral Source field, plus a "Closed Listing" alert. Selecting **Sale Pending** puts the whole form into a "sale proposal" state used elsewhere on the page.

### 13. Lots *(always present)*
Repeatable cards, one per lot (subdivision-style breakdown). Fields per lot: Deal Status chips, Close Date, Buyer/Referral Source (conditional on lead-management being enabled), Lot Number, Address, APN, Property Subtype (land-related), Sale Price + Price Units (Total/SF/SqM/Acre/Hectare), Size + Units, Description, Zoning. "Add a lot," drag-to-reorder, duplicate, soft-delete-with-undo (blocked if the lot already has a deal, with an explanatory tooltip).

### 14. Condos *(conditional section — only if condos enabled for the account)*
Repeatable cards, one per unit. Fields: Deal Status chips, Close Date, Address 2 (unit identifier), Sale Price + Price Units (Total/SF/SqM only — no Acre/Hectare), Hide Price (reveals a label override when checked), Size + Units (Sq Ft/Sq Meters), Description. Same duplicate/delete/undo pattern as Lots (blocked if a deal exists).

### 15. Financials
Supports **multiple named financial statements** (first is "Primary Financials," others default "Statement 2," etc.), each a collapsible card; a toggle switches between a single simplified view (streamlined sync) and the full advanced view with multiple statements (standard accounts).

**Per statement:**
| Field | Type | Notes |
|---|---|---|
| Statement Name | Text | Optional |
| Sale Price | Currency | |
| Sale Price Units | Dropdown: Total / per SF / per SqM / per Acre / per Hectare | Acre/Hectare not offered for Condo statements; imperial/metric options depend on unit system |
| Hide Price | Checkbox | On the **primary statement only**, also reveals Hidden Price Label Override and "Exclude from search results when price filter applied" |
| Display Financial Fields on Plugin | Checkbox | Shows a "Syndicated" badge next to calculated fields |
| RevPAR, ADR | Currency | **Hospitality only** |

**Scheduled Income:** Include Income Breakdown (checkbox, toggles a repeatable Name+Amount table), Gross Scheduled Income, Other Income (both hidden for Hospitality), Total Scheduled Income (calculated: Gross + Other, or sum of the breakdown table if enabled; manual override wins if entered), Vacancy % and Vacancy Cost (hidden for Hospitality; Cost = Gross × %), Gross Income (Total Scheduled − Vacancy Cost).

**Expenses:** Include Expense Breakdown (toggles a Name+Amount table), Operating Expenses (auto-summed only if breakdown is enabled; otherwise manual).

**Returns (all editable + calculated, manual entry always wins):** NOI (Gross Income − Expenses), Cap Rate (NOI ÷ Price), GRM (**Multifamily only**, Price ÷ Gross Scheduled Income), Debt Coverage Ratio (NOI ÷ Debt Service), Cash-on-Cash Return (Pre-Tax Cash Flow ÷ Down Payment).

**Financing:** Include Loan Breakdown (toggles a table with Name, Amount*, Interest Rate*, Loan Period, Maturity Date, auto-calculated Debt Service, Interest Only checkbox — *required per row), quick-add buttons for 80/20, 75/25, 70/30 splits (pre-fills amount as that % of Sale Price); Loan Amount (sum), Down Payment (Price − Loan Amount), Debt Service (sum), Pre-Tax Cash Flow (NOI − Debt Service), Principal Reduction Year 1, Total Return (Cash Flow + Principal Reduction).

**Known issue to flag:** Cap Rate, Debt Coverage Ratio, and Cash-on-Cash can display "0.00" instead of staying blank in edge cases (e.g. NOI entered but Price blank) — worth a product decision on whether the prototype should preserve or fix this.

**Repeatable tables (Income/Expense/Loan):** duplicate row, soft-delete with undo, drag-reorder, "add a row"/"add 5 rows." Income table has two shortcuts unique to it: "Add Rental Income" and "…x12," which pull the current Rent Roll total and insert it as an income line.

Statements themselves can be duplicated, soft-deleted, drag-reordered, or added fresh via "+ Add Financial Statement."

### 16. Lease
| Field | Type | Notes |
|---|---|---|
| Lease Title, Lease Closing Information | Text | Optional |
| Lease Description, Lease Bullets | Rich text w/ AI-assist | Feed generated document sections |
| Commission Split % | Percent | Optional |
| Available SF Term (SF vs. RSF) | Dropdown | Only appears for one specific customer account — a known one-off exception |

**Deal status control:** only two stages for Lease — Proposal / Active (simpler than Sale's five).

### 17. Lease Spaces *(shown for lease listings; most field-heavy sub-form)*
Repeatable cards, one per leasable space/suite. Fields: Deal Status chips (Active/Under Contract/Closed/Inactive), Close Date, Space Type (subtype dropdown — driving land-like rate/size units), Space Type Label Override, Tenant Name (**required if "Major Tenant" is checked**), Major Tenant checkbox (only for companies with that feature), Space Name/Suite/Floor/Zip+4, Lease Rate Units (radio: currency per SF/SqM/Acre/Hectare per year or month, or flat annual/monthly — Acre/Hectare only for land-like space types), Lease Rate Unit Label Override, Lease Rate itself as **Flat / Range / Hidden** (range adds a second "to" field; hidden adds a label override), Space Size + Units, Lease Type (+ label override), Lease Term (months), Sublease checkbox (reveals Sublease Expiration date), Date Available, Min Divisible / Max Contiguous area, Ceiling Height, Description (AI-assisted).

**Industrial-only cluster:** Previous Usage, Office Space, Grade Level/Dock High Doors, Drive-In Bays, Number of Cranes, Power Description (trimmed to just two fields for a specific integrated-sync context).

**"Additional Fields" collapsible block** (collapsed by default unless the company forces expansion): Sale Price, Warehouse Allotment %, Parking Spaces, Conference Rooms, Offices, Furnished, Heating/Cooling/Lighting (each Y/N/NA + description), HVAC Tonnage, TI Allowance, Free Rent, Signage Available, Rent Escalators (+ description), Rent Concession, Moving Allowance, Lease Buyout Allowance, Net Lease Investment, Tax/Tax Stops/Expenses/Expense Stops/CAM Charge/CAM Expense Stops/Insurance (per unit area), % Procurement Fee, Tenants Pay Gas/Electric/Water (each Y/N/NA), Sublease Allowed, Lease Terms (free text), External ID (read-only, specific accounts only). Whole block hidden for the integrated-sync context.

**Custom Fields:** company-defined, shown if configured.

**Dynamic behavior:** if Tenancy (Building section) is anything but "Single Tenant," Address/Suite becomes required per space. Collapsing a space force-hides its industrial fields if the property isn't Industrial. Adding a new space defaults its Space Type to the property's primary subtype. Duplicate/delete-with-undo (blocked if a deal exists) and drag-to-reorder, same pattern as Lots/Condos.

### 18. Unit Mix *(inside Units; hidden entirely for Land properties)*
Repeatable table summarizing unit *types* (not individual units) — e.g. "1 Bed/1 Bath," count, size, rent. Controlled by "Include Unit Mix" (turns the section on) and "Syndicate Unit Mix" (controls public visibility). Per-column show/hide checkboxes in the header control what's public.

Columns: Sort (drag), Unit Type (relabeled "Room Type" for Hospitality), Bedrooms, Bathrooms, Count, % of Total (calculated), Size, $/area/yr, Rack Rate, Rent, Min/Max Rent, Market Rent, Rent/area (calculated), Annual Rent (calculated), Security Deposit, Description, custom fields.

**Column set changes by property type:** Multifamily shows Bedrooms/Bathrooms/Rent/Min-Max-Market Rent/Rent-per-area/Security Deposit, hides $/area/yr, Annual Rent, Rack Rate. Hospitality shows Rack Rate + Description (relabels Unit Type → Room Type), hides most rent columns. All other types show $/area/yr and Annual Rent instead. Totals footer sums Count/Size/Rent/etc. live. Rows: duplicate, delete (soft), drag-reorder, add 1 or 5 at a time.

### 19. Rent Roll *(inside Units; hidden for Hospitality regardless of setting)*
Repeatable table of individual tenants/units (actual, not summarized) — controlled by "Include Rent Roll" checkbox; "Syndicate Rent Roll" checkbox appears only for specific enterprise accounts. A header toggle switches the whole table between **Annual** and **Monthly** rent display (stored annually, converted for display).

Columns: drag handle, expand (opens a per-row panel), Suite (relabeled "Unit" if the property is exclusively Multifamily), Type (dropdown — **only shown if the property has more than one assigned property type**), Beds/Baths (Multifamily only), Tenant (hidden if exclusively Multifamily), Size, %-of-Building (calculated from Building Size; hidden if exclusively Multifamily), $/area/yr or /mo (hidden if exclusively Multifamily; disabled on a row if that row's Type = Multifamily), Rent (hidden unless the property has a Multifamily type; disabled if a row's Type ≠ Multifamily), Market Rent (always available), Rent/area (calculated, hidden unless Multifamily present), Annual/Monthly Rent (calculated), Security Deposit, Lease Start/End dates, custom fields.

**Auto-fill:** if any two of {Size, $/area/yr, Annual Rent} are known, the third is computed automatically.

**Per-row expandable panel:** Rent Escalations (repeatable Date + $/area/yr pairs), Comments, Recovery Type.

**Values feeding this table live elsewhere on the form:** currency symbol follows the form's Currency selector; unit labels follow the Measurement System selector; %-of-Building follows the Building Size field — all update instantly without saving.

Rows: duplicate (including escalations), soft-delete, drag-reorder, add 1 or 5 at a time; totals footer live-sums Size/Rent/Market Rent/Annual-Monthly Rent/Security Deposit.

### 20. Sale Marketing Visibility
Channel cards (pick one; "None" turns everything else off):
1. **None** — "market to my own contacts or nowhere" — *Fully Private* — always available.
2. **Buildout Buyer Network** — "private buyer network, best for double-ending deals" — *Private*.
3. **My Brokerage Website** — "increase exposure via my company's website plugin" — *Public*.
4. **Buildout Syndication Network** — "maximize exposure via Buildout's sale listing sites" — *Fully Public* — hidden company-wide without syndication entitlement.

Plus: **Hide from Non-Listing Brokers** checkbox (shown only for statuses the company has configured as "shared internally"), and a read-only **disconnect warning** ("disconnecting syndication will remove your listing from N channels") shown only when currently connected to external channels.

**Rules:** available channels depend on deal status — Active offers all four; Under Contract offers all but Syndication; Inactive/Proposal offer only None; Closed offers only None unless the company's website plugin is configured to include closed listings (then Brokerage Website stays available). Buyer Network and Syndication are mutually exclusive (turning one on turns the other off; while Syndication is on, Buyer Network is disabled with an explanatory tooltip). Turning on Buyer Network marks **Investment Type** (Sale section) as required.

### 21. Lease Marketing Visibility
Same pattern, simpler: **None** (always available), **My Brokerage Website**, **Buildout Syndication Network** (hidden without entitlement) — no Buyer Network option for leases. Same "Hide from Non-Listing Brokers" and disconnect-warning rules. Available channels: Active offers both Website and Syndication; Proposal offers only None.

### 22. On-Market Disclaimer *(modal, not inline)*
Triggered automatically if the user tries to save a listing that requires disclaimer sign-off and hasn't signed yet (suppresses the normal error banner in favor of this modal). Fields: read-only disclaimer text, read-only Address/Name, **"I have read and agree to the Terms"** checkbox (required to enable Sign), a signed-timestamp display once checked. Buttons: Cancel (resets and closes), Sign Disclaimer (records signature, disabled until agreed, then re-submits the save). Once signed, both buttons lock for the session.

### 23. Buyer *(Sale only, appears only when status = Under Contract)*
- **Buyer** — searchable lookup of contacts/leads, with an inline "+ Create new lead" action. Conditionally required (company setting).
- **Referral Source** — dropdown, clearable. Conditionally required (business rule); auto-fills from the chosen buyer's record if one exists on file.
- Entire block only exists for companies with lead-management enabled and without the buyer-requirement disabled.

### 24. Visual Media / Virtual Tour Embeds
Thumbnail grid, one entry per media link. Per item: thumbnail preview, selection checkbox, **Public URL** text field, **Media Type** dropdown (Interactive Site Plan, Aerial 360 Map, Aerial 360 Rendering, 360 Rendering, Property Marketing Video, Matterport Tour, 360 Tour — defaults to the first option). "+ Add Visual Media Link" adds a blank entry. Bulk toolbar: Select All, bulk delete, bulk preview (open all selected in new tabs) — both bulk actions disabled until something is selected. No sale/lease/property-type differences. (Deleting a saved entry soft-marks it; a never-saved entry is removed outright.)

### 25. Disclaimer & Notes
- **Disclaimer override cluster** (Copy Default Disclaimer link, Override Disclaimer checkbox, Custom Disclaimer text) — only shown to users with permission to edit disclaimers; for everyone else this whole cluster and its heading are omitted (heading reads just "Notes" instead).
- **Internal Notes** — textarea, always visible.
- **Admin Notes** — textarea, visible only to internal Buildout admin users.
- **External ID** — read-only, shown only for accounts with a specific display customization.

### 26. Save / Cancel bar (bottom, and duplicated at top when scrolled)
- **Cancel** — always present (behaves slightly differently if arriving from a document-generation flow — closes back into that flow instead).
- **Delete** — only for listings still in draft status; asks for confirmation.
- **Save as Draft** — only while the listing is still a draft/brand-new; disappears once published.
- **Save Listing** — always present, primary action.
- **"Update Sync"** — admin-only, only on already-saved (non-draft) listings, only for accounts connected to a specific external sync partner; includes a caution note it should only be used if fields haven't changed.

**Submission rules:** saving while syndication is managed and the Sale/Lease Title contains "off market" or "closed" triggers a confirmation warning that the listing will still syndicate publicly. Missing a required Primary Broker or (non-draft) Database blocks save with a message. Server-side validation errors render as a clickable list that scrolls to, expands, and highlights the offending field/section. If the disclaimer is the only error, the general error list is suppressed in favor of the disclaimer modal. Leaving the page with unsaved changes triggers a native browser warning.

**A special first-save behavior:** right after a brand-new listing is created, the user is dropped back into this same form (titled "Create Listing"); in that specific state, clicking Cancel actually **deletes** the just-created draft rather than just navigating away.

---

## PART 3 — Cross-Cutting Rules Worth Designing Around Explicitly

These aren't separate sections — they're dependency chains that touch many sections at once, so they deserve to be modeled as shared rules in a prototype rather than re-implemented per field:

1. **Sale / Lease as independent tracks.** A listing can be for sale, for lease, both, or (temporarily) neither — each track has its own status ladder, dates, description/bullets, and dedicated section (Sale vs. Lease/Lease Spaces). Neither checked shows a "not currently available" state.
2. **Property Type/Subtype cascades widely.** It determines: which subtype list is offered; whether Lease is even offered (Multifamily/Hospitality/Self-Storage are sale-only); whether Financials shows condo-specific fields instead of standard ones; which Building/Lease-Space "industrial-only" fields appear; whether Rail Access, Building Class, or Retail Clientele show; auto-required-ness of Lot Size; and which Unit Mix/Rent Roll columns are relevant.
3. **Deal Status is the second-biggest driver.** It gates: which marketing channels are selectable; whether "Hide from Non-Listing Brokers" appears; whether the Buyer/Referral Source block appears (Sale, Under Contract only); whether Close Date + Referral Source show on any Lot/Condo/Lease Space card; and the visual "chip" state throughout.
4. **Currency and Measurement System are global settings that recolor the whole form live** — every currency-labeled field and every length/area label updates immediately when either changes, including inside Rent Roll and Financials, without needing to save.
5. **Company-level entitlements hide entire regions of the form outright**, independent of anything the user picks: Database section, Branding section, Custom Fields, Transit section, Condos section, Syndication channel + disconnect note, Buyer widget (needs lead-management), "Hide from Non-Listing Brokers" (needs the status to be one the company shares internally), "Syndicate Rent Roll"/"Syndicate Unit Mix," Admin Notes, External ID, and the entire "streamlined sync" simplification of Location/Property/Building/Sale/Financials/Units/Land.
6. **"Show/Hide Additional Fields" is a repeated UI pattern**, not a one-off — Location, Property, Building, and Sale each have their own large collapsed "additional details" block, all collapsed by default unless the company has a setting to always expand everything.
7. **Auto-calculation with manual override is the norm in Financials, Rent Roll, and Unit Mix** — every derived number (NOI, Cap Rate, %-of-Building, Rent/area, totals, etc.) shows a live-calculated value that a manual entry silently overrides and "wins" over, rather than a strict read-only computed field.

## Anomalies to flag for engineering/design decisions
- **Status Banner** widget doesn't appear to be wired into the live edit screens — confirm if it's legacy or reserved before designing around it.
- **"Available SF Term (SF vs RSF)"** field in the Lease section is hardcoded to one specific customer account — a known one-off, not a general product rule.
- **Cap Rate / Debt Coverage Ratio / Cash-on-Cash** can render "0.00" instead of staying blank in some edge cases (e.g., NOI entered, Price blank) — decide whether to preserve or fix this in the prototype.
