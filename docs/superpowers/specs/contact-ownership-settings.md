# Contact ownership, privacy & sharing — the settings layer

**Status: in flight.** Working document for the branch `zach/contact-ownership-settings`.
Delete with the branch when it ships (`chore(docs):`), after anything worth keeping is in the
PR body.

Sources: George's "Contact Ownership and Privacy: The Model" (Sep 1, supersedes his four
scenarios and table), the consolidated rules doc (Cowork artifact "Contact Ownership &
Sharing" v2), the "Contact Settings Sandbox" artifact, DJ/Nikos's contact rules (Slack,
Aug 31), and the existing roles & permissions build (`src/data/permissions.ts`).

## The model in one paragraph

The **account setting is the ceiling, the user permission is the grant.** Two company-level
switches say what the company allows; ordinary record-scoped permissions say whether a given
person gets it. Under George's model a contact record is a *Relationship* (one broker's
connection to a *Person*); ownership says whose it is, visibility says who can know it exists,
grants open it up. Company-owned shops are **open-book**: assignment is responsibility, not
access. Privacy is an **action** an owner takes on a record, not a starting state. Sharing
behaves identically everywhere.

## The settings

| # | Where | Setting | Kind |
|---|-------|---------|------|
| 1 | Company → Settings, "Contact Ownership" | **Brokers can own contacts** + who gets it by default | ceiling + grant default |
| 2 | same card | **Broker-owned contacts can be private** + who gets it by default — locked while #1 is off | ceiling + grant default |
| 3 | Users → *person* → Permissions | **Own Contacts** | record-scoped, Broker + Managing Director default ON |
| 4 | same page | **Mark Contacts Private** | record-scoped, Broker + Managing Director default ON |
| 5 | same page | **View Private Contacts** | record-scoped, Managing Director default ON |

**Grant default** (decided 2026-09-01): each open switch carries "Every Broker, by default"
or "Only people you grant it to". With the latter, the two grant permissions read Off for a
Broker with a "Granted per person" chip, and an admin's per-person switch is the grant. This is
how Summit (open database, Bob keeps his book) and Meridian (every broker owns) run on the same
fixed roles — no role manager needed. View Private Contacts keeps its role default either way;
oversight isn't handed out per person.

A permission whose ceiling is closed renders **off and locked** with an "Off for the company"
chip. Role defaults and overrides are untouched underneath, so re-opening restores them.

### How the switches resolve

| Ceiling: own | Ceiling: private | Person: own | Person: private | Result |
|---|---|---|---|---|
| off | — | — | — | **Row 1 · Model A.** Company owns every contact; everyone can find it; MDs assign to work. |
| on | — | off | — | **Row 4 · Model A for this person.** Their contacts are company-owned and firm-visible. |
| on | off | on | — | **Row 2 · Own but transparent.** Attribution and control, not secrecy. |
| on | on | on | on | **Row 3 · Model B.** Owner can mark a contact private; hidden, search included, until shared. |
| on | on | on | off | **Row 2 for this person** (decided). They own but can't mark private. |

`src/data/contactAccess.ts` encodes this; `contactAccess.test.ts` pins it.

## Built on this branch

- `permissions.ts` — `own-contacts`, `private-contacts`, `view-private-contacts`, each with a
  `gate`. Registry 20 → 23; Broker 11 → 13; MD 6 → 9; Broker+MD 16 → 19. Tests re-derived.
  **MDs get Own Contacts by default** (decided 2026-09-01, Zach) — unlike Own Listings. Nothing
  in George's or DJ/Nikos's docs withholds ownership from the role, and a producing MD is normal;
  the earlier Broker-only default was borrowed from the listings model. Confirm with George.
- `contactAccess.ts` — settings type, `gateFor`, `applyCompanyCeilings`, `isEffectivelyOn`,
  `resolveContactAccess`, `resolveCompanyDefault`.
- `useContactAccessSettings` — zustand store, persisted in localStorage
  (`contact_access_settings`) and hydrated in `AppShell`, same pattern as `dev_role`.
- `CompanyInfoForm` — the card, with a radio pair per open switch and a live readout.
- `UserPermissions` — rows resolved through `applyCompanyCeilings`; lock and per-person chips.
- `useCan` — ceiling- and default-aware.

## Decided 2026-09-01 (Zach, after George's doc)

- **Private is an action.** Records start visible; an owner with Mark Contacts Private locks a
  record, and a private record's *existence* is hidden — search, duplicate warnings, AI,
  reporting. The one exception is the "Private Contact" placeholder on a shared deal.
- **Model A is open-book.** Unassigned company contacts are searchable by everyone. No
  unassigned-pool triage surface; assignment is a responsibility marker on the record.
- **Grant default lives on the ceiling card** (option ii from the earlier draft).
- **Artifact privacy is always on and authorship-governed.** Any user can mark any artifact they
  authored private — notes, calls, meetings, tours, emails they logged — *except* system events
  (Contact Created, automated stage changes, change-log rows). **View Private Contacts does not
  pierce a private artifact.** Leadership sees the relationship, never Dan's note.
- **Person/Relationship split at the middle depth**: a `personId` so two contact records can
  point at one person, a "may be the same person" hint when both are visible to a viewer, and a
  link action. No merge flow in the prototype.

## Phase 1 — contact hero (built on this branch)

- `src/data/contactOwnership.ts` resolves owner / assignee / private from the record, the roster
  and the company settings. **Ownership is derived at read time**, not stamped at creation, so
  flipping a company switch changes the hero live. A real migration stamps `ownerId`; the
  prototype trades that for the demo. Every contact has one accountable person — the assignee —
  who owns the record when the ceiling and their grant allow, and works it for the company
  otherwise.
- `Contact.assignedTo` now carries **roster full names** (was `E. Thompson` etc., people who
  existed nowhere else), and Riley Park (Office Admin, sharing-only) joins the pool at ~5% so the
  seed has standing company-owned examples. `Contact.isPrivate?` added. `SEED_VERSION` 61 → 63.
- Hero (Figma 3262:115240): row one is stage badge · **Visible / Private badge** (shown only when
  the record *could* be private — owner holds the grant under an open ceiling; company-owned
  records carry none) · access cluster (owner with the ring, a building when the company owns it;
  assignee avatar when company-owned; shared-in group; Manage sharing). Row two is a full-width
  28px **Show / Hide Contact Details** button — moved off the badge row because that row kept
  growing. Inside details, a **Private Contact** switch sits above Do Not Call for the signed-in
  owner when they hold the grant. `setContactPrivate` persists the flag. Copy decisions (Zach,
  2026-09-01): "Visible" not the Figma's "Public" (public = published outward in this product);
  "Private Contact" not "Make Private" (a switch shows a state). An earlier lock icon in the
  access cluster was replaced by this.
- Share modal: a one-line "what sharing means here" note, owner row (company or person),
  assignee row when company-owned, and the picker excludes them.
- Demo note: Ethan's default Managing Director seat owns his contacts and shows the lock on
  arrival. To see company ownership, filter People by Assigned To → Riley Park (Office Admin, a
  sharing-only role — the company owns those and Riley works them), turn the company switch off,
  or set the grant default to "only people you grant it to".

## Phase 2 — private timeline artifacts (built on this branch)

- **Rule, in code:** `canBePrivate(event)` in `timeline.ts` — note, call, email, meeting, tour;
  user-sourced; outbound; authored by the viewer. System rows (created, stage-change, change-log,
  assignment, marketing, task) and inbound rows are never privatable. `hiddenFromViewer(event)`
  drops a colleague's private artifact from the feed; the viewer's own stays. Authorship governs —
  View Private Contacts never reaches a private note.
- **Composer:** a "Private" ghost toggle (lock-open → lock, purple when on) in every tab's footer,
  per-tab state, reset on log. Carried as `ComposedActivity.isPrivate` →
  `TimelineEvent.visibility: "private"`.
- **Row:** a "Private" chip with a lock in the meta line beside the pin, with a tooltip saying who
  can't see it. Overflow menu gains Make private / Make visible on rows the viewer authored,
  stored as a per-row session override like the pin.
- The ~9 seeded private notes (Rosa, Earl, Margaret arcs) now render the chip; all are authored
  by Ethan so none hide.

### Seeded authorship follows the working set

The parameterized arcs used to stamp Ethan as the author of every outbound beat, so a contact
assigned to Sarah Chen with no collaborators read as Ethan's work. `makeCtx` now takes the
contact's shares and builds a `WorkingSet`: the assignee is `ctx.me` (authors most beats, signs
the emails, receives inbound rows); Contributor/Outreach collaborators author every third eligible
beat (notes, meetings, tours; calls only at Outreach; never emails — their bodies sign off in the
primary's name); View shares never write. The seed also stops sharing a record with its own
assignee. `buildContactTimeline(contact, deals, shares)`; the panel passes the store's shares.
Hero arcs still write as Ethan — they're hand-authored and seeded onto his contacts.
`SEED_VERSION` 63 → 64.

## Next phases (not on this branch)

3. **Index visibility** — hide private records the viewer has no grant on; MD with View Private
   Contacts sees placeholders, not names, in lists and reports.
4. **Placeholders on deals** — "Private Contact" on a deal's party list; request-access knock.
5. **Person/Relationship** (moves `SEED_VERSION`) — `personId`, same-person hint, link action.
6. **Grants to teams / roles / offices / company** — the share modal's picker already says
   "people, groups, spaces".
7. **Assign / re-assign as an action** — today `assignedTo` is seed data; an MD-gated Assign
   action distinct from Share is the missing verb under company ownership.

## Still open with George

- **Resharing.** His doc: any broker can share a relationship they have access to. Our tiers
  and DJ's rule: no tier reshares; only the accountable person grants.
- **Transfer and export** as permissions — named in his doc, not modelled.
- **"Bob's role receives two permissions"** — read here as the grant default + per-person
  override, not a custom role. Confirm that satisfies him.
