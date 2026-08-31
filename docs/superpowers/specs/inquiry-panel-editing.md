# Inquiry panel: editing, CA upload, and the lead journey bar

In-flight. Delete with the branch when it ships.

## What this adds

The inquiry offcanvas (shipped in the previous commit as a read-only panel)
becomes the place a broker *works* an inquiry:

1. **Editable inquiry fields** — Inquiry Status, Referral Source, Sale Doc
   Access Level. Autosave on change. The set is pinned to the real product's
   Lead edit form (Joel's screenshot); Account Status is *not* in it, and stays
   read-only because the lead verifies their own email on the website.
2. **A Confidentiality Agreement section** — a non-functioning "upload" that
   attaches a fake signed CA, plus a Signed CA checkbox.
3. **A lead journey bar** — where this lead stands across six stages driven by
   what they did outside the app.

## The data problem, and why SEED_VERSION does not move

Every inquiry-only column (`accessLevel`, `referralSource`, `status`, `verified`,
the 1031 pair) is synthesized in `toInquiry` from a hash of the contact id.
Nothing is stored, so nothing can be edited.

The fix is to store **only the broker's overrides** and keep the synthesized
values as defaults:

```ts
const inquiry = { ...synthesized(contact), ...storedOverride(contact, listingId) }
```

That is why `SEED_VERSION` stays where it is. The seed writes no new fields, a
snapshot saved before this change still loads (the new keys are simply absent),
and demo data looks identical on first run. Only a field a broker actually
touched is persisted.

### Where the override lives

`Contact.inquiryDetails` is already `Record<listingId, {...}>` — exactly the
(contact, deal) pair an inquiry *is*. The new keys go there:

```ts
inquiryDetails?: Record<string, {
  message?: string          // existing
  channel?: string          // existing
  date?: string             // existing
  accessLevel?: AccessLevel // NEW, all optional, all broker-set
  referralSource?: string
  status?: string
  caSigned?: boolean
  caFileName?: string
  caSignedAt?: string
}>
```

Storing flat on `Contact` was rejected: a contact who inquired on three deals
would get one shared access level, so granting High on one deal would silently
grant it on the others.

### Which listing id keys the row

An inquiry belongs to a listing, and a row can be shown from two places:

- **Space page** — `spaceDealId`. `leadsForSpaceDeal` already filtered to
  contacts whose `inquiredListingIds` names it, so it is always right.
- **Building page** — resolve the contact's own inquired listing: the first
  `inquiredListingIds` entry that is a child space deal of this property (the
  same walk `spaceLabels` already does), else the building's own deal id.

Resolving rather than keying on "whichever page you are looking at" is the point:
otherwise editing Suite 300's inquiry from the building page and from the suite
page would write two different records for one inquiry.

`PropertyDetailLeads` therefore needs the building's `dealId` passed in — it
currently receives only `property` and `spaceDealId`.

## The journey bar

Six stages, in funnel order:

| # | Stage             | Source                                    |
|---|-------------------|-------------------------------------------|
| 0 | Public Documents  | always reached — they inquired             |
| 1 | Created Profile   | synthesized off the contact id             |
| 2 | Verified Email    | the existing Account Status (read-only)    |
| 3 | Low Documents     | Sale Doc Access Level ≥ Low                |
| 4 | Medium Documents  | Sale Doc Access Level ≥ Medium             |
| 5 | High Documents    | Sale Doc Access Level = High               |

Only stages 0 and 1 are new facts. 2–5 are pictures of fields the panel already
shows, which is what makes the bar respond to the edits made beside it: granting
High advances it three stops.

**It is a funnel, so the reached stage is computed by walking the gates in order
and stopping at the first unmet one** — not by counting satisfied stages
independently. An unverified lead caps at Created Profile no matter what access
level they hold. Two reasons:

- A progress bar with a gap in it (High Documents complete, Verified Email not)
  reads as a rendering bug.
- Counting independently would let the bar say Verified Email while the Account
  Status row two inches below says Not Verified.

The cost is a lead holding High access while capped at Created Profile. That is
the honest reading — access was granted, the gate was not passed — and the bar
names the unmet gate as "Next", so it explains itself.

### Rendering

Compact, per Joel's pick: a Blueprint `Progress` with "n of 6 complete", the
current and next stage named beneath, and a `Collapsible` holding all six rows.
The panel is ~32rem, where six horizontal labels do not fit.

## Editing

Autosave — each control writes on change. The footer holds Close, Delete
Inquiry and View Contact; there is no Save button and so no half-committed
state.

Editable: Inquiry Status, Referral Source, Sale Doc Access Level, Signed CA,
CA file.

Read-only: name, email, phone, company, role, dates, Space, Account Status,
the 1031 pair, Added By, Link Sent. Stages 0 and 1 are external facts the lead
performs, not broker-set, so they are read-only too.

## Delete Inquiry

A destructive button in the panel footer, beside View Contact, behind a
confirmation dialog. It
deletes the *lead*, not the person: the contact stays in the CRM and View
Contact still reaches them.

The roster has two doors (`getLeadsForProperty`): you are on it if you inquired
on one of the property's listings, **or** if you are linked to the property at
all. Dropping only the inquiry would leave a property-linked contact sitting in
the list after the broker deleted them — a delete that visibly does nothing. So
`deleteInquiry` drops the property link too, but only once no inquiry on that
property remains: someone who inquired on two suites and lost one is still a
lead on the building.

## The CA upload

Non-functioning by design — no file picker, no bytes. The button synthesizes a
plausible file name, stamps today's date and flips `caSigned`. Removing it
clears all three.

The toolbar already ships a **CA Status: Signed / Not Signed** filter with no
column behind it, so this fills an existing gap in the vocabulary rather than
introducing one.

## Deliberately out of scope

- **A CA Status column in the table.** Not asked for. Worth offering once the
  panel makes CA real, since the filter for it already exists.
- **Making the filter dropdowns actually filter.** They are visual-only today
  and stay that way.
- **A Notes field.** In the reference form but deliberately skipped — Joel
  expects notes to belong to the contact in the new version. The Client Report's
  existing Notes column keeps its own throwaway `useState`.
- **An "Inquired" status.** In the reference form; not added, because
  `LEAD_STATUSES` is shared with the Client Report and the five we have are the
  app's settled vocabulary.
- **The row menu's "Remove" item.** Still inert, like its Export / Send Email
  siblings. Only the panel deletes.
- **Editing the 1031 pair.** Also synthesized; no one asked to set it.
