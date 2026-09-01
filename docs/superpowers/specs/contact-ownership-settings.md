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

## Phase 3a — rights on the contact page (built on this branch)

Visibility and rights are separate. Under an open-book firm anyone can open a record and read
its history; acting on it needs a relationship. `src/data/contactViewerAccess.ts` resolves the
viewer's standing from ownership + shares:

| Relationship | Log activity | Edit fields, tasks, deals, lists, tags | Call / email | Share |
|---|---|---|---|---|
| Owner, or assignee of a company-owned record | yes | yes | yes | yes |
| Collaborator · Outreach | yes | yes | yes | no* |
| Collaborator · Contributor | yes | yes | no | no |
| Collaborator · View | no | no | no | no |
| None ("View only") | no | no | no | no |

\* Resharing stays with the accountable person — still open with George (his doc lets anyone
with access share) and DJ (no tier reshares).

What it gates: the hero pencil, tags, Do Not Call, the Deals / Properties / Lists "+" actions,
the Tasks "+" and completion, timeline FAB / action bars / reply, the composer's Call and Email
tabs (Contributor keeps Note / Meeting / Tour), and the share modal (read-only list for
non-sharers). Without `canLog` the composer card is replaced by **Request access**: one
sentence on why, the tier picker (same three tiers the grant uses), a request to the
accountable person. Requests are session-scoped (`useAccessRequests`) and stay pending —
nobody answers in the prototype.

Seed: every other shared record that isn't Ethan's is shared *with* Ethan, stepping through
View → Contributor → Outreach, so each seat exists to demo. `SEED_VERSION` 64 → 67.

### Global entry points enforce the same rights

`src/components/contacts/contactRights.ts` answers the rights question outside React and outside
the record (`checkContactRight` / `guardContactRight` / `editableContactIds`), reading the stores
directly. Guarded: `callFlow.open` (every "call this person" in the app), the global task modal's
save and update, the People page's add-to-list and create-list bulk actions (skipped contacts are
counted in a toast), and the assistant's writing tools — `add_activity`, `log_call`,
`send_email`, `create_task`, `start_call`, `update_contact`, `add_contact_tags`,
`remove_contact_tags`, `link_contact_to_deal` — which return an error the model can relay. On
the hero, a viewer who can't share gets inert avatars (name on hover, nothing opens) and no
Manage sharing button; without edit rights the verify toggles report state only; without
Outreach the phone and email values are plain text.

## Phase 3 — visibility (built on this branch)

Privacy includes existence. `canSeeContact` (`contactViewerAccess.ts`): a private record is
known only to its owner, anyone it's shared with at any tier, and a viewer holding View Private
Contacts. Everything that enumerates the book goes through `visibleContacts` /
`describeVisibility` / `isContactVisible` in `contactRights.ts`: the People table (rows, counts,
facets), the omnisearch bar and `searchAll`, the contact pickers (`getContactOptions`,
`findContactForRecipient`, the deal form's buyer section), the assistant (name resolution,
`listContacts`, the call-list pool, tag vocabulary, the context summary, and id-based targets),
and the contact URL itself, which reads as not-found rather than "private" so it doesn't confirm a
record exists. Data relationships (`getContactsForProperty`, deal parties) stay unfiltered —
those feed phase 4's placeholders, not a viewer's list.

A see-through viewer (Managing Director by default) sees private records in the table with a lock
by the name. Correction to the earlier plan: placeholders belong on deals (phase 4); a list either
shows the record or nothing.

Seed: other brokers' records at `i % 5 === 2` or `i % 8 === 5` are private, so every seat Ethan
is shared into is a private record he can see beside ones he can't. `SEED_VERSION` 67 → 68.
Demo: the default MD seat sees everything (locked rows); switch "Viewing as" to Broker and the
count drops, the search stops finding them, and their URLs 404.

## Phase 4 — placeholders on deals (built on this branch)

Deals are never invisible; what privacy protects is the relationship attached to them. Where a
deal shows one of its people and the viewer may not know who that is, the person renders as a
**"Private Contact #CODE"** — a lock for a face, a six-hex code (a hash, not the id) so two on one
deal can be told apart, who holds the record, and a Request access knock (a Contributor request
keyed by the real id, so a grant opens the same record). No link, no name, no company, no email.

`viewContact` / `maskContactForText` in `contactRights.ts` produce the masked view; applied on the
deal rail's party sections, the deal card's attached person, the Leads table (`toInquiry` masks
at the source, so filters and counts still include the lead), the client report's leads, and the
assistant's deal-party summaries, record dump, and day-plan contact pick. `getContactsForProperty`
and deal parties stay unfiltered on purpose — that's what makes the placeholder possible.

Seed: the first deal whose seller belongs to another broker gets a private seller.
`SEED_VERSION` 68 → 69. Demo: Broker seat → open that deal; MD seat → same row shows the name.

## Phase 5 — one Person, many Relationships (built on this branch, middle depth)

A Contact is one broker's relationship with a human; two brokers can each hold one, and under a
private book that is the intended outcome. `Contact.personId?` says two records are the same
person. No Person table, no merge, no unlink, no cross-record timeline — those are where the
effort and the arguments live, and none is needed to make George's point.

`src/data/contactRelationships.ts` resolves siblings at read time **over the visible book only**
(the load-bearing rule: a private, unshared twin never announces itself): `linked` share a
`personId`; `suspected` match on normalized email or phone and aren't linked. Surfaces:
- **Hero** (`ContactSiblings`): "Also known to Sarah Chen as a separate relationship · View" for
  linked; "May be the same person as *Name* in Sarah Chen's book" + **Link** for suspected. Link
  (`linkContactsAsPerson`) is offered only when the viewer may edit both records; otherwise it
  says to ask the holder.
- **Create Contact**: a duplicate hint against the visible book by email/phone, pointing at the
  existing record; a hidden match stays silent and the new record is created.
- **People table**: a "2 relationships" chip on linked records (over the visible book). The
  planned "more than one relationship" filter was skipped — the filter model is serialized and
  tested in five places, and the chip carries the point.

Seed (`PERSON_PAIR_IDS`): Jim Halvorsen twice — Sarah's private, unshared fifteen-year record and
Ethan's three-day-old one (Broker seat: nothing; MD see-through: hint, "ask Sarah to link") — and
Dana Whitfield twice, Sarah's shared with Ethan at Contributor beside Ethan's own (hint + Link in
every seat). 80 → 84 contacts. `SEED_VERSION` 69 → 70.

## Phase 7 — Assign and Transfer (built on this branch; teams/offices held)

Assign is the runtime verb that produces the accountable person when the company owns a record;
under broker ownership it dissolves into **transfer** (the record changes books) or a share. One
picker, two faces (`AssignContactModal`), decided by the same resolver as everything else.

- **Rights** (`resolveViewerRights(ownership, shares, viewerCanAssign)`): `canAssign` — company-
  owned and (holds **Assign Contacts** or is the current assignee); `canTransfer` — owner only.
  Assign Contacts is the fourth contact permission (record-scoped, MD default on, no ceiling).
  Registry 23 → 24; MD 9 → 10; Broker+MD 19 → 20.
- **Writes** (`assignContact`, `transferContact` in actions; `contactAssignment.ts` wraps them and
  lands an `assignment` timeline row: "Assigned to …", "Reassigned to …", "Unassigned",
  "Ownership transferred to …"). Transfer's "Keep me as a Contributor" is a share made in the same
  motion. Private stays set on transfer; the new owner inherits it.
- **Surfaces**: hero — the assignee avatar reassigns when the viewer may; an unassigned company
  record shows "Unassigned" or an **Assign** button; owners get a **Transfer ownership** icon
  button. People page — "Assign to…" in the selection bar (skips broker-owned or not-yours,
  counted in the toast); the Assigned To column reads "Unassigned" for an empty assignee.
  Assistant — `assign_contact` (all four registries), refusing broker-owned records with the
  transfer explanation.
- **Unassigned state**: `assignedTo` may be `""`. Resolves company-owned with no assignee; seeded
  arcs author as "Buildout"; Create row reads "Contact created". No triage pool — open-book.
- **Debt named**: the assignee is still a display name matched to the roster by string.
  Assignment by id is the right shape; `assignedAt` / `assignedBy` sit beside it for now.

## Viewing as a person (built on this branch)

The account menu's "Viewing as" switches *who is looking*. A second **Role** submenu keeps the
old lens on top of it (`viewAsRole.ts`, `dev_role`): it overrides the *current seat's* role on the
roster row — "Ethan as a Broker" — and clears when the seat changes, so Sarah shows up as herself.
Nothing stored means no override. (Zach asked to keep the role swap after the person switch
landed.)

- `src/data/currentUser.ts`: `useCurrentUser` (seat id, persisted as `dev_viewer`), `currentUser()`,
  `viewerId()`, `currentUserActor()`, `VIEWABLE_PEOPLE`, hydrated in `AppShell`, which also moves the
  roster's YOU badge (`useRoster.setViewer`).
- **Viewer vs. protagonist.** `CURRENT_USER` (Ethan) remains the demo's protagonist: the seed, the
  hero arcs, the Rosa story, BOV sign-offs and the dashboard's recent activity are authored as him
  on purpose. Everything that means "whoever is looking" — owner checks, share matching, rights,
  visibility, see-through, assign rights, "(you)" suffixes, the YOU badge, task defaults, deal
  messages, created contacts, the assistant's actor and context — reads the seat.
- **Authorship is stamped at log time.** `ComposedActivity.author` is set by `addLog`; the timeline
  used to sign a logged note as the viewer at *render*, so switching seats would have re-attributed
  everything logged this session.
- Pending access requests clear on a switch (they were the old seat's). Task filter options drop
  the "(you)" suffix rather than mislabel someone.

## Held

6. **Grants to teams / roles / offices / company** — the share modal's picker already says
   "people, groups, spaces".

## Still open with George

- **Resharing.** His doc: any broker can share a relationship they have access to. Our tiers
  and DJ's rule: no tier reshares; only the accountable person grants.
- **Transfer and export** as permissions — named in his doc, not modelled.
- **"Bob's role receives two permissions"** — read here as the grant default + per-person
  override, not a custom role. Confirm that satisfies him.
