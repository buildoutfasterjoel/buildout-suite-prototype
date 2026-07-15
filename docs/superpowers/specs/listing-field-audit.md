# Listing Field Audit: 380 Del Medio Ave (Property #414699, staging)

Source: `staging.buildout.com/properties/414699/edit`, full form including all "Show Additional Fields" and "Additional Fields" expansions.

## How I sorted these

**Property** = true about the physical asset regardless of who's marketing it, or whether it's being marketed at all. Belongs in Insights. Feeds every listing/deal that ever touches this address.

**Listing** = specific to this marketing/transaction engagement. Would reset, differ, or simply not exist if you closed this listing and spun up a fresh one on the same property.

That's the test I applied to every field below.

---

## Property record fields (keep these OUT of the new listing form)

**Location**
Address, Zip, City, State, Lat/Long override, County, Market, Submarket, Cross Streets, Location Description, Township, Range, Section, Side of Street, Street Parking, Signal Intersection, Road Type, Market Type, Nearest Highway, Nearest Airport

**Property identity**
Primary Property Type, Additional Property Type(s), Property Name, Alias, Zoning, Lot Size, APN#, Lot Frontage, Lot Depth, Corner Property, Traffic Count (+ Street, + Frontage), Site Description, Amenities, Waterfront, MLS ID#, Power (+ Description), Gas/Propane (+ Description)

**Building**
Building Size, Tenancy, Ceiling Height, Min Ceiling Height, # Floors, Avg Floor Size, Year Built, Year Renovated, Gross Leasable Area, Load Factor, Construction Status, Parking Ratio, # Parking Spaces (building-level), Parking Type, Laundry/Plumbing/Exterior/Interior Description, Framing, Condition, Security Guard, Handicap Access, Freight Elevator, # Elevators, # Escalators, Central HVAC, Broadband, Roof, Free Standing, LEED Certified, # Buildings, Construction Description, Walls, Ceilings, Floor Coverings, Restrooms, Landscaping, Corridors, HVAC, Foundation, Exterior Walls, Mezzanine, Office Buildout, Parking Description, Utilities Description, Loading Description

**Units (physical shell only)**
Number of Units, per-unit Beds/Baths/Size (SF)

**County/tax record**
Tax Value Land, Tax Value Improvements, Tax Value Personal Property, Assessed Value, Land Ownership, Land Legal Description

Broker read: these live on the county record, not the deal. They're currently buried inside "Sale Information" but nobody edits assessed value per listing cycle. Moving them to Property is a clean win with near-zero broker workflow disruption.

---

## Listing-specific fields (prioritize these for the new form)

**Listing setup and status**
- Lease checkbox, Sale checkbox (side selector, both can be on at once)
- Status ladder: Proposal, Active, Under Contract, Closed, Inactive (tracked separately per side, and again per space for lease)
- Marketing channel: None / Buildout Buyer Network / My Brokerage Website / Buildout Syndication Network, mapped to a visibility tier from Fully Private to Fully Public
- Listed On date, Listing Expiration date (separate fields for Lease vs Sale)
- Primary Broker, additional brokers

Broker read: broker assignment is deal-level in practice since a broker can be swapped between engagements on the same property over time. It belongs on the listing even though today it sits in a global "Brokers" tab.

**Sale-side marketing and terms**
- Sale Title, Sale Description, Sale Bullets, Sale Closing Info
- Property Use: Net Leased Investment, Investment, Owner/User, Business for Sale, Development
- Investment Type: Core, Core Plus, Value Add, Opportunistic, Distressed
- Includes Real Estate, Commission %, Auction
- Sale Terms, Reimbursement, Capital Costs, Loan Due, Loan Description, 1031 Exchange

**Sale-side financials** (none of this is a fixed property fact, it's the broker's pitch)
- Sale Price, Sale Price Units, Hide Price toggle, Display Financial Fields on Plugin
- Income breakdown (line items + total), Gross Scheduled Income, Other Income, Total Scheduled Income, Vacancy %, Vacancy Cost, Gross Income
- Expense breakdown (line items + total), Operating Expenses
- NOI, Cap Rate
- Loan Amount, Down Payment, Debt Service, Cash Flow, Principal Reduction, Total Return, Debt Coverage Ratio, GRM, Cash-on-Cash
- Multiple named, reorderable scenarios (e.g. Worst Case / Best Case)

**Lease-side marketing and terms (deal-level, above the spaces)**
Lease Title, Lease Description, Lease Closing Info, Lease Bullets, Commission Split %

**Lease-side, per space** (the real transactional unit for leasing)
- Its own status ladder: Active, Under Contract, Closed, Inactive, independent of the parent listing
- Space Type (overridable), Label Override
- Tenant Name, Space Name, Suite, Floor, Zip+4
- Lease Rate, Lease Rate Units, Lease Rate Unit Override, Hide Lease Rate, Flat/Range
- Space Size, Lease Type: Gross, Modified Gross, NNN, Modified Net, Full Service, Ground Lease
- Lease Term (months), Sublease, Date Available, Min Divisible, Max Contiguous, Ceiling Height override, Description
- Warehouse Allotment %, # Parking Spaces (space-level, separate field from the building-level one), # Conference Rooms, # Offices, Furnished
- Heating, Cooling, Lighting (+ descriptions), HVAC Tonnage
- TI Allowance, Free Rent, Signage Available, Rent Escalators (+ type + description), Rent Concession, Moving Allowance, Lease Buyout Allowance
- Net Lease Investment, Tax/SF, Tax Stops, Expenses, Expense Stops, CAM Charge/SF, CAM Expense Stops, Insurance/SF, % Procurement Fee
- Tenants Pay Gas / Electric / Water, Sublease Allowed, Lease Terms (free text)
- Sale Price (present on the lease space too, see flag below)

---

## Ambiguous fields, need a call

- **Occupancy %**: physical fact about the building today, but also a headline number in every sale pitch. Recommend storing it once on Property, letting the listing pull a snapshot at Active so the pitch number can move independently without corrupting the source of truth.
- **Rent Roll** (actual Rent, Mkt Rent, Rent/SF, Security Deposit, Lease Start/End per unit): this is live tenancy data, true whether or not you're marketing the property, but today it only exists inside the listing form. Worth deciding whether this becomes a property-level "current rent roll" that listings read from rather than own.
- **Internal Notes / Admin Notes**: generic enough to attach to either. Today there's one field per listing, so it defaults to listing-specific by omission rather than by decision.

---

## Two things worth flagging back to the deal-centric initiative

1. **Sale Price shows up twice**: once under Financials (correct, sale-side), and again buried in a lease space's "Additional Fields." That's a live example of the exact problem Nick flagged on the finance call, that listing sale price and deal sale price are different fields on different tables. Not hypothetical, it's in the current form.
2. **Each lease space already carries its own independent status ladder** (Active/Under Contract/Closed/Inactive), separate from the parent listing's ladder. That's the one-listing-to-many-deals model Mike Marion and Nick described on the July 13 dev call, already shipped for lease properties. Worth using this actual UI as the reference point for the "one listing to one deal vs one listing to many deals" open question in the deal-flow doc, since a version of it already exists in production.
