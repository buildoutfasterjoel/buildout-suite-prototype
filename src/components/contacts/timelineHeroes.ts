import type { TimelineEvent } from "#/components/contacts/timeline";
import {
  assoc,
  createdEvent,
  mk,
  stageChanged,
  OWNER,
  type ArcCtx,
} from "#/components/contacts/timelineKit";

// ─────────────────────────────────────────────────────────────────────────────
// Hero arcs — fully hand-authored activity feeds for the five demo personas
// pinned in the seed (see `applyHeroes` in seed.ts). One per lifecycle stage:
//
//   rosa      Nurturing            — widowed owner; earning the right to talk
//   earl      Pitching · seller    — 1979 owner; preservation over top dollar
//   victor    Client · active      — numbers-first seller; offers landing now
//   margaret  Client · UC · buyer  — out-of-state 1031; diligence underway
//   patricia  Past client          — institutional REIT; close → next two deals
//
// The seed pins each hero's `createdAt` / `lastContactedAt` to match these
// hand-picked beat dates, so the People table, briefing, and feed all agree.
// ─────────────────────────────────────────────────────────────────────────────

const ME = OWNER.name.split(" ")[0];

/** The hand-authored feed for a hero contact, or null for everyone else. */
export function heroTimeline(ctx: ArcCtx): TimelineEvent[] | null {
  switch (ctx.c.heroKey) {
    case "rosa":
      return rosa(ctx);
    case "earl":
      return earl(ctx);
    case "victor":
      return victor(ctx);
    case "margaret":
      return margaret(ctx);
    case "patricia":
      return patricia(ctx);
    default:
      return null;
  }
}

// ── Rosa Delgado — Nurturing ─────────────────────────────────────────────────
// Her late husband and she bought the building as their first joint
// investment. A refi balloon is building quiet pressure, but pushing now
// would lose her forever. The arc is patience, deliberately.

function rosa(ctx: ArcCtx): TimelineEvent[] {
  return [
    // She's initiating now — the arc's payoff, and it needs a call back.
    mk(ctx, "inbound-call", 1, {
      direction: "in",
      title: "Missed call",
      attempted: true,
      blocks: [
        {
          clamp: true,
          items: [
            '"Hi, it\'s Rosa. I was going through Miguel\'s papers this weekend and found the loan documents — the ones with the balloon date we talked about. I think… I think I\'d like to understand my options. Nothing decided. Call me when you have a quiet minute, no rush."',
          ],
        },
      ],
    }),
    mk(ctx, "call", 8, {
      direction: "out",
      durationSecs: 18 * 60 + 40,
      title: "Check-in with Rosa",
      blocks: [
        {
          items: [
            "Warmest call yet — she asked, unprompted, what an operator buyer might actually pay.",
            "Not a decision, but it's the first time she's asked a forward-looking question.",
          ],
        },
        {
          items: [
            "Prepare a quiet, no-pressure BOV — hold it until she asks again",
            "Circle back in about three weeks",
          ],
        },
      ],
    }),
    mk(ctx, "note", 45, {
      body: 'She said "next spring, maybe." From Rosa that\'s not a brush-off — it\'s a plan forming. Do not bring a contract to the next call.',
      visibility: "private",
    }),
    mk(ctx, "email", 52, {
      direction: "out",
      subject: "The piece on your block I mentioned",
      body: `Rosa,\n\nHere's the article on the neighborhood's little renaissance I mentioned — your corner gets a paragraph of its own. No business in this email; I just thought you'd want to see it.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "1d after send",
        sentiment: "Warm · not ready",
        sentimentTone: "positive",
        body: "This means more than you know. Miguel would have framed it. I'm still not ready to talk about selling — but I'm glad it would be you when I am.",
      },
    }),
    mk(ctx, "call", 96, {
      direction: "out",
      durationSecs: 22 * 60 + 4,
      title: "Call with Rosa",
      blocks: [
        {
          items: [
            "She opened up — the refi balloon hits August 2027, and the stress is real but she has runway.",
            "If she ever sells, the buyer has to \"get it\": an operator who keeps the building, not a flipper.",
          ],
        },
        {
          items: ["Start a quiet operator-profile buyer list — no timeline, no pressure"],
        },
      ],
    }),
    mk(ctx, "note", 150, {
      body: "No ask on the first call and none for a while. The building was theirs together — this is grief with a property attached. Earn the right to the conversation.",
      visibility: "private",
    }),
    mk(ctx, "call", 151, {
      direction: "out",
      durationSecs: 9 * 60 + 30,
      title: "First call with Rosa",
      blocks: [
        {
          items: [
            "Guarded. She lost her husband last year — the building was their first joint investment.",
            "Not ready to talk selling. I didn't push. Just listened.",
          ],
        },
        {
          items: ["No ask. Circle back in a few weeks."],
        },
      ],
    }),
    createdEvent(ctx),
  ];
}

// ── Earl Pettigrew — Pitching (seller) ───────────────────────────────────────
// Owned his storefront since 1979. His late wife painted it in '92 and the
// painting still hangs in his living room. He'll list with whoever proves
// they'll find a buyer who preserves the facade — this week.

function earl(ctx: ArcCtx): TimelineEvent[] {
  const dealName = ctx.deal?.name ?? "the storefront";
  return [
    // The decision is this week — his last question is sitting in the inbox.
    mk(ctx, "inbound-email", 1, {
      direction: "in",
      subject: "One question before Friday",
      body: "I read the easement material twice and I'm nearly there. One thing I can't square: if the easement lowers the buyer's basis, does it tie their hands on interior work too? Dorothy's mural in the stairwell — I need to know it's protected. Answer me that and I'll sign Friday.",
      hasAttachment: false,
    }),
    mk(ctx, "call", 2, {
      direction: "out",
      durationSecs: 14 * 60 + 50,
      title: "Follow-up with Earl",
      blocks: [
        {
          items: [
            "One open question stands between us and the signature: whether a preservation easement could lower a buyer's basis.",
            "He's talking to us and his nephew's broker friend. He said, kindly, that we're ahead.",
          ],
        },
        {
          items: [
            "Get the preservation-easement consult scheduled this week",
            "Have the engagement agreement ready to sign",
          ],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "note", 6, {
      body: "We are NOT optimizing for top dollar on this one — we're optimizing for the right buyer. If Earl leaves the table feeling good, he refers the next three owners on the block.",
      visibility: "private",
    }),
    mk(ctx, "meeting", 8, {
      durationSecs: 65 * 60,
      title: `Walkthrough at ${dealName}`,
      blocks: [
        {
          items: [
            "Two hours in the building — he narrated forty years of it, floor by floor.",
            "Talked the quiet-launch plan: preservation-minded buyers first, no broad blast unless he says so.",
          ],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "email", 12, {
      direction: "out",
      subject: "The building's story, on paper",
      body: `Earl,\n\nAttached is the historical piece I mentioned — the block's arc from the 1890s through the preservation overlay. I want to lead the marketing with this story, not bury it. A buyer who pays a premium for that lineage is exactly the buyer you want holding the keys.\n\nWalk me through your thoughts Wednesday.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "1d after send",
        sentiment: "Positive · emotionally engaged",
        sentimentTone: "positive",
        body: "This is exactly right. Dorothy's painting of the storefront is hanging behind me as I read it. Whoever buys this place needs to feel that. Wednesday works.",
      },
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 18, {
      direction: "out",
      durationSecs: 35 * 60 + 12,
      title: "First call with Earl",
      blocks: [
        {
          items: [
            "Owned the building since 1979 — the emotional attachment is real, and it's the whole negotiation.",
            "His wife painted the storefront in '92; the painting hangs in his living room.",
            "Open to selling, but only to a buyer who commits to preserving the facade.",
            "Historic-district review is strict here — any exterior change needs board sign-off.",
          ],
        },
        {
          items: [
            "Research preservation-easement options",
            "Sketch the preservation-minded buyer profile (boutique hotel? heritage retailer?)",
          ],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    stageChanged(ctx, 19, "nurturing", "pitching"),
    createdEvent(ctx),
  ];
}

// ── Victor Osei — Client · active (seller) ───────────────────────────────────
// A numbers guy, not a story guy. Won the listing off a BOV anchored to his
// own comp sale two blocks away. Signed-leases-only pro forma, quiet launch,
// and now the first offers are landing.

/**
 * Victor's offer-strategy thread, oldest message first.
 *
 * This is the app's reference example of a deep email thread, so it's built to
 * exercise the real shape rather than the minimum: several turns, both
 * directions, and a same-sender pair (message 5 is Victor firing off a second
 * thought minutes after the first). The thread ends on an inbound message,
 * which is what keeps the row in its "awaiting a reply" attention state — and
 * it lands before the day-1 call, where he finally signs off.
 *
 * `attach` marks a message that carried a file.
 */
const VICTOR_THREAD: {
  day: number;
  hour: number;
  min: number;
  direction: "out" | "in";
  body: string;
  attach?: boolean;
}[] = [
  {
    day: 22,
    hour: 9,
    min: 5,
    direction: "out",
    attach: true,
    body: "Victor — first written offer is in at 97% of ask, all cash, 30-day close, from one of the vetted buyers we toured. A second group is drafting now. My rec: counter at ask and let the second offer flush out. Terms attached.",
  },
  {
    day: 21,
    hour: 7,
    min: 40,
    direction: "in",
    body: "Read it twice. Counter at ask — we have the leverage and the second buyer knows it. But I want the fallback math on paper before we send: what does day 60 look like if both walk? Send me that and it's a go.",
  },
  {
    day: 20,
    hour: 16,
    min: 25,
    direction: "out",
    attach: true,
    body: "Fallback math attached — day 60 with both parties gone. Carry is $41k/month, we'd re-launch broad in mid-September into a thinner buyer pool, and my honest read is we land 93–95% of ask on that path. Countering at ask risks about two points to protect four.",
  },
  {
    day: 19,
    hour: 8,
    min: 12,
    direction: "in",
    body: "Model's structurally right. One correction: you used 6.1% on the refi and my last two quotes came in at 6.45%. Re-run it — if the day-60 number still clears 93% I'm comfortable.",
  },
  {
    day: 19,
    hour: 8,
    min: 31,
    direction: "in",
    body: "Also — hold the counter until the second group's draft is actually in my hands. I'm not bidding against a buyer who hasn't put anything in writing yet.",
  },
  {
    day: 17,
    hour: 11,
    min: 50,
    direction: "out",
    attach: true,
    body: "Re-run at 6.45% attached — day 60 comes in at 93.4%, so the case holds. And agreed on sequencing: the counter sits until their draft is in writing. I'll tell their broker we're reviewing, nothing more.",
  },
  {
    day: 14,
    hour: 7,
    min: 15,
    direction: "in",
    body: "Good. That's the number I needed to see. Send the counter at ask the moment their draft lands — I'll sign off on our next call, but don't wait on me to get it drafted.",
  },
];

function victor(ctx: ArcCtx): TimelineEvent[] {
  const dealName = ctx.deal?.name ?? "the property";
  const threadId = `thr-${ctx.c.id}`;
  const subject = `${dealName}: offer strategy`;
  // One source for the thread and its member rows, so the "View full thread (N)"
  // count and the individual emails under the Emails filter can't drift apart.
  const messages = VICTOR_THREAD.map((m, i) => ({
    id: `${threadId}-m${i + 1}`,
    direction: m.direction,
    sender: m.direction === "out" ? OWNER.name : ctx.ref.name,
    timestamp: ctx.at(m.day, m.hour, m.min),
    body: m.body,
  }));
  const latest = messages[messages.length - 1];
  const newest = VICTOR_THREAD[VICTOR_THREAD.length - 1];
  return [
    // Fresh heat on top of the thread — a numbers guy, annoyed, wanting a call.
    mk(ctx, "inbound-email", 0, {
      direction: "in",
      subject: "The second buyer's broker called me directly",
      body: "Twenty minutes ago, on my cell. I didn't engage and I didn't like it. Two things before end of day: how did they get my number, and does this change the counter math? Call me.",
    }),
    mk(ctx, "call", 1, {
      direction: "out",
      durationSecs: 16 * 60 + 22,
      title: "Weekly status with Victor",
      blocks: [
        {
          items: [
            "Second buyer confirmed they're drafting — two live parties, exactly the position we wanted.",
            "He re-ran my fallback math himself overnight and got the same answer. Counter goes out after his sign-off.",
          ],
        },
        {
          items: ["Send the counter at ask", "Keep the second group's tour feedback warm"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    // The collapsed thread row, dated to its newest message so it sorts where
    // the conversation actually stands.
    mk(ctx, "conversation", newest.day, {
      subject,
      thread: {
        latestSender: latest.sender,
        latestBody: latest.body,
        messages,
      },
      threadId,
      associations: assoc(ctx.deal),
    }),
    // Each message also as its own row. Hidden under the "All" filter (the
    // conversation row stands in for them) and shown under "Emails".
    ...VICTOR_THREAD.map((m, i) =>
      mk(ctx, m.direction === "out" ? "email" : "inbound-email", m.day, {
        direction: m.direction,
        subject: i === 0 ? subject : `Re: ${subject}`,
        body: m.body,
        threadId,
        messageId: messages[i].id,
        inReplyTo: i > 0 ? messages[i - 1].id : undefined,
        hasAttachment: m.attach,
        associations: m.direction === "out" ? assoc(ctx.deal) : undefined,
      }),
    ),
    mk(ctx, "task", 20, {
      title: "Task completed",
      body: "Assemble the diligence data room — leases, T12, service contracts",
      source: "user",
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "tour", 33, {
      title: `Buyer tours at ${dealName}`,
      blocks: [
        {
          items: [
            "Three tours off the quiet list this week — two serious, one stalking-horse.",
            "Debriefed Victor same-day after each; he wants tour notes in writing. Done.",
          ],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "marketing", 45, {
      title: `${dealName} — pre-market send`,
      body: "OM sent to the ten vetted buyers under CA. No broad launch — per Victor's instruction.",
      source: "automation",
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 52, {
      direction: "out",
      durationSecs: 19 * 60 + 8,
      title: "OM review with Victor",
      blocks: [
        {
          items: [
            "OM approved — leads with the in-place cap rate, no vision section. His words: \"finally, a broker who can read a rent roll.\"",
            "Green light on the quiet launch to the vetted list.",
          ],
        },
        {
          items: ["Open the pre-market", "Report interest as it lands, in writing"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "email", 60, {
      direction: "out",
      subject: `${dealName}: listing agreement + OM draft`,
      body: `Victor,\n\nListing agreement and OM draft attached. Pro forma is signed leases only — no projected escalations, exactly as you asked. Quiet pre-market to ten vetted buyers first; broad launch only if we need it. Your call at each step.\n\n${ME}`,
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    stageChanged(ctx, 62, "pitching", "client"),
    mk(ctx, "email", 70, {
      direction: "out",
      subject: `${dealName}: pricing analysis (BOV)`,
      body: `Victor,\n\nBOV attached — anchored to your own sale two blocks over plus the two most recent trades in the submarket. The ask I'd take to market pencils on in-place income with zero projected escalations. That's the defensible number.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "4h after send",
        sentiment: "Positive · convinced by rigor",
        sentimentTone: "positive",
        body: "This is more rigorous than the other two proposals combined. Proceed.",
      },
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 75, {
      direction: "out",
      durationSecs: 24 * 60 + 38,
      title: "Discovery call with Victor",
      blocks: [
        {
          items: [
            "Testing the market while cap rates hold — he sold his own comp two blocks away last year, so he knows this submarket cold.",
            "A numbers guy, not a story guy. He wants the pricing case before committing to list.",
          ],
        },
        {
          items: ["Build the BOV anchored to his own comp"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    createdEvent(ctx),
  ];
}

// ── Margaret Kwan — Client · under contract (buyer) ──────────────────────────
// Out-of-state heir who 1031'd the family estate; the identification deadline
// ran the whole search. Never toured in person — proxy video tours, same-day.
// Now in diligence: appraisal due Friday.

function margaret(ctx: ArcCtx): TimelineEvent[] {
  const dealName = ctx.deal?.name ?? "the property";
  return [
    // The appraisal is due — she asked first. Precise as ever, needs a reply.
    mk(ctx, "inbound-email", 1, {
      direction: "in",
      subject: "Appraisal — confirming Friday",
      body: "Confirming the appraisal still lands Friday. My CPA is holding time Friday afternoon to review it, and I'd rather not reschedule him. If the date has moved, I want to know today — you've earned the benefit of the doubt, so just tell me straight.",
    }),
    mk(ctx, "call", 2, {
      direction: "out",
      durationSecs: 9 * 60 + 45,
      title: "Diligence status with Margaret",
      blocks: [
        {
          items: [
            "Appraisal lands Friday — the last real gate. Financing is otherwise clear.",
            "She thanked me for the weekly written summaries: \"I never once had to ask what was happening.\"",
          ],
        },
        {
          items: ["Send the appraisal the hour it arrives", "Confirm the closing date with title"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "note", 8, {
      body: "Appraisal is the last gate. Her CPA re-runs every number we send — keep the exhibits clean and never round in our favor. Trust here was built on arithmetic.",
      visibility: "private",
    }),
    mk(ctx, "call", 12, {
      direction: "out",
      durationSecs: 13 * 60 + 30,
      title: "Diligence check-in with Margaret",
      blocks: [
        {
          items: [
            "Inspection came back clean — nothing structural, two small credits worth requesting.",
            "She approved requesting both credits without a second call. Decisions in minutes, always.",
          ],
        },
        {
          items: ["Submit the credit request", "Order the appraisal"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "stage-change", 24, {
      title: "Deal stage changed",
      body: "Active → Under contract",
      source: "user",
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 30, {
      direction: "out",
      durationSecs: 21 * 60 + 15,
      title: "Identification call with Margaret",
      blocks: [
        {
          items: [
            `Locked the 1031 identification list: ${dealName} as primary, two backups held open.`,
            "Offer accepted the same week — her clock stops being the enemy the day we're under contract.",
          ],
        },
        {
          items: ["Open escrow", "Build the diligence calendar around her deadline"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "email", 40, {
      direction: "out",
      subject: "Side-by-side: the two front-runners",
      body: `Margaret,\n\nSide-by-side attached — in-place income, basis, and execution risk on both. The primary is turnkey with the stronger NOI; the backup is a lower basis with more work. Both clear your return target and both fit the exchange window.\n\nReview with your CPA and tell me which way you lean.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "1d after send",
        sentiment: "Positive · deciding",
        sentimentTone: "positive",
        body: "CPA agrees with your read. I'm leaning primary. Lock the backups into the identification anyway — I didn't inherit this money by being careless.",
      },
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "tour", 55, {
      title: `Proxy tour of ${dealName}`,
      blocks: [
        {
          items: [
            "Walked it with the camera running — roof, mechanicals, frontage, every tenant space. Full video to her the same afternoon.",
            "Her reply, four hours later: \"I've seen enough. This is the one to beat.\"",
          ],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "email", 70, {
      direction: "out",
      subject: "First candidate set — built around your exchange clock",
      body: `Margaret,\n\nOpening set attached — six candidates, each annotated with my read and how it fits your identification window. Since you're managing this from out of state, I'll walk the shortlist on video so you never have to get on a plane for a maybe.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "3h after send",
        sentiment: "Positive · engaged",
        sentimentTone: "positive",
        body: "This is the first broker email I've received that treats the deadline as the actual client. Top two, please — walk them for me.",
      },
      hasAttachment: true,
    }),
    mk(ctx, "email", 85, {
      direction: "out",
      subject: "Your search, in writing",
      body: `Margaret,\n\nGood speaking today. Recapping so we're precise: you're exchanging out of the family estate, the identification window is the constraint that matters, and you want income-stable retail you never have to think about. Everything I send will be measured against those three sentences.\n\n${ME}`,
    }),
    stageChanged(ctx, 86, "pitching", "client"),
    createdEvent(ctx),
  ];
}

// ── Patricia Vance — Past client ─────────────────────────────────────────────
// Acquisitions director at an institutional REIT. No emotion, all rigor;
// the board approves the final buyer. Closed six weeks ago at value — and the
// close is already becoming the next two deals.

function patricia(ctx: ArcCtx): TimelineEvent[] {
  const dealName = ctx.deal?.name ?? "the asset";
  return [
    // The referral she promised on the check-in call — it just landed.
    mk(ctx, "inbound-email", 2, {
      direction: "in",
      subject: "Intro: Karen Osgood, Meridian Capital",
      body: "As promised — copying Karen Osgood, who leads dispositions at Meridian. Karen, this is the broker I mentioned: the certainty-weighted process I described came from their playbook. I'll let you two take it from here.",
    }),
    mk(ctx, "note", 4, {
      body: "Past client, warm, institutional. Two live threads out of one close: the second disposition next year, and the referral intro she's sending this week. This is how a closed deal becomes the next two.",
      visibility: "private",
    }),
    mk(ctx, "call", 5, {
      direction: "out",
      durationSecs: 15 * 60 + 27,
      title: "Post-close check-in with Patricia",
      blocks: [
        {
          items: [
            "Deal funded clean; her board flagged the process as the template for future dispositions.",
            "She has a second asset to bring to market next year — and offered an intro to a peer who's disposing in Q1.",
          ],
        },
        {
          items: ["Calendar a Q4 prep call on the next asset", "Send the referral a market one-pager"],
        },
      ],
    }),
    mk(ctx, "email", 40, {
      direction: "out",
      subject: `Closed — ${dealName} recap`,
      body: `Patricia,\n\nClosed and funded, at value, on schedule. Full recap attached, including the comp this sets for the rest of the portfolio.\n\nIt was a genuinely well-run process on your side. Whenever the next asset is ready, I'd be glad to do it again.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "3h after send",
        sentiment: "Positive · repeat + referral",
        sentimentTone: "positive",
        body: "Textbook execution. We'll be back for the next one, and I'm sending you an intro to a colleague at Meridian this week.",
      },
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "stage-change", 42, {
      title: "Deal stage changed",
      body: "Under contract → Closed",
      source: "user",
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 48, {
      direction: "out",
      durationSecs: 9 * 60 + 14,
      title: "Clear-to-close call with Patricia",
      blocks: [
        {
          items: [
            "Appraisal at value; buyer waived remaining contingencies.",
            "Clear to close next week.",
          ],
        },
        {
          items: ["Coordinate closing logistics with title and buyer counsel"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 75, {
      direction: "out",
      durationSecs: 18 * 60 + 50,
      title: "Buyer selection with Patricia",
      blocks: [
        {
          items: [
            "Board approved the regional buyer — slightly lower headline, but all cash, 21-day close, no financing out.",
            "Certainty beat price by a visible margin. Logged for the next board memo.",
          ],
        },
        {
          items: ["Open escrow", "Lock the diligence and estoppel schedule"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "email", 82, {
      direction: "out",
      subject: `${dealName}: LOI comparison`,
      body: `Patricia,\n\nBoth LOIs attached, weighted for execution certainty per the board's priorities — not just headline price. The regional group is under the national on price but all-cash with a 21-day close and no financing contingency. My recommendation: take certainty.\n\n${ME}`,
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 95, {
      direction: "out",
      durationSecs: 24 * 60 + 33,
      title: "Tour debrief with Patricia",
      blocks: [
        {
          items: [
            "Three institutional tours complete; two signaling LOIs.",
            "She wants the side-by-side weighted on execution risk, not just price. Board reads it Friday.",
          ],
        },
        {
          items: ["Collect both LOIs", "Build the certainty-weighted comparison"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "marketing", 120, {
      title: `${dealName} — institutional launch`,
      body: "OM to eleven institutional buyers under CA. Five CAs returned within 48 hours.",
      source: "automation",
      associations: assoc(ctx.deal),
    }),
    stageChanged(ctx, 145, "pitching", "client"),
    mk(ctx, "email", 150, {
      direction: "out",
      subject: `${dealName}: BOV + disposition plan`,
      body: `Patricia,\n\nBOV attached — cap-rate-led, built on signed-lease NOI only, with the three most relevant trades in the deck. Plan is a quiet launch to roughly a dozen vetted institutions, then a certainty-weighted comparison for your board rather than a price-only view.\n\n${ME}`,
      reply: {
        replier: ctx.ref.name,
        delay: "1d after send",
        sentiment: "Positive · approved",
        sentimentTone: "positive",
        body: "This is the level of rigor we needed. Approved to proceed.",
      },
      hasAttachment: true,
      associations: assoc(ctx.deal),
    }),
    mk(ctx, "call", 170, {
      direction: "out",
      durationSecs: 28 * 60 + 5,
      title: "Discovery call with Patricia",
      blocks: [
        {
          items: [
            "The REIT is disposing — capital recycling, not distress. She was precise about that distinction.",
            "She runs a tight process: defensible BOV, vetted buyer pool, clean timeline. No theatrics.",
            "Board approval required on the final buyer — execution certainty matters as much as price.",
          ],
        },
        {
          items: ["Build the cap-rate-led BOV off the rent roll and T12", "Pull the submarket comps"],
        },
      ],
      associations: assoc(ctx.deal),
    }),
    createdEvent(ctx),
  ];
}
