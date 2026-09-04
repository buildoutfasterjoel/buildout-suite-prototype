/**
 * The prototype's own changelog — one entry per merged pull request.
 *
 * This is static content, not seeded world data, so it lives beside the page
 * that renders it rather than in `src/data/`. Nothing here touches
 * `SEED_VERSION`, and resetting the demo does not clear it.
 *
 * ## The shape is built for an appender to write
 *
 * Every field on `ChangelogEntry` is something `gh pr view` already returns or
 * a commit prefix already states, so the eventual automation is a mapping job
 * rather than a summarising one:
 *
 * | Field        | Where it comes from                                    |
 * |--------------|--------------------------------------------------------|
 * | `pr`         | `.number` — also the dedupe key, so a re-run is a no-op |
 * | `title`      | `.title`                                               |
 * | `mergedAt`   | `.mergedAt`                                            |
 * | `day`        | `.mergedAt` resolved to a calendar day, once, on append |
 * | `author`     | `.author.login`                                        |
 * | `highlights` | one per commit, kind read off the conventional prefix   |
 * | `summary`    | the only field that needs writing                      |
 *
 * `KIND_BY_COMMIT_PREFIX` below is that last mapping, kept here so the page and
 * the appender cannot drift apart on what counts as a fix.
 *
 * ## Keep this module dependency-free
 *
 * It imports nothing. `scripts/changelogSlack.ts` and both GitHub workflows read
 * it directly, and FontAwesome Pro and Blueprint live behind private registries
 * — so a single import here would mean handing CI those registry tokens just to
 * ask whether a PR has a changelog entry. Presentation lives in
 * `changeKindMeta.ts` for exactly that reason.
 */

export type ChangeKind = "feature" | "refinement" | "fix";

/**
 * Conventional-commit prefix → the kind it reads as, for the appender.
 *
 * A prefix absent from this map is deliberately dropped rather than defaulted:
 * `docs`, `chore`, `test` and `seed` commits are housekeeping, and a changelog
 * that lists "delete the voucher-parties spec" trains people to stop reading it.
 */
export const KIND_BY_COMMIT_PREFIX: Record<string, ChangeKind> = {
  feat: "feature",
  refine: "refinement",
  refactor: "refinement",
  fix: "fix",
  perf: "refinement",
};

export type ChangeHighlight = {
  kind: ChangeKind;
  /** One sentence, in the voice of the person using the app. */
  text: string;
};

export type ChangelogEntry = {
  /** GitHub PR number. The entry's identity — an append keys off this. */
  pr: number;
  title: string;
  /**
   * Full ISO timestamp from GitHub. The sort key.
   *
   * Necessarily an estimate on the entry a PR writes for itself: the entry has
   * to exist before the check will pass, and the merge has not happened yet.
   * Only the ordering depends on it, and a PR merges after the one below it in
   * this array either way, so an approximate time is harmless. Nothing renders
   * it — the page shows `day`.
   */
  mergedAt: string;
  /**
   * `YYYY-MM-DD`, the calendar day this entry is filed under.
   *
   * Stored rather than derived from `mergedAt` because deriving it means
   * calling `getDate()` on a zoned timestamp, and the server and the browser
   * do not always agree on which day that is — which would group entries
   * differently on each side of hydration.
   */
  day: string;
  /** GitHub login. `AUTHOR_NAMES` turns it into something to show. */
  author: string;
  /** What the PR was for. Not what it touched. */
  summary: string;
  highlights: ChangeHighlight[];
  /** The surface it landed on, for the tag beside the title. */
  area?: string;
};

export const REPO_URL =
  "https://github.com/buildoutfasterjoel/buildout-suite-prototype";

export function prUrl(pr: number): string {
  return `${REPO_URL}/pull/${pr}`;
}

/**
 * Commit logins are not names. Anyone unmapped falls back to their login, so an
 * entry from a new contributor reads as their handle rather than breaking.
 */
const AUTHOR_NAMES: Record<string, string> = {
  "ZS-buildout": "Zach Spanton",
  buildoutfasterjoel: "Joel Lopez",
};

export function authorName(login: string): string {
  return AUTHOR_NAMES[login] ?? login;
}

/** Badge order, and the order the filter offers them in. */
export const KIND_ORDER: ChangeKind[] = ["feature", "refinement", "fix"];

/**
 * Newest first. An appended entry goes at the top, so the file reads in the
 * same order the page does.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    pr: 212,
    title:
      "The access card on a read-only contact explains your standing without offering to request access",
    mergedAt: "2026-09-04T02:22:37Z",
    day: "2026-09-03",
    author: "ZS-buildout",
    area: "Contacts",
    summary:
      "Requesting access to a contact is out for now, so the card that stands in for the composer on a record you can read but not act on explains your standing and nothing more.",
    highlights: [
      {
        kind: "refinement",
        text: "The card's header now names your standing alone: \"Previewing Private Contact\" for a Managing Director on a private record, \"Read-Only Access\" on another broker's contact or a company record you aren't assigned to, and \"You Have View Access\" when you were shared in to read. The tier options and the Request access button are gone; the one-paragraph explanation stays.",
      },
      {
        kind: "refinement",
        text: "On a deal, the \"Private Contact\" placeholder row no longer offers a Request access button. It shows who holds the record, and its tooltip says the same instead of telling you to ask from the deal.",
      },
      {
        kind: "refinement",
        text: "The messages that refuse an action on a contact you can't work, and the toast that counts skipped contacts on a bulk list action, no longer point you at requesting access from the record.",
      },
    ],
  },
  {
    pr: 211,
    title:
      "The app shell's rail expands into a labelled column, the top bar spans the window, and the omnibar picks up its new colors and radius",
    mergedAt: "2026-09-04T00:38:19Z",
    day: "2026-09-03",
    author: "ZS-buildout",
    area: "Navigation",
    summary:
      "The left rail could only ever be a strip of icons, so every section had to be recognised by its glyph alone. It now opens into a full labelled column when you want the names, closes back to the strip when you want the room, and the top bar and omnibar follow the updated designs.",
    highlights: [
      {
        kind: "feature",
        text: "The hamburger beside the logo expands the left rail into a 220px column that names every section and lists each group\u2019s pages beneath it, and collapses it back to the icon strip. Your choice sticks across reloads.",
      },
      {
        kind: "feature",
        text: "A Dashboard row sits at the top of the rail and takes you home, the same place the logo does.",
      },
      {
        kind: "refinement",
        text: "The current section shows a solid purple icon with a slim marker on the rail\u2019s edge. In the expanded rail the marker moves to the exact page you\u2019re on, and hovering any row tints it blue.",
      },
      {
        kind: "refinement",
        text: "Hovering a group in the collapsed rail opens a navy flyout of its pages, matching the rail rather than a white menu, with the page you\u2019re on set in semibold.",
      },
      {
        kind: "refinement",
        text: "The top bar now runs the full width of the window with the rail tucked beneath it, and the search bar and Assistant button stay centred over the page \u2014 sliding across as the rail opens and closes.",
      },
      {
        kind: "refinement",
        text: "The Search or ask Otto bar is shorter and squarer with a translucent navy fill, lighting up solid with a purple glow on hover. The \u2318K reminder now sits quietly after the placeholder text instead of in a pill by the microphone.",
      },
    ],
  },
  {
    pr: 210,
    title: "Log Activity fields take AI instructions inline, right under the field, instead of through the Otto rail",
    mergedAt: "2026-09-03T22:50:11Z",
    day: "2026-09-03",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "Asking Otto to write a note meant opening the rail, typing there, and watching the answer land somewhere else on the page \u2014 and every field edit piled into the rail\u2019s conversation. The ask now happens right under the field it changes, and the rail never hears about it.",
    highlights: [
      {
        kind: "feature",
        text: "The sparkle sits in the bottom-right of each Log Activity field and opens an instruction bar beneath it, already focused, so you can just start typing what should be written.",
      },
      {
        kind: "feature",
        text: "Press Enter or the arrow and the text streams into the field itself. While it writes, the field shimmers, the bar reads Generating\u2026, and a Stop button cancels \u2014 keeping whatever has already landed.",
      },
      {
        kind: "feature",
        text: "Once the text is in, the bar comes back as Describe your change, and a menu at its end offers three one-click revisions \u2014 More Formal, Friendlier, Shorten. It works on a note you typed yourself, too.",
      },
      {
        kind: "refinement",
        text: "Each tab of the Log Activity block keeps its own bar, a note can keep generating while you glance at the Call tab, and logging the activity puts its bar away.",
      },
      {
        kind: "refinement",
        text: "The rail\u2019s pinned-field chip, its quick-revision buttons and the tinted field are gone, along with Otto\u2019s stage-a-field tool. Field writing no longer shows up in the conversation at all.",
      },
    ],
  },
  {
    pr: 209,
    title:
      "A receivable can only be billed to a listed payer, and the commission breakdown names each internal broker",
    mergedAt: "2026-09-03T22:10:18Z",
    day: "2026-09-03",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Two things on the voucher were answering a question with the wrong list. A new receivable could be billed to someone the Billing section did not name, and the commission breakdown drew every one of the house\u2019s brokers as a single anonymous slice \u2014 so a broker could not see their own share on the voucher they were signing.",
    highlights: [
      {
        kind: "refinement",
        text: "A new receivable is billed to the voucher\u2019s payers and nobody else. The deal\u2019s buyer used to be offered as a shortcut, which quietly added them to Billing as a side effect of creating the line.",
      },
      {
        kind: "refinement",
        text: "Add Receivable is disabled until Billing names a payer, since there is nothing to bill to until then.",
      },
      {
        kind: "feature",
        text: "The Gross Commission Breakdown gives each internal broker their own slice and their own legend row, named, in the order the Internal Commissions table lists them. Outside brokers stay one row, grouped with the deductions as the money that leaves before the house splits anything.",
      },
      {
        kind: "refinement",
        text: "A fourth broker folds into one \u201cOther Brokers\u201d row rather than repeating a colour already used, so no two slices can be mistaken for each other.",
      },
    ],
  },
  {
    pr: 208,
    title:
      "A voucher cannot be submitted with commission nobody has been assigned, and a broker\u2019s Gross $ now follows the deal",
    mergedAt: "2026-09-03T21:33:40Z",
    day: "2026-09-03",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "A voucher could be sent to an approver with commission that had been given to nobody, and the breakdown that was supposed to show it counted the co-broke as leftover money. Submitting now waits until every dollar is accounted for \u2014 and because that only works if the figures can be corrected, a broker\u2019s Gross $ now follows their split and the deal\u2019s commission.",
    highlights: [
      {
        kind: "feature",
        text: "Submitting is held until the gross commission is fully allocated, and the button says which way it is out \u2014 the shortfall to allocate, or the amount paid out beyond what the deal earned.",
      },
      {
        kind: "fix",
        text: "The Gross Commission Breakdown counts the co-broke. An outside broker\u2019s share was reported as unallocated money on 9 of the 31 seeded vouchers, with no Outside Commission slice on the donut to explain the orange.",
      },
      {
        kind: "fix",
        text: "A voucher that pays out more than the deal earned reads \u201cOver-Allocated\u201d instead of a settled-looking $0.00. The figure used to be clamped at zero, which hid it.",
      },
      {
        kind: "fix",
        text: "Entering a commission on a deal carries the brokers\u2019 Gross $ with it. A deal created before its commission was known kept its broker on $0 at a 100% split, so the voucher drew the whole commission as unallocated and could never be sent.",
      },
      {
        kind: "fix",
        text: "Gross % and Gross $ are two views of one figure and each now writes the other, against the net as it stands on screen \u2014 so an unsaved deduction moves the math with it.",
      },
      {
        kind: "fix",
        text: "A number on the voucher can be cleared to retype it. Clearing one used to put a 0 back in the box, so the next keystroke read \u201c05\u201d.",
      },
      {
        kind: "refinement",
        text: "Approve on a pending voucher is now a Review menu, holding Approve and Request Changes. Request Changes is a placeholder \u2014 sending a voucher back to the broker is not built yet.",
      },
    ],
  },
  {
    pr: 207,
    title:
      "Payer pickers on the voucher offer the deal\u2019s own people first, and a receivable can only be billed to one of them",
    mergedAt: "2026-09-03T18:45:00Z",
    day: "2026-09-03",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Adding a payer, or billing a receivable, meant searching the whole contact book for a question with two or three real answers \u2014 the buyer is usually the payer, and a receivable is billed to someone already on the deal. Both pickers now put those people first, and the receivable picker offers nobody else.",
    highlights: [
      {
        kind: "feature",
        text: "Add Payer opens with the deal\u2019s buyers \u2014 tenants on a lease \u2014 in their own group at the top, with the rest of the contact book underneath. Confirming the name you already know, instead of finding it alphabetically among four hundred.",
      },
      {
        kind: "feature",
        text: "A new receivable can only be billed to the voucher\u2019s payers or the deal\u2019s buyer, grouped under headings that say which is which. Everyone else has no part in the transaction.",
      },
      {
        kind: "refinement",
        text: "Billing the buyer on a receivable adds them to the Billing section, so the first receivable on a new voucher no longer needs a trip through Add Payer first.",
      },
      {
        kind: "refinement",
        text: "A buyer you have added but not yet Saved is already available to bill, and a voucher with neither a buyer nor a payer says so \u2014 \u201cAdd a buyer or a payer to this voucher first\u201d \u2014 rather than dropping an empty menu.",
      },
    ],
  },
  {
    pr: 206,
    title: "The Delgado Building\u2019s marketing stats follow the deal\u2019s stage, reading as pre-market until it goes Active",
    mergedAt: "2026-09-03T15:35:47Z",
    day: "2026-09-03",
    author: "ZS-buildout",
    area: "Deals",
    summary:
      "Pinning the Delgado Building\u2019s numbers got the Active beat of the Rosa story right and the Pitching beat wrong \u2014 a deal that has not gone to market has no website, yet 350 page views showed up the moment the deal was created. The numbers now follow the deal\u2019s stage.",
    highlights: [
      {
        kind: "refinement",
        text: "While the Delgado Building\u2019s deal is still in Pitching, its Client Report shows 0 days on market and its Website page shows no views, visitors or leads, a flat traffic chart and an empty Activity Log.",
      },
      {
        kind: "refinement",
        text: "Once the deal goes Active, and at every stage after, the numbers land where they were set: 10 days on market, 350 page views, 200 unique visitors and 3 leads, with the chart and activity log to match.",
      },
    ],
  },
  {
    pr: 205,
    title: "The Delgado Building\u2019s marketing stats read like a deal that just went to market",
    mergedAt: "2026-09-03T14:55:00Z",
    day: "2026-09-03",
    author: "ZS-buildout",
    area: "Deals",
    summary:
      "The Rosa Delgado story is about a deal that just went live, but the moment a deal existed on her building its client report and website showed a random year on market and a thousand-plus page views. Those numbers are now set to fit the story, and every other listing keeps its own.",
    highlights: [
      {
        kind: "feature",
        text: "The Delgado Building\u2019s Client Report shows 10 days on market, and its Website page shows 350 page views, 200 unique visitors and 3 leads \u2014 a fresh listing with the first buyers showing up, not a year of made-up history.",
      },
      {
        kind: "refinement",
        text: "The Website traffic chart is scaled to agree with the 350 page views, and the change chip beside the tile is figured from the chart it sits next to.",
      },
    ],
  },
  {
    pr: 204,
    title: "A Back Office Manager who can approve vouchers, and vouchers scoped to whose they are",
    mergedAt: "2026-09-02T23:10:00Z",
    day: "2026-09-02",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Approving a voucher used to mean picking an approver from a fixed list of three, because nobody you could sign in as was allowed to sign one off. There is now a Back Office Manager role, a person holding it, and three permissions behind the whole flow \u2014 so you approve a voucher as yourself, and the Vouchers page shows you the ones that are actually yours.",
    highlights: [
      {
        kind: "feature",
        text: "A new Back Office Manager role, held by Tessa Nakamura. Switch to her seat in the account menu to work the approval flow: she sees every voucher in the book, can correct one a broker has already submitted, and signs it off.",
      },
      {
        kind: "feature",
        text: "Three permissions carry it \u2014 View Other Users\u2019 Vouchers, Edit Other Users\u2019 Vouchers and Approve Vouchers \u2014 and they are enforced, not decorative. A Managing Director gets the first and the last: they see the whole book and sign off, but the typing stays with the back office.",
      },
      {
        kind: "feature",
        text: "The Approve Voucher dialog names you instead of asking who is signing, and who may approve now comes from the permission rather than a list in the code. Two people who used to be on that list, the Transaction Coordinator and the Office Admin, are no longer approvers.",
      },
      {
        kind: "refinement",
        text: "Back Office \u2192 Vouchers is scoped to the person looking. A broker sees vouchers for deals they are on, and the commission tiles, the count and the pagination all follow. Without the permission, the empty state says why the page is empty rather than claiming the firm has no vouchers.",
      },
      {
        kind: "refinement",
        text: "A Pending voucher still freezes for the broker who submitted it \u2014 sending it is the decision, and it cannot be taken back \u2014 but it no longer freezes for the back office, whose work starts there.",
      },
    ],
  },
  {
    pr: 203,
    title:
      "A Payables page in Back Office, grouped by the broker who is owed, and a way to pay them off it",
    mergedAt: "2026-09-02T19:14:04Z",
    day: "2026-09-02",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "What the brokerage owes its brokers was only visible one voucher at a time. Back Office now has a Payables page that gathers every payable under the broker it is owed to, so you can see what one person is due across every deal and pay it in one go.",
    highlights: [
      {
        kind: "feature",
        text: "Back Office → Payables lists every payable in the book, grouped by broker, with each broker's total due at the head of their own rows. A payable links back to the voucher that raised it.",
      },
      {
        kind: "feature",
        text: "Tick a broker's heading to take everything they are owed, or single rows to take part of it, then Pay Selected writes a payment against each one for its full balance. The page opens on Outstanding, so it reads as the queue of what still needs paying.",
      },
    ],
  },
  {
    pr: 202,
    title: "Show who created a deal and who can open it, in the deal header",
    mergedAt: "2026-09-02T16:50:04Z",
    day: "2026-09-02",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "A deal header used to show made-up avatars on its photo and a Manage Access item that did nothing. It now shows the real people: whoever opened the deal, everyone else who can work it, and a button that opens the list and lets you add someone.",
    highlights: [
      {
        kind: "feature",
        text: "The deal header carries an access cluster, the same one a contact has: the person who created the deal wears the ring, everyone else who can open it stacks beside them, and hovering any face says who they are and what they are to the deal.",
      },
      {
        kind: "feature",
        text: "The user-gear button beside them opens Manage Access — the creator, the deal team, and a search that puts a teammate on the deal. Whoever you add arrives with no commission split, ready to set on the Financials tab.",
      },
      {
        kind: "refinement",
        text: "Manage Access left the overflow menu, where it never did anything, and the invented avatars came off the deal photo's corner.",
      },
      {
        kind: "fix",
        text: "Deals are worked by people who actually work at the firm. Every seeded deal used to name a broker who was nobody, so their name linked nowhere and their avatar had no photo; on the Financials tab an internal broker now links to their real contact record.",
      },
    ],
  },
  {
    pr: 201,
    title:
      "A Managing Director previews a private contact instead of opening it, and read-only records stop inviting interaction",
    mergedAt: "2026-09-02T16:45:15Z",
    day: "2026-09-02",
    author: "ZS-buildout",
    area: "Contacts",
    summary:
      "Seeing that a private contact exists is not the same as being let in. A Managing Director with View Private Contacts now sees the name, the stage and who owns a private record, with everything else withheld until the owner shares it — and every read-only record stops looking like something you can act on.",
    highlights: [
      {
        kind: "feature",
        text: "On a private contact you haven't been shared into, a Managing Director sees the name, the stage and the owner. Every other detail — in the People table, the hero, the details, custom fields and briefing — shows as a muted rectangle, and the Timeline, Deals, Listing Inquiries, Properties, Lists and Tasks say they're hidden because the contact is private.",
      },
      {
        kind: "feature",
        text: "The request card on such a record reads \"Previewing private contact. Ask to collaborate.\" and explains that the preview comes from the View Private Contacts permission, that the rest stays hidden until the owner shares it, and that other brokers can't see the record at all.",
      },
      {
        kind: "refinement",
        text: "On a company-owned contact you aren't assigned to, the card reads \"You have read-only access. Ask to collaborate.\" and offers Contributor and Outreach only — everyone at the firm can already view it, so View isn't something to ask for.",
      },
      {
        kind: "refinement",
        text: "Timeline rows you can't act on no longer highlight on hover, so a read-only feed doesn't feel interactive.",
      },
      {
        kind: "refinement",
        text: "Hidden values on a previewed contact are still, darker and shorter: no loading shimmer, because nothing is loading.",
      },
      {
        kind: "refinement",
        text: "Hovering the lock beside a private contact's name in the People table says \"Private Contact\".",
      },
      {
        kind: "refinement",
        text: "The transfer dialog is titled \"Transfer ownership of\" the contact's name.",
      },
    ],
  },
  {
    pr: 200,
    title: "Contact ownership, privacy, sharing, and viewing as anyone",
    mergedAt: "2026-09-02T00:19:55Z",
    day: "2026-09-01",
    author: "ZS-buildout",
    area: "Contacts",
    summary:
      "A firm can now decide who owns its contacts and whether a broker may keep one private, and every screen honors the answer — what you can see, what you can do, and who has to grant you more. Two company switches and four permissions cover the open-book shop, the traditional broker-book shop, and the company that protects one rainmaker's book, on the same underlying system.",
    highlights: [
      {
        kind: "feature",
        text: "Company settings gains a Contact Ownership card: whether brokers can own the contacts they bring in, whether owned contacts can be private, and — for each — whether every Broker gets that by default or only the people you grant it to. Turn a switch off and the matching permission locks on every person's page until you turn it back on.",
      },
      {
        kind: "feature",
        text: "Four contact permissions on a person's Roles & Permissions page: Own Contacts, Mark Contacts Private, View Private Contacts, and Assign Contacts. Managing Directors get all four by default; Brokers get the first two.",
      },
      {
        kind: "feature",
        text: "A contact's hero says whose it is: the owner wears the ring (a building when the company owns it), the assignee sits beside it when the company does, and a Visible or Private badge shows whenever the record could be hidden. The owner locks it with a Private Contact switch above Do Not Call.",
      },
      {
        kind: "feature",
        text: "Mark a note, call, email, meeting or tour private from the composer, or afterwards from the row's menu. Only you see it — not the contact's owner, not anyone the record is shared with, not a Managing Director who can see private contacts.",
      },
      {
        kind: "feature",
        text: "What you can do on a contact follows your relationship with it. Owners and assignees act freely; someone shared in acts within their tier; everyone else reads and can request access from a card that replaces the composer. Calling, tasks, list actions, and the assistant all refuse the same way.",
      },
      {
        kind: "feature",
        text: "A private contact you have no relationship with does not exist for you: not in the People table or its counts, not in search, not in pickers, not through the assistant, and its link lands on Contact not found. Managing Directors with View Private Contacts see them, marked with a lock.",
      },
      {
        kind: "feature",
        text: "On a deal, a private party you cannot see appears as \"Private Contact\" with a short code and who holds the record, plus a Request access button — so the pipeline still adds up without giving away who the client is.",
      },
      {
        kind: "feature",
        text: "Two brokers can each hold their own record for the same person. When both are visible to you, the hero says so and offers to link them as one person without merging anything; Create Contact warns about a duplicate you can see and stays quiet about one you cannot.",
      },
      {
        kind: "feature",
        text: "Assign a company-owned contact to the person who will work it — from the hero, in bulk from the People page, or by asking Otto — and transfer a contact you own to another broker's book, keeping a Contributor seat if you like. Each hand-off lands on the timeline, and the history stays with whoever made it.",
      },
      {
        kind: "feature",
        text: "The account menu's Viewing as now switches which person you are, so the demo can walk the same screens as Sarah, Riley or Ethan. A Role submenu still lets you try the current seat as a different role, and clears when you change seats.",
      },
      {
        kind: "refinement",
        text: "Seeded timeline history is written by whoever actually works each contact, with collaborators taking a share of the notes and meetings, instead of every record reading as Ethan's. Contacts are assigned to real roster members by full name, and a few belong to the Office Admin so company ownership has standing examples.",
      },
      {
        kind: "refinement",
        text: "The hero's Show / Hide Contact Details button moved to its own row under the badges, so the stage, privacy badge and access avatars no longer crowd it out.",
      },
    ],
  },
  {
    pr: 199,
    title:
      "Move cold and inquiry-sourced leads to Nurturing when the broker works them, and answer an inquiry from an inline email editor",
    mergedAt: "2026-09-01T16:04:43Z",
    day: "2026-09-01",
    author: "ZS-buildout",
    area: "Contacts",
    summary:
      "A contact's stage now keeps up with the work by itself, so a lead you have started calling stops sitting on the Cold or Inquired page waiting for someone to change a dropdown. Answering a listing inquiry also became a real thing you can do from the timeline rather than a button that did nothing.",
    highlights: [
      {
        kind: "feature",
        text: "A cold contact moves to Nurturing the moment you work the record — create a task for them, send them an email, or log a call. Even a task counts: the record is no longer untouched once you have committed to following up.",
      },
      {
        kind: "feature",
        text: "A contact who came in through a listing inquiry moves to Nurturing when you email or call them, but not when you only create a task. A lead you have merely promised yourself to call is still an unworked lead, which is what the Inquired page is for.",
      },
      {
        kind: "feature",
        text: "Every automatic move leaves a row on the timeline saying what caused it — \"An email was sent to this contact, moving them to Nurturing\" — plus a toast, so a stage you did not change yourself explains itself.",
      },
      {
        kind: "feature",
        text: "The Email button on a listing inquiry now opens an inline editor under the row, so you answer the inquiry while still reading it. The subject starts as \"Re:\" and the listing's name, and you can edit it before sending.",
      },
      {
        kind: "refinement",
        text: "An email answering an inquiry lands as its own timeline row above it, carrying the listing it is about — an inquiry is a form submission, not an email thread, so nothing folds into it. Sending also clears the inquiry's follow-up bar, since emailing them is the follow-up.",
      },
      {
        kind: "fix",
        text: "\"Contact created\" no longer shows as a contact's most recent activity. Sixteen contacts had a creation date that fell after their own history, so their whole timeline read as having happened before the record existed.",
      },
      {
        kind: "fix",
        text: "A followed-up inquiry stays followed up. Answering one changes the contact's stage, which used to rebuild the timeline and bring the inquiry's action bar back as though nobody had replied.",
      },
    ],
  },
  {
    pr: 198,
    title:
      "Ask Otto to write any field in a contact's Log Activity block, and review it in the field itself",
    mergedAt: "2026-09-01T00:16:24Z",
    day: "2026-08-31",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "Every field in a contact's Log Activity block can now be handed to Otto from the field itself. You ask in the rail and read the answer where the text actually goes, rather than copying it back out of a conversation. Two things Otto did to a record — logging a note and completing a task — also stopped going missing from the timeline.",
    highlights: [
      {
        kind: "feature",
        text: "The sparkle on a Log Activity field hands it to Otto. Hovering says what the click will do — Generate Note, Generate Call Summary, Draft Email, Generate Meeting Note, Generate Tour Note — and reads Revise once the field has something in it.",
      },
      {
        kind: "feature",
        text: "Clicking it opens Otto with the field pinned above the message box, so the conversation is scoped to that one field. Dismiss the chip to go back to talking about anything.",
      },
      {
        kind: "feature",
        text: "Otto writes into the field itself, not into the chat. The text lands in the box as an unsaved draft you can edit — you still press Log Note or Send Email, so nothing reaches the record until you say so.",
      },
      {
        kind: "feature",
        text: "A field Otto is holding is tinted, so you can see what it is scoped to without looking at the rail. The tint follows the pin to whichever tab it belongs to.",
      },
      {
        kind: "feature",
        text: "One-tap revisions sit above the message box: Shorten, More formal and Clean up the wording on a note, call, meeting or tour, and Shorten, Warmer and More direct on an email. Revising an email leaves the subject line you wrote alone.",
      },
      {
        kind: "feature",
        text: "An empty field with nothing to go on gets a question instead of a guess — what should this note cover, what did you and Earl talk about, what should this email say. Tell Otto the gist and it writes it up.",
      },
      {
        kind: "refinement",
        text: "The field grows to fit what Otto wrote, so a long note can be read in one pass instead of through a three-line window, and it snaps back to its normal size once the note is logged. Logging also clears the chip.",
      },
      {
        kind: "fix",
        text: "A note Otto logs now appears on the contact's timeline straight away. It used to go only to the notes field behind the Edit Contact form, so asking Otto to log a note put it somewhere you would never look — while typing the same note into the composer put it on the timeline.",
      },
      {
        kind: "fix",
        text: "Completing a task writes a Task completed row on the person it belongs to, wherever you check it off — the Tasks page, the dashboard, or Otto's day plan. Only the contact page's own Tasks panel used to do this, so everywhere else the task just disappeared. Undo takes the row back with the checkbox.",
      },
      {
        kind: "fix",
        text: "Otto no longer flashes a record card and takes it away again while it is writing to a field. Looking something up on the way to an answer is a step, not the answer.",
      },
    ],
  },
  {
    pr: 197,
    title: "Add a Deposits page to Back Office, file deposits from it, and stop double-paying a co-broked deal's brokers",
    mergedAt: "2026-08-31T23:20:00Z",
    day: "2026-08-31",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Receivables tells you what has been billed and how much is still out. Deposits picks the money up from there: every cash receipt in the book on one page, each one split into what was held back before the split, what reached your brokers, what you still owe them, and what the house kept. You can file a new deposit from the page too, picking the voucher and typing how the money splits across its receivables. Building it turned up a real arithmetic bug underneath — on any deal with an outside broker, the brokers were owed more commission than the deal had billed.",
    highlights: [
      {
        kind: "feature",
        text: "Back Office now has a Deposits page listing every payment received, with the voucher, the brokers on it, the reference number, who paid and when.",
      },
      {
        kind: "feature",
        text: "Four columns say where each deposit went — Deducted Pre-Split, Paid To Brokers, Open Payables and Collected House Split — and they always add back up to the amount that landed.",
      },
      {
        kind: "feature",
        text: "A chart across the year shows the same split month by month, or by quarter, so you can see at a glance which months brought money in and how much of it is still owed out to brokers.",
      },
      {
        kind: "feature",
        text: "Search finds a deposit by amount, reference number, payer or voucher name, and you can narrow the page by year, broker, deal type or property type.",
      },
      {
        kind: "fix",
        text: "On a deal with an outside broker, the house broker kept the whole commission and the outside broker's share was added on top — so the two of them were owed up to 160% of what the deal had billed. The co-broke now comes off the top and the house splits what is left, which is how the money actually moves.",
      },
      {
        kind: "refinement",
        text: "Paid To Brokers is the cheque the broker actually received, after their own split and any hold-back. Open Payables is the gross figure the next cheque is written against, which is the number the voucher shows you.",
      },
      {
        kind: "feature",
        text: "New Deposit files a payment from the Deposits page itself. Search for the voucher, and its open receivables load with their balances so you can type how much of the money goes against each one.",
      },
      {
        kind: "feature",
        text: "As you fill the lines in, a running total says how much of the deposit is still left to place — and turns red, with Save switched off, if you apply more than actually arrived.",
      },
      {
        kind: "feature",
        text: "A deposit now records the check number as well as the reference number — two different facts that were being collapsed into one. Both modals ask for it, the Deposits page has a Check # column, and you can correct it on the voucher afterwards.",
      },
      {
        kind: "feature",
        text: "The voucher picker in New Deposit shows each voucher's status beside its name, so you can see whether it is a Draft or Approved before you file money against it.",
      },
      {
        kind: "refinement",
        text: "When one deposit paid two different parties, the Payer cell reads Multiple rather than naming one of them over the other. Search still finds the row under either name.",
      },
    ],
  },
  {
    pr: 196,
    title:
      "Rename a deal's Leads to Inquiries, and open each one in a panel the broker can work",
    mergedAt: "2026-08-31T22:25:24Z",
    day: "2026-08-31",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "A deal's Leads section is now Inquiries, and a row is no longer just a link somewhere else. Clicking one opens a panel over the table where you read the inquiry, change what you need to, attach a signed CA, and delete it if it does not belong there — without losing your search, your filters or your place in the list.",
    highlights: [
      {
        kind: "feature",
        text: "Clicking an inquiry opens a panel over the list with every column on one screen, so you no longer scroll a seventeen-column table sideways to find the four things you wanted.",
      },
      {
        kind: "feature",
        text: "Inquiry Status, Referral Source and Sale Doc Access Level can be changed from the panel. Each change saves as you make it, and the row behind the panel updates at the same time.",
      },
      {
        kind: "feature",
        text: "A progress bar shows how far a lead has got on their own — from viewing public documents through to high document access — with the current and next step named, and the full six steps one click away.",
      },
      {
        kind: "feature",
        text: "You can attach a signed confidentiality agreement to an inquiry, or tick it as signed if you took the agreement outside the app. The CA Status filter in the toolbar finally has something behind it.",
      },
      {
        kind: "feature",
        text: "Delete Inquiry removes someone from this deal's list, behind a confirmation. It deletes the lead, not the person: the contact stays in your book of business, and their inquiries on other deals are untouched.",
      },
      {
        kind: "refinement",
        text: "The section is called Inquiries everywhere inside a deal — the sidebar, the breadcrumb, the heading, the buttons and the columns — matching what the contact side has always called them.",
      },
      {
        kind: "refinement",
        text: "An edit belongs to the inquiry, not to the page you made it on. Changing a suite's inquiry from the building's list and from the suite's own page now write the same record instead of two that can disagree.",
      },
      {
        kind: "fix",
        text: "The access level dropdown in the list is saved rather than forgotten on the next page load, and it always agrees with the panel.",
      },
    ],
  },
  {
    pr: 195,
    title:
      "Pace Otto's replies out with a per-word fade, so a buffered response still reads as live",
    mergedAt: "2026-08-31T20:25:19Z",
    day: "2026-08-31",
    author: "buildoutfasterjoel",
    area: "Otto",
    summary:
      "On the hosted prototype Otto went quiet for several seconds and then dropped a finished paragraph in one go, because AWS Amplify holds a reply back until it is complete. His answers now arrive a word at a time, each fading in, at the pace they used to arrive at.",
    highlights: [
      {
        kind: "refinement",
        text: "Otto's replies appear a word at a time, each one fading in, instead of landing as a finished block of text after a silence.",
      },
      {
        kind: "refinement",
        text: "A reply Otto speaks aloud still appears all at once, so the words on screen cannot drift out of step with his voice. Asking for reduced motion turns the effect off too.",
      },
      {
        kind: "fix",
        text: "The conversation keeps pace with a reply as it appears, rather than letting the newest lines run on below the bottom of the panel. Scrolling up to re-read something earlier still holds your place.",
      },
    ],
  },
  {
    pr: 194,
    title:
      "Carry runtime environment variables into the Amplify compute bundle, so the gate and Otto work when deployed",
    mergedAt: "2026-08-31T19:17:04Z",
    day: "2026-08-31",
    author: "buildoutfasterjoel",
    area: "Platform",
    summary:
      "On the AWS Amplify deployment, Otto said it had no API key and the password gate let everyone straight in. Amplify hands environment variables to the build but not to the running server, so the two of them were reading settings that were never there. The build now passes them across on purpose.",
    highlights: [
      {
        kind: "fix",
        text: "Otto answers on the hosted prototype instead of reporting that the assistant is not configured.",
      },
      {
        kind: "fix",
        text: "The password gate protects the hosted prototype again. It had been letting everyone through, because a password it cannot read looks the same to it as no password being set.",
      },
      {
        kind: "fix",
        text: "Otto's voice works on the hosted prototype, rather than falling back to the browser's own speech.",
      },
    ],
  },
  {
    pr: 192,
    title:
      "Let a wide monitor keep the contact page's three columns with the assistant rail open",
    mergedAt: "2026-08-31T16:49:22Z",
    day: "2026-08-31",
    author: "ZS-buildout",
    area: "Contacts",
    summary:
      "Opening Otto beside a contact no longer costs you the third column when the screen has room for both. The page now asks whether what is left over fits three columns, instead of assuming the rail never leaves room for them.",
    highlights: [
      {
        kind: "fix",
        text: "On a wide monitor, opening Otto beside a contact keeps all three columns. Briefing and Tasks stay where they were instead of folding into tabs the moment the panel appears.",
      },
      {
        kind: "fix",
        text: "A laptop still drops to two columns with Otto open, as before — the point is that the screen decides, not the panel.",
      },
      {
        kind: "fix",
        text: "The contact page keeps its full width when it is showing three columns. It previously pulled itself narrower whenever Otto was open, which left the middle column too tight to hold a timeline row at any screen size.",
      },
      {
        kind: "fix",
        text: "On a narrow window the middle column no longer runs off the edge of the page and cuts the timeline off where you cannot scroll to it.",
      },
    ],
  },
  {
    pr: 191,
    title: "Render one deal with Buildout Classic's sidebar, marked by a Classic badge",
    mergedAt: "2026-08-31T16:30:52Z",
    day: "2026-08-31",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "A deal can now open the way Buildout Classic showed it. One seeded deal carries the flag, so the legacy layout and the current one can be compared side by side on the same record.",
    highlights: [
      {
        kind: "feature",
        text: "The Thompson Block now opens with Buildout Classic's sidebar — Deal, Listing and Financials, in legacy's order — over the deal page we already have. It is still a deal, and every section is the section it always was.",
      },
      {
        kind: "feature",
        text: "A grey Classic badge leads the deal's header and every card the deal appears on, so you can tell a classic deal before you open it.",
      },
      {
        kind: "feature",
        text: "The classic sidebar's Deals page lists the deals on the listing across legacy's eleven columns, with the deal title pinned in place while the rest of the row scrolls.",
      },
      {
        kind: "refinement",
        text: "On a classic deal the pencil button edits the listing rather than the deal, and Web Activity and Website open the two halves of the Website page — the split legacy had.",
      },
    ],
  },
  {
    pr: 190,
    title:
      "Give the previewed BOV its full page set, and let tags be read and written by Otto and by hand",
    mergedAt: "2026-08-31T15:18:36Z",
    day: "2026-08-31",
    author: "ZS-buildout",
    area: "Documents",
    summary:
      "The BOV a broker previews before sending is a whole document now, and a contact's tags can be changed — by asking Otto, or from the record itself.",
    highlights: [
      {
        kind: "feature",
        text: "The Broker Opinion of Value reads as a real document end to end: a cover, the opinion of value with its headline range, the property, whatever the underwriting run produced, comparable sales bracketing the building, and a weighted conclusion with a recommended list price. A quick screen previews a shorter BOV than a thorough one, and the page count follows the pages that exist.",
      },
      {
        kind: "feature",
        text: "Otto can read, add and remove a contact's tags. It checks the tags already in use across the book before adding one, so \u201cInvestor\u201d does not quietly become a second segment called \u201cinvestors\u201d.",
      },
      {
        kind: "feature",
        text: "The + beside a contact's tags opens a picker over the tags the book already uses \u2014 click to apply, click again to take off \u2014 with free text for a genuinely new one.",
      },
      {
        kind: "fix",
        text: "A tag removed from a contact stays removed. The chips were remembered only for as long as the page was open, so a reload brought them back.",
      },
      {
        kind: "fix",
        text: "The BOV email and the document now sign off as the broker who is signed in. Every draft was signed \u201cJohn\u201d, and the owners who wrote back addressed him the same way \u2014 a name that appears nowhere else in the product.",
      },
      {
        kind: "fix",
        text: "A building worth less than a million no longer prices at \u201c$0.2M \u2013 $0.2M\u201d. Below a million the range reads in thousands, so it stays a range.",
      },
      {
        kind: "refinement",
        text: "Property type reads as \u201cSpecial Purpose\u201d rather than \u201cspecial-purpose\u201d wherever the underwriting prints it, and the property page of a BOV shows three photos of the building that are not the one already filling its cover.",
      },
    ],
  },
  {
    pr: 189,
    title: "Add a Back Office Receivables index beside Vouchers",
    mergedAt: "2026-08-28T23:39:37Z",
    day: "2026-08-28",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "The Back Office menu has had a Receivables item pointing at a page that did not exist. This is the page: every commission billed across the book, and what is still out.",
    highlights: [
      {
        kind: "feature",
        text: "Receivables lists every billed line in the book with its payer, its due date and what is still owed — the same shape as the Vouchers list, so the two read as a pair.",
      },
      {
        kind: "feature",
        text: "A bar chart across the top shows what each month is owed and how much of it has been collected, so a late month is visible before you reach the rows.",
      },
      {
        kind: "feature",
        text: "Every line carries a status: Overdue, Open, or Fully Paid. A line paid after its due date reads Fully Paid — nobody owes it any more.",
      },
      {
        kind: "feature",
        text: "Tick the lines you want to bill and Create Invoice raises one, without going to the deal first. The button explains itself when a selection spans two deals or two payers, which an invoice cannot.",
      },
      {
        kind: "refinement",
        text: "Filter by broker by typing a name; each one you pick stays in the bar as a chip you can remove. The rest of the filters narrow the chart and the table together, so the bars always add up to the rows beneath them.",
      },
    ],
  },
  {
    pr: 188,
    title:
      "Write each PR's changelog entry in /ship, and stop the gate surprising people",
    mergedAt: "2026-08-28T19:31:58Z",
    day: "2026-08-28",
    author: "ZS-buildout",
    area: "Platform",
    summary:
      "The changelog gate met its first real pull request and failed it correctly, but everything around that failure pointed the wrong way.",
    highlights: [
      {
        kind: "feature",
        text: "Shipping a pull request now writes its own changelog entry, so the announcement is still reviewed prose but nobody has to remember to write it.",
      },
      {
        kind: "fix",
        text: "A failing changelog check now explains itself on the checks page rather than burying it in a run log — leading with the fact that it is not a stale branch, because merging the latest main was the first thing anyone tried.",
      },
      {
        kind: "refinement",
        text: "A pull request that merges without an entry no longer fails on the way out. Nothing can be done about it by then, so the run says what is missing and stays green; the check on the pull request is where it is meant to be caught.",
      },
    ],
  },
  {
    pr: 187,
    title:
      "Add payables and payments to the voucher, raised by the deposits that funded them",
    mergedAt: "2026-08-28T19:16:35Z",
    day: "2026-08-28",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Money going out of the brokerage on a settled voucher: what each broker is owed, and the cheques written against it.",
    highlights: [
      {
        kind: "feature",
        text: "An approved voucher raises a payable per broker per deposit — outside brokers first, then the house's own, because a co-broke comes off the top before the brokerage splits what is left. That is the order the money actually leaves in.",
      },
      {
        kind: "feature",
        text: "A payment is one cheque against one payable, and a payable can carry several. Gross is what the deal owes the broker; net is what they take home after their split and whatever came off that payment.",
      },
      {
        kind: "refinement",
        text: "A payable is raised by a deposit, never filed by hand — no add button, no editable amount, no delete of its own. The way to change one is to change the deposit that raised it.",
      },
      {
        kind: "fix",
        text: "A leased suite gets its own broker splits and deductions in the demo data, rather than inheriting its building's.",
      },
    ],
  },
  {
    pr: 186,
    title: "Add a What's New changelog page, and post each merged PR's entry to Slack",
    mergedAt: "2026-08-28T18:54:21Z",
    day: "2026-08-28",
    author: "ZS-buildout",
    area: "Platform",
    summary:
      "The prototype had no record of what changed between demos. This is that record, and the thing that keeps it up to date.",
    highlights: [
      {
        kind: "feature",
        text: "A Changelog page at /changelog, reachable from the account menu — one entry per merged pull request, sorted into new features, refinements and fixes, each linking back to the PR it came from.",
      },
      {
        kind: "feature",
        text: "Every merged pull request posts its entry to Slack, with the highlights grouped by kind since Slack has no badges to carry it.",
      },
      {
        kind: "feature",
        text: "A check fails any pull request that has not written its own entry, so the announcement is always prose someone reviewed rather than a rewritten commit log. Label it no-changelog to skip, for work with nothing user-facing.",
      },
    ],
  },
  {
    pr: 185,
    title: "Otto's record cards carry a stage and point at the record",
    mergedAt: "2026-08-28T14:55:59Z",
    day: "2026-08-28",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "When Otto finds or creates a record, the card it hands back names that record's stage and links straight to it.",
    highlights: [
      {
        kind: "feature",
        text: "A record card carries a stage or status badge next to the name, so a deal Otto found reads as a deal before you read the name.",
      },
      {
        kind: "refinement",
        text: "One result and several results now draw as the same card at two sizes, instead of two unrelated-looking things stacked in the same answer.",
      },
      {
        kind: "refinement",
        text: "A finished tool call settles into a quiet line rather than staying a badge, so the answer stays the loudest thing in the transcript.",
      },
    ],
  },
  {
    pr: 184,
    title: "Apply deposits against a voucher's receivables",
    mergedAt: "2026-08-28T00:12:07Z",
    day: "2026-08-27",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Enter one cash receipt — date, amount, reference number — and have it spread across the receivables it paid and the voucher's pre-split deductions.",
    highlights: [
      {
        kind: "feature",
        text: "Apply Deposit works from a receivable's own menu, where it covers that one line, or from the toolbar, where it covers every selected line in due-date order.",
      },
      {
        kind: "feature",
        text: "Each deposit sits as a child row under the receivable it paid, where it can be renamed or removed.",
      },
      {
        kind: "refinement",
        text: "Every deposit carries a reference number, editable in place.",
      },
      {
        kind: "refinement",
        text: "Both Apply Deposit entry points grey out once a line is fully credited, since a settled line has nothing left to receive.",
      },
    ],
  },
  {
    pr: 183,
    title:
      "The voucher's party lists become contact cards, and say what QuickBooks knows",
    mergedAt: "2026-08-27T22:11:31Z",
    day: "2026-08-27",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Buyer/Tenant and Billing were four-column tables charging a header for facts nobody compares down a column. They are contact cards now, side by side.",
    highlights: [
      {
        kind: "refinement",
        text: "Buyer/Tenant and Billing render as two columns of contact cards, collapsing to one column where half a row cannot hold a name, a company and an email.",
      },
      {
        kind: "feature",
        text: "A sync badge on each record says whether it exists in QuickBooks — green when it does, amber when it does not yet.",
      },
      {
        kind: "feature",
        text: "Force Sync with QuickBooks is offered on the receivable menus.",
      },
      {
        kind: "fix",
        text: "Receivables cells line up against their field labels again.",
      },
    ],
  },
  {
    pr: 182,
    title: "The Invoices page gets a real record, generated from a receivable",
    mergedAt: "2026-08-27T18:59:07Z",
    day: "2026-08-27",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "The page existed but had nothing behind it — one fake row derived per deal. Select receivables that share a payer and the voucher now writes a real invoice.",
    highlights: [
      {
        kind: "feature",
        text: "An invoice is filed against the deal, carrying who is billed and a line per receivable it was generated from.",
      },
      {
        kind: "refinement",
        text: "Billing and Receivables put their totals in a table footer, matching the voucher's other tables.",
      },
      {
        kind: "fix",
        text: "The store no longer arms its save timer where there is no IndexedDB to save to.",
      },
    ],
  },
  {
    pr: 181,
    title: "A voucher only leaves Draft once the deal has closed",
    mergedAt: "2026-08-27T16:59:39Z",
    day: "2026-08-27",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "The demo data had the lifecycle backwards, showing approved commission on proposals nobody had pitched yet. A voucher is the broker's working copy until the deal settles.",
    highlights: [
      {
        kind: "fix",
        text: "Every stage short of Closed now carries a Draft voucher, and only a closed deal can be Pending or Approved.",
      },
      {
        kind: "refinement",
        text: "The closed group grew from four deals to eight, so the Back Office queue has enough in it to read as a queue.",
      },
    ],
  },
  {
    pr: 180,
    title: "Reconnect the underwriting arc after the BOV, and let Otto offer the deal",
    mergedAt: "2026-08-27T01:24:13Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "There were two BOV implementations and the unreachable one was holding the demo story together. One flow now, hosted globally, priced off the underwrite it quotes.",
    highlights: [
      {
        kind: "fix",
        text: "The scripted demo silently stopped after the BOV email — no signed agreement, so no activation, no inbound leads, no LOI. It runs to the end again.",
      },
      {
        kind: "feature",
        text: "Otto offers the deal, shows its working, then offers to underwrite it.",
      },
      {
        kind: "fix",
        text: "The call recap card reports the call the log modal just described, rather than the one before it.",
      },
      {
        kind: "refinement",
        text: "One record row serves both the menu and the rail, and the transcript groups what belongs together.",
      },
    ],
  },
  {
    pr: 179,
    title:
      "Freeze a submitted voucher, and give it Buyer/Tenant, Billing and real receivables",
    mergedAt: "2026-08-27T00:18:21Z",
    day: "2026-08-26",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Submitting handed the voucher to an approver but left most of the page live — a broker could rewrite the rent schedule an approver was reading.",
    highlights: [
      {
        kind: "refinement",
        text: "A Pending voucher is read-only end to end, and Receivables drops the checkbox gutter rather than leaving checkboxes that tick and mean nothing.",
      },
      {
        kind: "refinement",
        text: "Submitting is one-way. The Edit that un-submitted a voucher is gone, and the submit toast says so outright.",
      },
      {
        kind: "feature",
        text: "Receivables can be created, edited and deleted, each billed to one contact picked from the address book.",
      },
      {
        kind: "fix",
        text: "Date pickers inside a locked group were still writing dates.",
      },
    ],
  },
  {
    pr: 178,
    title: "Keep a record of the Next Actions you have worked",
    mergedAt: "2026-08-26T21:33:31Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "The queue is a working surface, so finished work left no trace: the count went down and the work itself vanished. Each completion now folds into the transcript where it happened.",
    highlights: [
      {
        kind: "feature",
        text: "A completed next action drops a folded entry into the transcript at the point the work happened, so scrolling back reads as a record of the day.",
      },
      {
        kind: "feature",
        text: "A record Otto creates comes back as a card you can open.",
      },
      {
        kind: "refinement",
        text: "Email drafts and sent receipts slide into the transcript rather than appearing in it.",
      },
      {
        kind: "fix",
        text: "Otto can see a self-arriving email on a contact's timeline, instead of answering confidently without it.",
      },
    ],
  },
  {
    pr: 177,
    title: "Dock toasts at the bottom left, clear of the rail and the composer",
    mergedAt: "2026-08-26T19:59:56Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Navigation",
    summary:
      "A toast landed on the assistant's full-screen composer — the one control you are reaching for at exactly that moment.",
    highlights: [
      {
        kind: "refinement",
        text: "Toasts stack from the bottom left, stepping right of the icon rail in the app shell so they clear it in both nav modes.",
      },
    ],
  },
  {
    pr: 176,
    title: "Slide the assistant panel into full screen, and a batch of rail refinements",
    mergedAt: "2026-08-26T19:17:22Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "The full-screen toggle learned to move, over three passes at the animation, alongside a batch of smaller corrections against the design file.",
    highlights: [
      {
        kind: "feature",
        text: "The assistant panel slides into full screen and back instead of cutting to it, and a call going live collapses it again.",
      },
      {
        kind: "refinement",
        text: "The four unlabelled glyphs on the next-actions card carry tooltips whose text repeats their labels verbatim.",
      },
      {
        kind: "refinement",
        text: "Section carets move to the right of their label, so a column of finished work stops reading as indented from the prose around it.",
      },
      {
        kind: "refinement",
        text: "The composer takes focus when the rail opens, and an email draft no longer offers a Delete.",
      },
    ],
  },
  {
    pr: 175,
    title: "Show dictation as it lands, quiet the stop button, and stop the mic switching voice on",
    mergedAt: "2026-08-26T18:10:27Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "Three corrections to the assistant's composer, from the Otto AI Chat Rail Figma file. The through-line: a control you are about to click must not move.",
    highlights: [
      {
        kind: "refinement",
        text: "Dictation types into the composer as it lands, so a misheard phrase is visible before it sends rather than after it comes back as a wrong answer.",
      },
      {
        kind: "refinement",
        text: "Stop drops the send button's purple gradient for a ghost button. Cancelling a reply is a recovery, not the loudest invitation on the bar.",
      },
      {
        kind: "refinement",
        text: "Only one control holds the composer's action slot at a time, so nothing slides out from under the cursor mid-turn.",
      },
      {
        kind: "refinement",
        text: "The mic no longer turns Otto's spoken replies on as a side effect of dictating.",
      },
    ],
  },
  {
    pr: 174,
    title: "Pin the next-actions queue above the composer, and stop list tools failing silently",
    mergedAt: "2026-08-26T17:41:36Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "The next-actions queue stops being a card in the transcript and becomes a pinned surface the broker works \u2014 plus two tools that had been failing silently the whole time.",
    highlights: [
      {
        kind: "fix",
        text: "Asking Otto for a list rendered the answer text and no cards, because both list tools were throwing on a filter the broker had not set. Every tool result now survives the runtime's stricter serializer.",
      },
      {
        kind: "fix",
        text: "The transcript read out of order \u2014 a later answer could appear above a call recap from turns earlier.",
      },
      {
        kind: "feature",
        text: "The queue pins above the composer, folds behind a competing card, and reopens when a move completes or the broker asks for it again.",
      },
      {
        kind: "feature",
        text: "A task move leads with the contact rather than the task list, falling back to the deal where there is no contact.",
      },
    ],
  },
  {
    pr: 173,
    title: "Bring Otto's tool surface to parity with the assistant shipping on staging",
    mergedAt: "2026-08-26T14:04:23Z",
    day: "2026-08-26",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "The prototype claimed four capabilities against 30 tools; the Otto shipping on staging claims nine and runs 31. This closes the gap toward the shipped thing, using its tool names verbatim so the two inventories stay diffable.",
    highlights: [
      {
        kind: "feature",
        text: "Sixteen tools added \u2014 tasks, activities, attachments, vouchers, property research, pipeline totals, contact updates, call logging and briefings \u2014 each reading the same data the matching page reads, so Otto cannot report a record the broker then cannot find.",
      },
      {
        kind: "refinement",
        text: "add_note folds into add_activity. Two tools that both log a note is a routing coin-flip.",
      },
      {
        kind: "refinement",
        text: "Otto says outright when it cannot read an attachment's contents, or when a researched property is not in your book, rather than summarising a file it never opened.",
      },
    ],
  },
  {
    pr: 172,
    title: "Edit a Draft voucher's deductions and internal commissions in place, behind a Save",
    mergedAt: "2026-08-25T23:22:44Z",
    day: "2026-08-25",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "The voucher's two allocation tables become editable in place while the voucher is a Draft, committed by a Save rather than saving as you type.",
    highlights: [
      {
        kind: "feature",
        text: "Pre-Split Deductions edits in place: category is a dropdown over the five real categories, and description, percent, amount and covered are typed straight into the row.",
      },
      {
        kind: "feature",
        text: "Internal Commissions edits on the same terms, and Transaction Side becomes a per-broker dropdown \u2014 it was a deal-level label, which could not describe a dual-side deal where two brokers worked opposite ends.",
      },
      {
        kind: "refinement",
        text: "Add Broker is a modal with a combobox rather than a blank row, and the last internal broker cannot be removed.",
      },
      {
        kind: "refinement",
        text: "An approved voucher no longer offers a pencil into the terms it signed off on.",
      },
    ],
  },
  {
    pr: 171,
    title: "Stop Otto repeating what its cards already say, and let a slow tool explain itself",
    mergedAt: "2026-08-25T22:03:24Z",
    day: "2026-08-25",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "The rail says a thing once, in the place best able to say it \u2014 and anything it shows about work in progress has to be true.",
    highlights: [
      {
        kind: "refinement",
        text: "The system prompt stops quoting UI copy verbatim. Four per-tool rules about staying quiet collapse into one rule about artifacts, so a copy tweak can no longer leave the model reasoning from a description of a screen that does not exist.",
      },
      {
        kind: "fix",
        text: "The spinner stopped running underneath a card that had already landed.",
      },
      {
        kind: "fix",
        text: "A result's lead-in sentence sits above the results it introduces, not below them.",
      },
      {
        kind: "feature",
        text: "A slow tool says what it is doing, and how long it has been at it.",
      },
    ],
  },
  {
    pr: 170,
    title: "Give Otto the voice picked on the ElevenLabs account instead of stock Adam",
    mergedAt: "2026-08-25T21:29:51Z",
    day: "2026-08-25",
    author: "buildoutfasterjoel",
    area: "Otto",
    summary:
      "Otto had been speaking in ElevenLabs' stock \"Adam\" premade voice since the voice layer landed. That id was always a placeholder.",
    highlights: [
      {
        kind: "refinement",
        text: "Otto's default voice points at the voice actually chosen on the Buildout account. The per-environment override still wins, and the stock voice pools used for owner call lines are untouched.",
      },
    ],
  },
  {
    pr: 169,
    title: "Edit a deal's transaction on the Deal form, and make the voucher's submit-attest-reopen flow real",
    mergedAt: "2026-08-25T20:30:45Z",
    day: "2026-08-25",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "The Deal form absorbs the voucher's transaction editing, and the voucher's submit and approval flow stops being a mock.",
    highlights: [
      {
        kind: "feature",
        text: "A deal's transaction is edited on the Deal form. The voucher's four-field modal is gone \u2014 two forms over the same four fields meant two places to fix a label and two places for the commission math to drift.",
      },
      {
        kind: "feature",
        text: "A space gets its own edit page, nested under its building. Removing the modal exposed the gap it had been papering over: a space carries the transaction, not its shell, and only a building had an edit page.",
      },
      {
        kind: "feature",
        text: "A voucher can be submitted, attested to, and reopened.",
      },
      {
        kind: "refinement",
        text: "Both header pencils carry an Edit deal label. A tooltip describes an icon-only button, it does not name it \u2014 so it reached the accessibility tree unnamed.",
      },
    ],
  },
  {
    pr: 168,
    title: "Size the omnibar to the design, open the palette over it, and re-centre Otto's home screen",
    mergedAt: "2026-08-25T15:35:46Z",
    day: "2026-08-25",
    author: "ZS-buildout",
    area: "Navigation",
    summary:
      "Follow-ups to the app shell, all against the same Figma file.",
    highlights: [
      {
        kind: "refinement",
        text: "The omnibar is 600 by 40 and stays centred over the page container, shrinking against classic nav's five section labels rather than overflowing.",
      },
      {
        kind: "refinement",
        text: "The command palette opens over the omnibar \u2014 same top edge, same centre \u2014 so the bar appears to grow into the menu.",
      },
      {
        kind: "refinement",
        text: "Navigating collapses full-screen chat back to the rail. Full screen hides the page entirely, so a navigation that left it up would take the broker somewhere they could not see.",
      },
      {
        kind: "fix",
        text: "Otto's home screen is vertically centred again. The reading column added for full-screen chat had nothing for the centring to resolve against, so the greeting collapsed to the top.",
      },
    ],
  },
  {
    pr: 167,
    title: "Frame the product in an app shell, let the chat take the whole frame, and hide the style toggle by default",
    mergedAt: "2026-08-25T13:23:46Z",
    day: "2026-08-25",
    author: "ZS-buildout",
    area: "Navigation",
    summary:
      "Three changes that share the same files and would not build apart: the app shell frames the page, full-screen chat takes over the frame it creates, and the design-options button moves out of the corner the shell's rail now owns.",
    highlights: [
      {
        kind: "feature",
        text: "A second global nav shape \u2014 a 48px icon rail down the left plus a top bar to its right \u2014 switched from the account menu and now the default. Classic stays reachable for side-by-side comparison.",
      },
      {
        kind: "feature",
        text: "The assistant chat can take over the whole frame.",
      },
      {
        kind: "refinement",
        text: "The top bar's outer zones are pinned to the same width. That equality is the whole design: it puts the omnibar and the Assistant pill dead-centre over the page container rather than wherever the brand's length and the account icon count happen to leave them.",
      },
      {
        kind: "refinement",
        text: "The rail drops section labels, so the interactions pay for them \u2014 a leaf gets a tooltip, a group gets a flyout on hover and on keyboard focus, and clicking a group goes to its first child. An icon you can hover but not click reads as broken.",
      },
    ],
  },
  {
    pr: 166,
    title: "Hold the navbar one render so hydration stops failing on every page load",
    mergedAt: "2026-08-25T05:04:34Z",
    day: "2026-08-25",
    author: "ZS-buildout",
    area: "Navigation",
    summary:
      "Every full page load, on every route, threw a hydration mismatch into the console \u2014 so React discarded the server markup and rebuilt the tree client-side, and SSR was doing no useful work on any load.",
    highlights: [
      {
        kind: "fix",
        text: "The navbar holds one render before mounting, so the first client render matches the server. Blueprint's Navbar picks its mobile or desktop tree by reading the viewport during that first render, which the server cannot do, so every window under 1024px mismatched.",
      },
    ],
  },
  {
    pr: 165,
    title: "Move the contact pager right, keep email threads whole, and drop a permission control that duplicated its switch",
    mergedAt: "2026-08-25T04:45:28Z",
    day: "2026-08-24",
    author: "ZS-buildout",
    area: "Contacts",
    summary:
      "Three small corrections to surfaces that shipped recently.",
    highlights: [
      {
        kind: "fix",
        text: "The contact list pager moves to the far right of the breadcrumb row. Stepping through a list and leaving it are different intents, and the one that navigates within the page belongs at the opposite end from the one that navigates out of it.",
      },
      {
        kind: "fix",
        text: "The timeline's Emails filter had been shattering every thread into one card per message \u2014 you asked for the email traffic and got the same exchange three times over. A filter subtracts rows; it does not restructure the ones it keeps.",
      },
      {
        kind: "refinement",
        text: "A customized permission row drops the reset control that duplicated its own switch.",
      },
    ],
  },
  {
    pr: 164,
    title: "Open Otto's rail on a home screen, and let each artifact speak for itself",
    mergedAt: "2026-08-25T04:38:42Z",
    day: "2026-08-24",
    author: "ZS-buildout",
    area: "Otto",
    summary:
      "Rebuilds the assistant rail against the Figma refresh. The through-line: finished work gets quieter, and the one live artifact gets to be the loudest thing on screen.",
    highlights: [
      {
        kind: "feature",
        text: "The rail opens on a home screen rather than into a transcript. The greeting, the hero offer and the starter prompts used to be early messages that scrolled away and never came back; they are a place the rail returns to now.",
      },
      {
        kind: "feature",
        text: "A tool chip turns into a titled section once its call lands, carrying the artifact \u2014 so everything Otto has already done sits in the transcript at the weight of a line of prose rather than as a stack of competing cards.",
      },
      {
        kind: "refinement",
        text: "The email flow reads as one sequence: a draft opens, a revision folds the previous one shut and opens as v2, and sending folds them all.",
      },
      {
        kind: "refinement",
        text: "Starter rows lose their borders and shadows. On the home screen they are the only other thing on the page, so they no longer have to fight for attention.",
      },
    ],
  },
  {
    pr: 163,
    title: "Say who approved a voucher, gate Submit to Drafts, and give Receivables' Actions button something to act on",
    mergedAt: "2026-08-24T23:46:10Z",
    day: "2026-08-24",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "A polish pass over the voucher: what an approved one tells you, what you can do to it in each of its three states, and what the Receivables Actions button was for.",
    highlights: [
      {
        kind: "feature",
        text: "An approved voucher says who signed it off and on what day. The approver is a real person from the roster, narrowed to the back-office roles \u2014 a voucher is the brokerage paying itself, so the broker who closed the deal is the one person who should not be approving it.",
      },
      {
        kind: "feature",
        text: "Receivables gets bulk actions and a sales-tax button.",
      },
      {
        kind: "fix",
        text: "Only a Draft voucher offers Submit.",
      },
      {
        kind: "fix",
        text: "A lease space no longer inherits its building's voucher, which had a suite nobody had closed showing someone else's approval.",
      },
    ],
  },
  {
    pr: 162,
    title: "Fix what the voucher date filters actually mean, and make the table the page's only scroller",
    mergedAt: "2026-08-24T19:41:24Z",
    day: "2026-08-24",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "Follow-up on the Back Office voucher index. The date windows were reading the wrong date, and correcting it changes what the page shows by default.",
    highlights: [
      {
        kind: "fix",
        text: "\"Last 365 days\" and \"Year to date\" read the deal's created date, not its close date. Only a closed deal carries a close date at all, so the default view had been hiding exactly the draft vouchers the back office is chasing \u2014 5 rows of 27 became 14.",
      },
      {
        kind: "refinement",
        text: "Two filter labels change to say which date they read: \"Last Year\" becomes \"Closed last year\", and \"Any close date\" becomes \"All time\", which named a date it no longer restricts.",
      },
      {
        kind: "fix",
        text: "A shell has no voucher of its own.",
      },
      {
        kind: "refinement",
        text: "The voucher table is the page's only scroller, its pagination is centred, and a pending voucher sits on the warning ramp.",
      },
    ],
  },
  {
    pr: 161,
    title: "Add a Back Office section, and give every voucher one place to be found",
    mergedAt: "2026-08-24T18:29:39Z",
    day: "2026-08-24",
    author: "buildoutfasterjoel",
    area: "Back Office",
    summary:
      "The voucher already existed as a tab on the deal page. What was missing was the view across deals \u2014 a broker chasing an unsubmitted voucher had to open deals one at a time to find it.",
    highlights: [
      {
        kind: "feature",
        text: "One row per deal across the whole book, filterable, each row pointing at the right voucher page for its deal's shape: a sale, a space nested under its building, or a shell's per-space index.",
      },
      {
        kind: "feature",
        text: "A deal shows where its voucher stands, beside the button that moves it.",
      },
      {
        kind: "refinement",
        text: "Back Office returns to the global nav as a dropdown with Vouchers as its first destination. Contacts stays its own leaf, so it does not light the new group.",
      },
    ],
  },
  {
    pr: 160,
    title: "Make the editor's Otto edit the document, and unfreeze the client-tool loop both Ottos were stuck in",
    mergedAt: "2026-08-21T22:57:16Z",
    day: "2026-08-21",
    author: "buildoutfasterjoel",
    area: "Documents",
    summary:
      "The Otto tab in the document editor's left rail was a shell \u2014 a real composer and three starter prompts, where every ask got the same hardcoded placeholder after a fake 700ms delay. It now edits the open document by being asked.",
    highlights: [
      {
        kind: "feature",
        text: "Fourteen tools that rewrite copy, add and remove blocks, and build pages. The definitions carry no server-side execute, and that absence is the privacy property: the document never leaves the browser, only a compact context snapshot does.",
      },
      {
        kind: "feature",
        text: "One relay serves both assistants, selected by which tool set the caller asks for, so every existing caller is untouched.",
      },
      {
        kind: "fix",
        text: "The app-wide assistant rail's tool calls had been hanging too, for the same reason and independently of this work. Both are unfrozen.",
      },
    ],
  },
  {
    pr: 159,
    title: "Drop the DynamicField block for liquid tokens, and make a wrapped chip read as one",
    mergedAt: "2026-08-20T23:54:20Z",
    day: "2026-08-20",
    author: "buildoutfasterjoel",
    area: "Documents",
    summary:
      "Finishes the move to inline liquid tokens by deleting the mechanism it replaced. A whole block bound to one listing field was the weaker of two ways to say the same thing \u2014 a paragraph-length binding that could not be edited as text and could not hold a word of its own.",
    highlights: [
      {
        kind: "refinement",
        text: "The Dynamic Field block is gone. Its five uses in the templates become text blocks holding the token, and the rich-text toolbar's Insert Field picker \u2014 already how most bindings were being added \u2014 is now the only way in.",
      },
      {
        kind: "fix",
        text: "A token chip that wraps across a line reads as one chip rather than two.",
      },
    ],
  },
  {
    pr: 158,
    title: "Pin nitro off the nightly, and clear the one Blueprint workaround 1.3.1 retires",
    mergedAt: "2026-08-20T20:02:47Z",
    day: "2026-08-20",
    author: "buildoutfasterjoel",
    area: "Platform",
    summary:
      "A routine dependency refresh that turned into a small audit: the upgrade broke the dev server outright, and once it was running, most of the local Blueprint patches turned out to still be needed.",
    highlights: [
      {
        kind: "fix",
        text: "The dev server would not start at all. A floating nitro nightly had pulled in a package that switched to an undeclared import, so there was nothing for the installer to fetch and a reinstall could not fix it. Nitro is pinned to a tagged release now.",
      },
      {
        kind: "refinement",
        text: "One Blueprint workaround that 1.3.1 made redundant is gone; the rest were re-checked and kept.",
      },
      {
        kind: "fix",
        text: "The record-form gutter labels left-align.",
      },
    ],
  },
  {
    pr: 157,
    title: "Generate a document from the deal's files, with the AI proposing the template",
    mergedAt: "2026-08-19T23:35:01Z",
    day: "2026-08-19",
    author: "buildoutfasterjoel",
    area: "Documents",
    summary:
      "The New Document modal was a template chooser: picking a name navigated to an editor that always built the same fixed Proposal, and nothing about the deal reached it. It is now an ingestion flow.",
    highlights: [
      {
        kind: "feature",
        text: "The files propose the document rather than the broker picking a type blind \u2014 photos alone suggest a Brochure, a T-12 and a rent roll suggest an Offering Memorandum, with the best fit preselected so Generate works untouched.",
      },
      {
        kind: "feature",
        text: "A text box for emphasis, with suggestion cards that each state their consequence. Cards append their sentence to the box and the outline is parsed from that text, so a clicked card and the same phrase typed by hand go through one mechanism.",
      },
      {
        kind: "feature",
        text: "A staged generation run, then a read-only review crediting every section to the file or phrase that produced it \u2014 and naming any selected file that contributed nothing rather than dropping it silently.",
      },
      {
        kind: "feature",
        text: "The finished document is filed on the deal and opens in the editor. Nothing persists until you open it, so backing out leaves no orphan behind.",
      },
    ],
  },
  {
    pr: 156,
    title: "Give global nav sections dropdowns, and put Email Campaigns under Deals",
    mergedAt: "2026-08-19T18:55:26Z",
    day: "2026-08-19",
    author: "buildoutfasterjoel",
    area: "Navigation",
    summary:
      "The email campaign page had no route into it from the global nav \u2014 it was reachable only from the prototype index. Rather than add a sixth top-level section, Deals becomes the first nav dropdown.",
    highlights: [
      {
        kind: "feature",
        text: "Nav sections can be dropdowns, and Email Campaigns moves under Deals. Giving another section a dropdown is now a data edit rather than a markup change.",
      },
      {
        kind: "refinement",
        text: "A group lights when any of its children match, and never on its own \u2014 nothing navigates to a group's own label.",
      },
    ],
  },
  {
    pr: 155,
    title: "Pin the navbar height, and stop the Suite home showing a stale date",
    mergedAt: "2026-08-19T16:13:20Z",
    day: "2026-08-19",
    author: "buildoutfasterjoel",
    area: "Navigation",
    summary:
      "Two bugs found while demoing. Both looked like a value someone had typed wrong, and turned out to be values nobody had typed at all.",
    highlights: [
      {
        kind: "fix",
        text: "The navbar measured 56px on some pages and 60px on others at the same viewport. It was a shrinkable flex item in the shell's column, so its height was effectively reporting how tall the page below it wanted to be. It is pinned now \u2014 chrome has no business absorbing layout pressure from the page.",
      },
      {
        kind: "fix",
        text: "The Suite home showed a stale date.",
      },
    ],
  },
  {
    pr: 154,
    title: "Put dynamic fields inside text blocks as inline liquid tokens",
    mergedAt: "2026-08-18T22:12:03Z",
    day: "2026-08-18",
    author: "buildoutfasterjoel",
    area: "Documents",
    summary:
      "A document could bind a whole block to a listing field, but not a single value mid-sentence \u2014 so \"a building in Charlotte with 176,761 SF\" had to be typed by hand and went stale the moment the deal changed.",
    highlights: [
      {
        kind: "feature",
        text: "Inline liquid tokens inside text blocks. The stored text keeps the token literally; the canvas renders it as an atomic chip carrying the live value, so nothing resolved is ever persisted and re-pointing a document at another listing re-resolves everything.",
      },
      {
        kind: "refinement",
        text: "Because the mechanism sits inside the shared inline-text component, it lands on headings, text blocks, list items and table cells at once.",
      },
    ],
  },
  {
    pr: 153,
    title: "Add four document page templates, and a map block with working controls",
    mergedAt: "2026-08-18T20:13:59Z",
    day: "2026-08-18",
    author: "buildoutfasterjoel",
    area: "Documents",
    summary:
      "Four document page templates for the editor, plus the image-crop fix that makes swapping photos on any of them work.",
    highlights: [
      {
        kind: "feature",
        text: "A generated Table of Contents. It stores no entries \u2014 it derives them from the page list every render, so renaming, reordering, adding or hiding a page updates the list with no second copy to keep in sync.",
      },
      {
        kind: "feature",
        text: "Property Description, Photo Gallery, and a rebuilt Location template with a real map block.",
      },
      {
        kind: "fix",
        text: "Swapping an image no longer resizes its block. The picker rebuilt the URL at a hardcoded 736 by 300, which flattened every image block in the document \u2014 worst on the cover, where the hero shrank and stranded the navy band mid-sheet.",
      },
    ],
  },
  {
    pr: 152,
    title: "Add the Property Summary template, and give base pages a company header and footer",
    mergedAt: "2026-08-18T00:16:28Z",
    day: "2026-08-17",
    author: "buildoutfasterjoel",
    area: "Documents",
    summary:
      "Six pieces of document-editor work: three fixes to how pages and selections behave, then a data-driven Property Summary template and the three capabilities it needed.",
    highlights: [
      {
        kind: "feature",
        text: "Every page that is not a bespoke layout closes with a company footer over a hairline, pairing with the logo band already at the top, so a page reads as the company's from both ends. Which pages get it is an explicit property, not something inferred.",
      },
      {
        kind: "feature",
        text: "The Property Summary template, plus list blocks, bleeding images and asset-class row rendering, all bound to the deal's marketing copy.",
      },
      {
        kind: "refinement",
        text: "The sample proposal drops from 23 pages to 14. Seven of the cut pages were title-only section dividers and four were near-duplicate map and comps pages, so scrolling the document mostly meant scrolling past filler. Every section is still represented.",
      },
      {
        kind: "fix",
        text: "The page toolbar is clipped to the canvas instead of floating over the editor's own toolbars, and selections inside containers resolve correctly.",
      },
    ],
  },
  {
    pr: 150,
    title: "Build the Pipeline Report, and settle the shell the other reports will wear",
    mergedAt: "2026-08-17T20:59:51Z",
    day: "2026-08-17",
    author: "buildoutfasterjoel",
    area: "Reports",
    summary:
      "The reports index listed eighteen pre-built reports and linked none of them. This builds the first and, in doing so, settles the template the other seventeen will wear.",
    highlights: [
      {
        kind: "feature",
        text: "The Pipeline Report, and the Pipeline card on the index now links to it. Pipeline went first because it reports on deals \u2014 the record everything else revolves around \u2014 so the shape was tested against the data model's centre rather than its edge.",
      },
      {
        kind: "refinement",
        text: "The report un-nests from the reports layout so it can carry its own header band. Nesting it would have put that band inside the index's own, beside a two-tab sidebar that does not apply to it \u2014 the same rival-frame failure the space and suite work hit twice and reverted twice.",
      },
    ],
  },
  {
    pr: 149,
    title: "Build the Reports index, and split it into standard and saved reports",
    mergedAt: "2026-08-17T17:56:09Z",
    day: "2026-08-17",
    author: "buildoutfasterjoel",
    area: "Reports",
    summary:
      "The global navbar had linked Reports since it was written, but no route ever answered it \u2014 clicking it 404'd. This builds the index behind the link. Nothing generates a report yet.",
    highlights: [
      {
        kind: "feature",
        text: "Two real routes rather than local tab state: the reports Buildout ships pre-built, and the custom reports a user has saved from their own filters.",
      },
      {
        kind: "refinement",
        text: "The eighteen pre-built reports are grouped by the record they read from. Eighteen flat rows is a wall to scan; \"which record am I reporting on\" narrows it to two or three candidates.",
      },
    ],
  },
  {
    pr: 148,
    title: "Group the space Details form into three sections, and fix the combobox row",
    mergedAt: "2026-08-17T16:52:36Z",
    day: "2026-08-17",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "The space Details page was the last long record form still built the old way: one flat run of about 60 fields whose only structure was comment dividers, a pile of six unrelated switches near the foot, and an accordion holding 25 more.",
    highlights: [
      {
        kind: "feature",
        text: "Three groups \u2014 The Space, Lease Terms, Expenses \u2014 on the same shell the Listing and Deal forms use, each group's long tail a collapsed disclosure named for its contents.",
      },
      {
        kind: "refinement",
        text: "The flag pile dissolves. Hide rate sits under the rate it suppresses, the tenant-pays switches sit in Expenses, signage moves to the fit-out tail. A switch beside the fields it governs is legible; a column of six unrelated ones is not.",
      },
      {
        kind: "refinement",
        text: "The tails are re-cut per group. A NNN quote is not long-tail detail, so Expenses is a visible group rather than part of the old undifferentiated pile.",
      },
      {
        kind: "fix",
        text: "The combobox field fits one row.",
      },
    ],
  },
  {
    pr: 147,
    title: "Group the Deal form into three sections, and share its shell with the Listing form",
    mergedAt: "2026-08-14T22:31:36Z",
    day: "2026-08-14",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "Applies the Listing form's grouping to the Deal edit form with the deal's own fields: three groups over eleven clusters, replacing a flat run of sections separated by rules.",
    highlights: [
      {
        kind: "feature",
        text: "The Deal form is three groups of clusters, and the Income figures become a row of stat cards.",
      },
      {
        kind: "refinement",
        text: "The record-form shell moves out of the listings folder. It had started leaking across the boundary by accident \u2014 the Deal page was already picking up the Listing form's widgets and rendering a 16px-wide Split % input as a result.",
      },
      {
        kind: "feature",
        text: "Every cluster on the Listing form carries a description of what it holds.",
      },
      {
        kind: "fix",
        text: "Field geometry corrected on both record forms.",
      },
    ],
  },
  {
    pr: 146,
    title: "Group the Listing form into five sections, and make the result legible",
    mergedAt: "2026-08-14T01:00:19Z",
    day: "2026-08-13",
    author: "buildoutfasterjoel",
    area: "Deals",
    summary:
      "The Listing form rendered 14 flat sections in one column, and which of them apply depends on deal type, property type and status \u2014 so a broker scrolled past sections that could never apply to the deal in front of them.",
    highlights: [
      {
        kind: "feature",
        text: "Fourteen sections group into five \u2014 Location, The Asset, Units, Marketing, Disclaimer & Notes \u2014 with which-groups-render extracted into pure, tested logic rather than inlined conditionals.",
      },
      {
        kind: "refinement",
        text: "Hierarchy is drawn rather than spaced: a group gets an icon and a heading, a cluster gets its own tile with its name in a left gutter, and two spacing tiers separate a control from the field it reveals (8px) from fields that are peers (16px). Spacing alone could not fix a wall of 89 inputs, because a tier is only legible if the things on it look different.",
      },
      {
        kind: "feature",
        text: "Unit Mix and Rent Roll become real tables, map override coordinates are picked off a map, and marketing channels pick from cards rather than pills.",
      },
      {
        kind: "fix",
        text: "No field renders narrower than half a row.",
      },
    ],
  },
];

/** Distinct kinds an entry contains, in badge order. */
export function entryKinds(entry: ChangelogEntry): ChangeKind[] {
  return KIND_ORDER.filter((kind) =>
    entry.highlights.some((h) => h.kind === kind),
  );
}

/** How many highlights of each kind the whole log holds. */
export function kindCounts(
  entries: ChangelogEntry[],
): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = {
    feature: 0,
    refinement: 0,
    fix: 0,
  };
  for (const entry of entries) {
    for (const h of entry.highlights) counts[h.kind] += 1;
  }
  return counts;
}

export type ChangelogDay = { day: string; entries: ChangelogEntry[] };

/**
 * Entries bucketed by calendar day, newest day first, preserving the array's
 * order within each day. Keyed off the stored `day` so the grouping is the same
 * on the server and in the browser.
 */
export function groupByDay(entries: ChangelogEntry[]): ChangelogDay[] {
  const days: ChangelogDay[] = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last && last.day === entry.day) last.entries.push(entry);
    else days.push({ day: entry.day, entries: [entry] });
  }
  return days;
}
