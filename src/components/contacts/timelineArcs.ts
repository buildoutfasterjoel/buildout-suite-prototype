import type { Contact, DealSummary } from "#/data/types";
import type { TimelineEvent } from "#/components/contacts/timeline";
import {
  assoc,
  createdEvent,
  daysSince,
  makeCtx,
  mk,
  OWNER,
  pick,
  type ArcCtx,
} from "#/components/contacts/timelineKit";
import { heroTimeline } from "#/components/contacts/timelineHeroes";

/** The broker's first name, for email sign-offs. */
const OWNER_FIRST = OWNER.name.split(" ")[0];

// ─────────────────────────────────────────────────────────────────────────────
// Stage-aware activity arcs.
//
// Every contact's synthesized feed is a *story arc* keyed on their derived
// lifecycle fields (relationship / side / dealStage) rather than one generic
// feed for everyone:
//
//   cold            → almost nothing. An empty timeline IS the cold story.
//   nurturing       → a few paced touches, months apart, ending on an open loop.
//   pitching        → a recent 2–3 week flurry racing toward a listing decision.
//   client·active   → won the pitch, then launch/tours/offers at weekly cadence.
//   client·UC       → the same arc pushed earlier + recent diligence beats.
//   past_client     → a compressed old arc, a close, and a warm check-in.
//
// Beats are slot-filled with the contact's real name/company/deal and pick
// among copy variants with a PRNG seeded from the contact id — deterministic
// per contact, but two same-stage contacts don't read identical.
//
// Date math: the newest human touch lands on `lastContactedAt` (the People
// table's "last contacted" agrees with the feed), and the arc's history is
// spread between that anchor and `createdAt` — arcs compress automatically
// for recently created contacts.
// ─────────────────────────────────────────────────────────────────────────────

/** Build the full synthesized feed for a contact. */
export function buildContactTimeline(
  c: Contact,
  deals: DealSummary[],
): TimelineEvent[] {
  const ctx = makeCtx(c, deals);
  const hero = heroTimeline(ctx);
  if (hero) return hero;

  switch (c.relationship) {
    case "cold":
      return coldArc(ctx);
    case "nurturing":
      return nurturingArc(ctx);
    case "pitching":
      return pitchingArc(ctx);
    case "client":
      return c.dealStage === "under_contract"
        ? underContractArc(ctx)
        : activeClientArc(ctx);
    case "past_client":
      return pastClientArc(ctx);
  }
}

// ── Date scaffolding ─────────────────────────────────────────────────────────

interface ArcClock {
  /** Days ago of the newest human touch. */
  anchor: number;
  /** Position an older beat: frac 0 = the anchor, 1 = contact creation. */
  back: (frac: number) => number;
}

function clockFor(ctx: ArcCtx): ArcClock {
  const created = daysSince(ctx.c.createdAt);
  const anchor = ctx.c.lastContactedAt
    ? daysSince(ctx.c.lastContactedAt)
    : Math.min(14, Math.max(1, created - 1));
  const span = Math.max(created - anchor, 2);
  return { anchor, back: (frac) => anchor + Math.round(frac * span) };
}

// ── Shared system beats ──────────────────────────────────────────────────────

/** Source-appropriate system rows near creation (enrichment / routing). */
function originBeats(ctx: ArcCtx): TimelineEvent[] {
  const createdDays = daysSince(ctx.c.createdAt);
  const out: TimelineEvent[] = [];
  if (ctx.c.source === "Public records") {
    out.push(
      mk(ctx, "change-log", Math.max(createdDays - 1, 0), {
        actor: { name: "Buildout" },
        title: "Record enriched",
        body: "Phone, email, and mailing address appended from public records",
        source: "automation",
      }),
    );
  }
  if (ctx.c.source === "Prospect by Buildout") {
    out.push(
      mk(ctx, "assignment", Math.max(createdDays - 1, 0), {
        actor: { name: "Routing" },
        title: `Assigned to ${ctx.c.assignedTo}`,
        body: "Owner · round-robin routing",
        source: "automation",
      }),
    );
  }
  return out;
}

/** A firm marketing blast — automation, not a personal touch. */
function marketingBeat(ctx: ArcCtx, days: number): TimelineEvent {
  const campaign = pick(ctx.rng, [
    "Q3 Retail Market Snapshot",
    "Cap Rate Watch: what traded this quarter",
    "New listings in your market",
    "Owner's Brief: leasing velocity update",
  ]);
  return mk(ctx, "marketing", days, {
    title: campaign,
    body: `Campaign sent to ${ctx.first}'s segment.`,
    badges: [
      { label: "Sent", tone: "sent" },
      ...(ctx.rng() > 0.4
        ? [{ label: "Opened", tone: "open" as const }]
        : []),
    ],
    source: "automation",
    visibility: "team",
  });
}

// ── Cold ─────────────────────────────────────────────────────────────────────

/**
 * Cold = untouched. Creation, maybe an enrichment row, maybe one firm blast.
 * Deliberately no calls/emails/notes — that absence is the point.
 */
function coldArc(ctx: ArcCtx): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (ctx.rng() > 0.55) {
    events.push(marketingBeat(ctx, Math.min(21, daysSince(ctx.c.createdAt))));
  }
  events.push(...originBeats(ctx), createdEvent(ctx));
  return events;
}

// ── Nurturing ────────────────────────────────────────────────────────────────

/** A few paced touches, months apart, always ending on an open loop. */
function nurturingArc(ctx: ArcCtx): TimelineEvent[] {
  const { anchor, back } = clockFor(ctx);
  const { rng, first } = ctx;
  const events: TimelineEvent[] = [];

  // First touch — a cold call that didn't go far.
  const firstCall = pick(rng, [
    {
      badge: "Left Voicemail",
      summary: [
        `Left a voicemail introducing myself and the recent sale activity around ${ctx.c.company}'s building.`,
      ],
      next: ["Try again Thursday morning", "Send the market one-pager first"],
    },
    {
      badge: null,
      summary: [
        `${first} picked up but was short on time — owns through ${ctx.c.company}, not thinking about a move this year.`,
        "Polite, not dismissive. Door is open.",
      ],
      next: ["Add to the quarterly touch list", "Send something useful, no ask"],
    },
  ]);
  events.push(
    mk(ctx, "call", back(0.85), {
      direction: "out",
      durationSecs: firstCall.badge ? 42 : 4 * 60 + 30,
      title: `Cold call to ${first}`,
      badges: firstCall.badge
        ? [{ label: firstCall.badge, tone: "reply" }]
        : undefined,
      blocks: [
        { kicker: "Call summary", items: firstCall.summary },
        { kicker: "Next steps", items: firstCall.next },
      ],
    }),
  );

  // A value-add follow-up email. Opened but unanswered, or a warm "not yet."
  const replied = rng() > 0.5;
  events.push(
    mk(ctx, "email", back(0.5), {
      direction: "out",
      subject: pick(rng, [
        "What your neighbors traded for",
        "Thought of you — two comps worth seeing",
        "No ask — just the market data I mentioned",
      ]),
      body: `Hi ${first} — no agenda here, just the recent trades near your building so you have real numbers on hand. Worth a quick read before your next loan conversation.`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open", meta: "1d after send" },
      ],
      reply: replied
        ? {
            replier: ctx.ref.name,
            delay: "2d after send",
            sentiment: "Warm · not ready yet",
            sentimentTone: "neutral",
            body: pick(rng, [
              "Appreciate you sending this over. We're not doing anything this year, but check back in the spring.",
              "Interesting numbers. Not the right time for us, but keep me on your list.",
            ]),
          }
        : undefined,
    }),
  );

  // The why-now note that keeps them on the board.
  events.push(
    mk(ctx, "note", back(0.25), {
      body: pick(rng, [
        `${first} isn't ready, but the math is moving — hold period is aging and rates aren't helping. Stay useful, stay patient.`,
        `Keep ${first} warm. ${ctx.c.company} has more property than attention — when they consolidate, we want the call.`,
        `${first} said "spring" — that's a real date, not a brush-off. Calendar it and bring new comps when it comes.`,
      ]),
      visibility: "private",
    }),
  );

  // Most recent touch lands on the anchor: a short warming call.
  events.push(
    mk(ctx, "call", anchor, {
      direction: "out",
      durationSecs: 7 * 60 + 12,
      title: `Check-in with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: pick(rng, [
            [
              "Warmer this time — asked what the building would actually fetch.",
              "No timeline yet, but the question matters.",
            ],
            [
              `Talked ${ctx.c.city} market for ten minutes. ${first} is watching a neighbor's listing closely.`,
            ],
          ]),
        },
        {
          kicker: "Next steps",
          items: ["Send an updated one-page BOV teaser", "Circle back in 3–4 weeks"],
        },
      ],
    }),
  );

  if (rng() > 0.4) {
    events.push(
      mk(ctx, "task", Math.max(anchor - 1, 0), {
        title: "Created task",
        body: `Follow up with ${first} — bring fresh comps`,
        source: "user",
      }),
    );
  }
  if (rng() > 0.5) {
    events.push(marketingBeat(ctx, back(0.65)));
  }

  events.push(...originBeats(ctx), createdEvent(ctx));
  return events;
}

// ── Pitching ─────────────────────────────────────────────────────────────────

/** A recent flurry racing toward a listing / representation decision. */
function pitchingArc(ctx: ArcCtx): TimelineEvent[] {
  const { anchor } = clockFor(ctx);
  const { rng, first, deal } = ctx;
  const seller = (ctx.c.side ?? "seller") === "seller";
  // The flurry: everything inside ~3 weeks ending at the anchor.
  const f = (offset: number) => anchor + offset;
  const dealName = deal?.name ?? "the property";
  const term = deal?.dealType === "Lease" ? "rate guidance" : "pricing";
  const events: TimelineEvent[] = [];

  // How it started — a buyer inquires; a seller takes the meeting.
  if (!seller && deal) {
    events.push(
      mk(ctx, "inquiry", f(16), {
        direction: "in",
        title: `Inquired about ${dealName}`,
        body: "Requested the offering memorandum and current availability.",
        sourceTag: pick(rng, ["LoopNet", "Buildout site", "Crexi"]),
        associations: assoc(deal),
        source: "api",
      }),
    );
  }

  // Discovery call — long, warm, and specific.
  events.push(
    mk(ctx, "call", f(14), {
      direction: "out",
      durationSecs: 28 * 60 + 40,
      title: `Discovery call with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: seller
            ? pick(rng, [
                [
                  `${first} is testing the market on ${dealName} — wants the ${term} case before committing to list.`,
                  "Decision sits with them alone; no partners to convince.",
                ],
                [
                  `Long talk on ${dealName}. ${first} has real motivation but wants proof we can run a quiet process.`,
                  "Competing broker already pitched — we need to out-prepare, not out-promise.",
                ],
              ])
            : pick(rng, [
                [
                  `${first} is actively searching — clear requirement, real capital, wants ${ctx.c.city} first.`,
                  "Timeline: wants to be in diligence inside 90 days.",
                ],
                [
                  `Walked ${first}'s acquisition criteria. Disciplined buyer — will move fast for the right basis.`,
                ],
              ]),
        },
        {
          kicker: "Next steps",
          items: seller
            ? [`Build the ${term} analysis on ${dealName}`, "Send engagement terms"]
            : ["Curate the first candidate set", "Confirm proof of funds"],
        },
      ],
      associations: assoc(deal),
    }),
  );

  // The pitch artifact — BOV for sellers, curated set for buyers.
  events.push(
    mk(ctx, "email", f(10), {
      direction: "out",
      subject: seller
        ? `${dealName}: pricing analysis (BOV)`
        : `${first} — first candidate set (${ctx.deals.length || 3} properties)`,
      body: seller
        ? `${first},\n\nAttached is the ${term} analysis for ${dealName}, anchored to the three most recent trades nearby. Happy to walk through the assumptions whenever suits.\n\n${OWNER_FIRST}`
        : `${first},\n\nHere's the opening set matched to your criteria. Two are on-market, one is a quiet opportunity I can get us into early. My notes on each are attached.\n\n${OWNER_FIRST}`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open", meta: "3h after send" },
        { label: "Clicked", tone: "click" },
      ],
      reply: {
        replier: ctx.ref.name,
        delay: "1d after send",
        sentiment: "Positive · engaged",
        sentimentTone: "positive",
        body: seller
          ? "This is more rigorous than what the other group showed me. Let's talk through the assumptions."
          : "Two of these are worth a closer look. When can we walk them?",
      },
      hasAttachment: true,
      associations: assoc(deal),
    }),
  );

  // The in-person beat.
  events.push(
    seller
      ? mk(ctx, "meeting", f(6), {
          durationSecs: 55 * 60,
          title: `Walkthrough at ${dealName}`,
          blocks: [
            {
              items: [
                `Walked the property with ${first}; talked process, timeline, and the quiet-launch plan.`,
                "They're choosing between us and one other shop this week.",
              ],
            },
          ],
          associations: assoc(deal),
        })
      : mk(ctx, "tour", f(6), {
          title: `Toured ${dealName} with ${first}`,
          blocks: [
            {
              items: [
                "Strong reaction to the location; wants the rent roll before going further.",
                "Interest: high.",
              ],
            },
          ],
          associations: assoc(deal),
        }),
  );

  // What actually wins this — private read on the decision.
  events.push(
    mk(ctx, "note", f(4), {
      body: seller
        ? pick(rng, [
            `${first} decides on rigor, not relationships. Win the engagement with the numbers and a tight process plan.`,
            `${first} cares most about discretion — no broad blast until they say so. Lead the proposal with the quiet pre-market plan.`,
          ])
        : pick(rng, [
            `${first} is comparing us against going direct. Prove value with off-market access, not just showings.`,
            `Speed matters more than polish here — ${first} will sign with whoever gets them into diligence first.`,
          ]),
      visibility: "private",
    }),
  );

  // Where it stands now — the open loop at the anchor.
  events.push(
    mk(ctx, "call", f(0), {
      direction: "out",
      durationSecs: 11 * 60 + 5,
      title: `Follow-up with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: [
            seller
              ? "Wants the weekend to decide. Down to us and one other firm."
              : "Ready to move if the numbers hold — reviewing the package with their lender.",
          ],
        },
        {
          kicker: "Next steps",
          items: seller
            ? ["Send the engagement agreement so it's ready to sign", "Call Monday 9am"]
            : ["Send rent roll + expense history", "Hold Thursday for a second tour"],
        },
      ],
      associations: assoc(deal),
    }),
  );

  events.push(
    mk(ctx, "stage-change", f(15), {
      title: "Stage changed",
      body: "Nurturing → Pitching",
      source: "user",
    }),
  );

  events.push(...originBeats(ctx), createdEvent(ctx));
  return events;
}

// ── Client (active deal) ─────────────────────────────────────────────────────

/** Won the business; the deal is live. Launch, tours, offers, weekly cadence. */
function activeClientArc(ctx: ArcCtx): TimelineEvent[] {
  const { anchor, back } = clockFor(ctx);
  const { rng, first, deal } = ctx;
  const seller = (ctx.c.side ?? "seller") === "seller";
  const dealName = deal?.name ?? "the property";
  const events: TimelineEvent[] = [];

  // Winning the business (older beats).
  events.push(
    mk(ctx, "stage-change", back(0.8), {
      title: "Stage changed",
      body: "Pitching → Client",
      source: "user",
    }),
    mk(ctx, "email", back(0.78), {
      direction: "out",
      subject: seller
        ? `${dealName}: signed agreement + launch plan`
        : `Representation confirmed — search plan for ${first}`,
      body: seller
        ? `${first},\n\nCountersigned agreement attached. Launch plan: quiet pre-market to the vetted list first, broad only if we need it. Weekly status every Friday.\n\n${OWNER_FIRST}`
        : `${first},\n\nGreat to be officially on your side of the table. Search plan attached — targets, outreach order, and the weekly cadence.\n\n${OWNER_FIRST}`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open" },
      ],
      hasAttachment: true,
      associations: assoc(deal),
    }),
  );

  if (seller) {
    // OM approval → launch → tour traffic.
    events.push(
      mk(ctx, "call", back(0.6), {
        direction: "out",
        durationSecs: 17 * 60 + 20,
        title: `OM review with ${first}`,
        blocks: [
          {
            kicker: "Call summary",
            items: [
              `Walked the OM page by page — ${first} signed off with two edits.`,
              "Green light to open the quiet pre-market.",
            ],
          },
          { kicker: "Next steps", items: ["Send to the vetted buyer list", "Report interest as it lands"] },
        ],
        associations: assoc(deal),
      }),
      mk(ctx, "marketing", back(0.5), {
        title: `${dealName} — pre-market send`,
        body: "OM sent to the vetted buyer list under CA.",
        badges: [
          { label: "Sent", tone: "sent" },
          { label: "Opened", tone: "open", meta: "8 of 11" },
        ],
        source: "automation",
        associations: assoc(deal),
      }),
      mk(ctx, "tour", back(0.35), {
        title: `Buyer tours at ${dealName}`,
        blocks: [
          {
            items: [
              "Three tours this week off the pre-market list — two serious.",
              `Debriefed ${first} same-day after each.`,
            ],
          },
        ],
        associations: assoc(deal),
      }),
    );
  } else {
    // How the search began — the inquiry that started it, then curated set →
    // tours → side-by-side.
    if (deal) {
      events.push(
        mk(ctx, "inquiry", back(0.7), {
          direction: "in",
          title: `Inquired about ${dealName}`,
          body: "Requested the offering memorandum and current availability.",
          sourceTag: pick(rng, ["LoopNet", "Buildout site", "Crexi"]),
          associations: assoc(deal),
          source: "api",
        }),
      );
    }
    events.push(
      mk(ctx, "email", back(0.6), {
        direction: "out",
        subject: "This week's candidates — my notes attached",
        body: `${first},\n\nFour new candidates this week; two clear your criteria on the first pass. Notes and numbers attached — let's tour the top two.\n\n${OWNER_FIRST}`,
        badges: [
          { label: "Sent", tone: "sent" },
          { label: "Opened", tone: "open" },
          { label: "Clicked", tone: "click" },
        ],
        hasAttachment: true,
      }),
      mk(ctx, "tour", back(0.45), {
        title: `Toured ${dealName} with ${first}`,
        blocks: [
          {
            items: [
              "Best fit so far — layout works without capital in year one.",
              "Wants financials before moving.",
            ],
          },
        ],
        associations: assoc(deal),
      }),
      mk(ctx, "email", back(0.35), {
        direction: "out",
        subject: "Side-by-side: the two front-runners",
        body: `${first},\n\nSide-by-side attached — in-place income, basis, and my read on each seller's flexibility. Both pencil; one is the safer hold, the other has the upside.\n\n${OWNER_FIRST}`,
        badges: [
          { label: "Sent", tone: "sent" },
          { label: "Opened", tone: "open", meta: "1h after send" },
        ],
        hasAttachment: true,
        associations: assoc(deal),
      }),
    );
  }

  // The live negotiation thread — latest message is theirs, awaiting our reply.
  const threadId = `thr-${ctx.c.id}`;
  const outMsg = seller
    ? `First written offer is in. Summary attached — my rec is to counter and let the second group flush out. Call when you've read it.`
    : `Spoke with the listing broker — there's room on price if we move this week. My suggested opening number is attached.`;
  const inMsg = seller
    ? "Read it twice. I'm fine countering — but I want to talk through the backup plan first. Call me tomorrow?"
    : "Numbers work for me. Let's put it in writing — what do you need from me to move today?";
  events.push(
    mk(ctx, "conversation", back(0.1), {
      subject: seller ? `${dealName}: offer strategy` : `${dealName}: making our move`,
      thread: {
        count: 2,
        latestSender: ctx.ref.name,
        latestBody: inMsg,
        messages: [
          {
            id: `${threadId}-m1`,
            direction: "out",
            sender: OWNER.name,
            timestamp: ctx.at(back(0.15)),
            body: outMsg,
          },
          {
            id: `${threadId}-m2`,
            direction: "in",
            sender: ctx.ref.name,
            timestamp: ctx.at(back(0.1)),
            body: inMsg,
          },
        ],
      },
      threadId,
      associations: assoc(deal),
    }),
    mk(ctx, "email", back(0.15), {
      direction: "out",
      subject: seller ? `${dealName}: offer strategy` : `${dealName}: making our move`,
      body: outMsg,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open" },
      ],
      threadId,
      messageId: `${threadId}-m1`,
      hasAttachment: true,
      associations: assoc(deal),
    }),
    mk(ctx, "inbound-email", back(0.1), {
      direction: "in",
      subject: seller ? `Re: ${dealName}: offer strategy` : `Re: ${dealName}: making our move`,
      body: inMsg,
      badges: [{ label: "New", tone: "reply" }],
      threadId,
      messageId: `${threadId}-m2`,
      inReplyTo: `${threadId}-m1`,
    }),
  );

  // Weekly cadence call at the anchor.
  events.push(
    mk(ctx, "call", anchor, {
      direction: "out",
      durationSecs: 14 * 60 + 45,
      title: `Weekly status with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: seller
            ? ["Two parties active; one drafting an offer now.", "Holding pricing discipline — no reason to blink first."]
            : ["Aligned on the number and terms.", `${first} is ready to sign the LOI this week.`],
        },
        {
          kicker: "Next steps",
          items: seller
            ? ["Circulate the offer summary the moment it lands", "Keep the second group warm"]
            : ["Draft the LOI", "Confirm lender timeline"],
        },
      ],
      associations: assoc(deal),
    }),
  );

  if (rng() > 0.5) {
    events.push(
      mk(ctx, "task", back(0.3), {
        title: "Completed task",
        body: seller ? "Assemble diligence data room" : "Collect proof of funds",
        badges: [{ label: "Done", tone: "activity" }],
        source: "user",
      }),
    );
  }

  events.push(...originBeats(ctx), createdEvent(ctx));
  return events;
}

// ── Client (under contract) ──────────────────────────────────────────────────

/** In diligence — the arc above pushed earlier, recent beats are execution. */
function underContractArc(ctx: ArcCtx): TimelineEvent[] {
  const { anchor, back } = clockFor(ctx);
  const { rng, first, deal } = ctx;
  const seller = (ctx.c.side ?? "seller") === "seller";
  const dealName = deal?.name ?? "the property";
  const events: TimelineEvent[] = [];

  // Compressed history of how we got here.
  events.push(
    mk(ctx, "stage-change", back(0.85), {
      title: "Stage changed",
      body: "Pitching → Client",
      source: "user",
    }),
    mk(ctx, "email", back(0.7), {
      direction: "out",
      subject: seller ? `${dealName}: launch recap` : `${dealName}: our offer is in`,
      body: seller
        ? `${first},\n\nPre-market recap attached: strong early interest, tours starting this week. Weekly status every Friday, as promised.\n\n${OWNER_FIRST}`
        : `${first},\n\nOffer submitted as discussed. I'll press for an answer inside 48 hours and keep the backup candidate warm in the meantime.\n\n${OWNER_FIRST}`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open" },
      ],
      hasAttachment: true,
      associations: assoc(deal),
    }),
    mk(ctx, "call", back(0.5), {
      direction: "out",
      durationSecs: 21 * 60 + 10,
      title: `Offer review with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: seller
            ? ["Accepted the stronger offer — certainty over the marginal bump.", "Terms agreed in principle."]
            : ["Seller countered light; we accepted.", "Deal agreed — moving to paper."],
        },
        { kicker: "Next steps", items: ["Open escrow", "Lock the diligence schedule"] },
      ],
      associations: assoc(deal),
    }),
    mk(ctx, "stage-change", back(0.4), {
      title: "Deal stage changed",
      body: "Active → Under contract",
      source: "user",
      associations: assoc(deal),
    }),
  );

  // Recent diligence beats.
  events.push(
    mk(ctx, "call", back(0.2), {
      direction: "out",
      durationSecs: 12 * 60 + 30,
      title: `Diligence check-in with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: [
            "Inspection done — nothing structural, two small credits to negotiate.",
            "Appraisal ordered; back within two weeks.",
          ],
        },
        { kicker: "Next steps", items: ["Circulate the inspection summary", "Chase the estoppels"] },
      ],
      associations: assoc(deal),
    }),
    mk(ctx, "note", back(0.12), {
      body: pick(rng, [
        `Appraisal is the last real gate. If it lands at value, we're clear to close on schedule — ${first} knows the plan either way.`,
        `${first} is calm but watching the calendar. Over-communicate through diligence — a Friday summary even when nothing moved.`,
      ]),
      visibility: "private",
    }),
    mk(ctx, "call", anchor, {
      direction: "out",
      durationSecs: 8 * 60 + 55,
      title: `Weekly diligence status with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: [
            "All contingency dates on track.",
            "Title clean; closing checklist started.",
          ],
        },
        {
          kicker: "Next steps",
          items: ["Confirm appraisal delivery date", "Draft the closing timeline"],
        },
      ],
      associations: assoc(deal),
    }),
  );

  if (rng() > 0.4) {
    events.push(
      mk(ctx, "task", Math.max(anchor - 1, 0), {
        title: "Created task",
        body: "Confirm estoppel returns with tenant counsel",
        source: "user",
      }),
    );
  }

  events.push(...originBeats(ctx), createdEvent(ctx));
  return events;
}

// ── Past client ──────────────────────────────────────────────────────────────

/** Closed business. An old compressed arc, the close, and a warm check-in. */
function pastClientArc(ctx: ArcCtx): TimelineEvent[] {
  const { anchor, back } = clockFor(ctx);
  const { rng, first, deal } = ctx;
  const dealName = deal?.name ?? "the deal";
  const events: TimelineEvent[] = [];

  // The compressed history — how the deal ran.
  events.push(
    mk(ctx, "call", back(0.9), {
      direction: "out",
      durationSecs: 26 * 60,
      title: `Discovery call with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: [
            `First real conversation on ${dealName} — clear goals, realistic on pricing.`,
          ],
        },
      ],
      associations: assoc(deal),
    }),
    mk(ctx, "email", back(0.75), {
      direction: "out",
      subject: `${dealName}: proposal + process plan`,
      body: `${first},\n\nProposal attached — pricing case, buyer pool, and the week-by-week plan.\n\n${OWNER_FIRST}`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open" },
      ],
      hasAttachment: true,
      associations: assoc(deal),
    }),
    mk(ctx, "meeting", back(0.6), {
      durationSecs: 45 * 60,
      title: `Terms meeting with ${first}`,
      blocks: [
        { items: ["Signed. Launch plan agreed — quiet first, broad if needed."] },
      ],
      associations: assoc(deal),
    }),
    mk(ctx, "call", back(0.45), {
      direction: "out",
      durationSecs: 18 * 60 + 25,
      title: `Offer review with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: ["Two offers on the table; took the cleaner terms.", "Under contract shortly after."],
        },
      ],
      associations: assoc(deal),
    }),
    mk(ctx, "stage-change", back(0.3), {
      title: "Deal stage changed",
      body: "Under contract → Closed",
      source: "user",
      associations: assoc(deal),
    }),
    mk(ctx, "email", back(0.28), {
      direction: "out",
      subject: `Closed — ${dealName} recap`,
      body: `${first},\n\nClosed and funded. Full recap attached, including what this sets as the comp for the rest of your holdings.\n\nA genuinely well-run process on your side. Whenever the next one is ready, I'd be glad to do it again.\n\n${OWNER_FIRST}`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open" },
      ],
      reply: {
        replier: ctx.ref.name,
        delay: "3h after send",
        sentiment: "Positive · repeat intent",
        sentimentTone: "positive",
        body: pick(rng, [
          "Couldn't have asked for a cleaner close. You'll hear from me on the next one.",
          "Great process start to finish. I've already passed your name along.",
        ]),
      },
      hasAttachment: true,
      associations: assoc(deal),
    }),
  );

  // The relationship continues — recent warm beats.
  events.push(
    mk(ctx, "call", anchor, {
      direction: "out",
      durationSecs: 12 * 60 + 40,
      title: `Post-close check-in with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: pick(rng, [
            [
              "All settled post-close; no loose ends.",
              `${first} hinted at another asset coming up for a decision next year.`,
            ],
            [
              `${first} is happy — and offered an intro to a peer who's weighing a sale.`,
            ],
          ]),
        },
        {
          kicker: "Next steps",
          items: ["Calendar a Q4 prep call", "Send the market one-pager for the next asset"],
        },
      ],
    }),
    mk(ctx, "note", Math.max(anchor - 1, 0), {
      body: `Past client, warm. The next deal here is real — stay in a useful cadence, not a salesy one.`,
      visibility: "private",
    }),
  );

  events.push(...originBeats(ctx), createdEvent(ctx));
  return events;
}
