import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSparkles,
  faXmark,
  faFileLines,
  faListCheck,
  faPhone,
  faUserPlus,
  faChevronRight,
  faArrowLeft,
  faArrowRight,
  faMicrophone,
  faVolumeHigh,
  faVolumeXmark,
  faHandshake,
  faUsers,
  faBuilding,
  faUpRightAndDownLeftFromCenter,
  faDownLeftAndUpRightToCenter,
} from "@fortawesome/pro-regular-svg-icons";
// Solid, deliberately: the avatar's glyph is a silhouette on a pale disc, and
// the regular weight reads as a hairline outline at 14px.
import { faOtter } from "@fortawesome/pro-solid-svg-icons";
import {
  ChatMessage,
  messageText,
  messageToolCalls,
  type ToolCallPart,
} from "#/components/ai/chat/ChatMessage";
import { ChatComposer } from "#/components/ai/chat/ChatComposer";
import { createClientTools } from "#/ai/tools";
import type { ResultNav } from "#/ai/resultNav";
import { useListingsFilter } from "#/routes/_shell/listings/-useListingsFilter";
import { useContactsFilter } from "#/routes/_shell/backoffice/contacts/-useContactsFilter";
import { aiChat, aiConfigured } from "#/ai/relay";
import { buildAssistantContext, serializeContext } from "#/ai/context";
import { renderLightHtml } from "#/ai/renderLightHtml";
import { useAssistant } from "#/ai/useAssistant";
import { useVoice } from "#/ai/voice/useVoice";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { useHandsFree } from "#/ai/voice/useHandsFree";
import { useGreeting } from "#/ai/voice/useGreeting";
import type { GreetingParts } from "#/ai/voice/greeting";
import { registerStopForCall, callFlow } from "#/components/call/callFlow";
import { useCallStore } from "#/components/call/useCallStore";
import { CallRecapCard } from "#/components/call/CallRecapCard";
import { composeRecapReport, recapSpeechText } from "#/components/call/callRecap";
import { DealCardById } from "#/components/deals/DealCard";
import {
  EmailDraftCard,
  EmailDraftSection,
  type EmailDraftCardData,
} from "#/components/ai/EmailDraftCard";
import { SentEmailCard, type SentEmailData } from "#/components/ai/SentEmailCard";
import { OttoHome, type StarterPrompt } from "#/components/ai/OttoHome";
import { DayPlanCard } from "#/components/ai/DayPlanCard";
import { useDayPlanQueue } from "#/components/ai/useDayPlanQueue";
import { ActionPlanChecklist } from "#/components/ai/ActionPlanChecklist";
import { matchesPlanIntent, type DayPlanItem } from "#/ai/dayPlan";
import { formatCurrency } from "#/components/deals/dealDisplay";
import { useHeroOffer, matchOfferIntent } from "#/ai/heroOffer";
import { getContact } from "#/data/store";
import { signalText } from "#/data/signal";
import { generateCallBrief, callBriefFallback } from "#/ai/generate";
import { CallBriefCard } from "#/components/call/CallBriefCard";
import type { CallBriefSpecT } from "#/ai/generate/schemas";
import { BovCard } from "#/components/call/BovCard";
import { useBovDraft, bovSummaryText } from "#/components/call/useBovDraft";

/** Shown instead of sending when the server has no Anthropic key configured. */
const NOT_CONFIGURED_MESSAGE =
  "The assistant isn't configured — no API key — so I can't run AI actions right now.";

/**
 * Human label for the context chip, derived from the current route. Exported
 * only to keep the mapping while the badge itself is parked — see the header.
 */
export function scopeLabel(pathname: string): string {
  if (pathname.startsWith("/listings")) return "Listings";
  if (pathname.startsWith("/backoffice/contacts")) return "People";
  if (pathname.startsWith("/backoffice")) return "Back office";
  if (pathname.startsWith("/email")) return "Email";
  if (pathname.startsWith("/editor")) return "Editor";
  if (pathname === "/" || pathname.startsWith("/suite")) return "Suite";
  return "Buildout Suite";
}

/**
 * Starter prompts, shown until the broker sends their first message. Ordered
 * prescriptive-first: the whole point of the rail is that it can tell the broker
 * what to do, not just wait to be asked. Every chip maps to a tool that actually
 * runs — no chip advertises a capability the prototype doesn't have.
 */
const SUGGESTIONS: StarterPrompt[] = [
  {
    icon: faListCheck,
    label: "What's next?",
    sublabel: "Walk my whole day, top move first",
    prompt: "What should I do today?",
  },
  {
    icon: faPhone,
    label: "Build call list",
    sublabel: "Rank warmest prospects to call now",
    prompt: "Build my call list.",
  },
  {
    icon: faUserPlus,
    label: "Add a contact",
    sublabel: "Add someone new to my book",
    prompt: "Add a contact",
  },
  {
    icon: faFileLines,
    label: "Generate a doc",
    sublabel: "Client reports, marketing packages",
    prompt: "Generate a client-report summary for one of my active listings.",
  },
  {
    icon: faSparkles,
    label: "What can you do?",
    sublabel: "See everything I can help with",
    prompt: "What can you do?",
  },
];

type DealCardData = {
  id: string;
  name: string;
  status: string;
  dealType?: string;
  city?: string;
  state?: string;
  askingPrice?: number;
};
type ContactCardData = {
  id: string;
  name: string;
  company?: string;
  relationship?: string;
};
type PropertyCardData = {
  id: string;
  address?: string;
  propertyType?: string;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  cold: "Cold",
  inquired: "Inquired",
  nurturing: "Nurturing",
  active: "Active",
  pitching: "Pitching",
  client: "Client",
  past_client: "Past client",
};

/** Extract renderable entity arrays from a tool-call's output. */
function entitiesOf(output: unknown): {
  deals: DealCardData[];
  contacts: ContactCardData[];
  properties: PropertyCardData[];
} {
  const o = (output ?? {}) as { deals?: unknown; contacts?: unknown; properties?: unknown };
  return {
    deals: Array.isArray(o.deals) ? (o.deals as DealCardData[]) : [],
    contacts: Array.isArray(o.contacts) ? (o.contacts as ContactCardData[]) : [],
    properties: Array.isArray(o.properties) ? (o.properties as PropertyCardData[]) : [],
  };
}

/** Tool-provided "get there" nav descriptors (see `src/ai/resultNav.ts`). */
function navsOf(output: unknown): ResultNav[] {
  const o = (output ?? {}) as { navs?: unknown };
  return Array.isArray(o.navs) ? (o.navs as ResultNav[]) : [];
}

/**
 * Fallback navs for tools that return entity arrays without their own `navs`
 * (e.g. a contact's deals): a plain count summary whose button just opens the
 * section page unfiltered.
 */
function synthesizeNavs(
  deals: DealCardData[],
  contacts: ContactCardData[],
  properties: PropertyCardData[],
): ResultNav[] {
  const out: ResultNav[] = [];
  if (deals.length)
    out.push({ entity: "deals", count: deals.length, summary: `${deals.length} deal${deals.length === 1 ? "" : "s"}` });
  if (contacts.length)
    out.push({ entity: "contacts", count: contacts.length, summary: `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` });
  if (properties.length)
    out.push({ entity: "properties", count: properties.length, summary: `${properties.length} ${properties.length === 1 ? "property" : "properties"}` });
  return out;
}

/** Extract a generated email draft from a tool-call's output, if present. */
function emailDraftOf(output: unknown): EmailDraftCardData | null {
  const o = (output ?? {}) as { emailDraft?: unknown };
  return o.emailDraft ? (o.emailDraft as EmailDraftCardData) : null;
}

/** Extract a generated contact brief (§3.10) from a tool-call's output, if present. */
function briefOf(output: unknown): string | null {
  const o = (output ?? {}) as { brief?: unknown };
  return typeof o.brief === "string" ? o.brief : null;
}

/** Extract a generated book-strategy answer (§3.9, `analyze_book`) from a
 * tool-call's output, if present. This is light HTML, not markdown — render
 * it via `renderLightHtml`, never raw. */
function answerOf(output: unknown): string | null {
  const o = (output ?? {}) as { answer?: unknown };
  return typeof o.answer === "string" ? o.answer : null;
}

/** Extract a just-sent email (from `send_email`) from a tool-call's output. */
function sentEmailOf(output: unknown): SentEmailData | null {
  const o = (output ?? {}) as { sentEmail?: unknown };
  return o.sentEmail ? (o.sentEmail as SentEmailData) : null;
}

/** Extract the ranked day queue from `plan_my_day`'s output, if present. */
function dayPlanOf(output: unknown): DayPlanItem[] | null {
  const o = (output ?? {}) as { dayPlan?: unknown };
  const plan = o.dayPlan as { items?: unknown } | null | undefined;
  if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) return null;
  return plan.items as DayPlanItem[];
}

type MarketingPackageData = {
  doc: { tagline: string; summary: string; highlights: string[]; callToAction: string };
  email: { subject: string; to: string[]; body: string; signature: string };
  financials: { askingPrice: number | null; assetType: string | null };
};

/** Extract a generated marketing package (§3.4+3.2, `build_marketing_package`)
 * from a tool-call's output, if present. */
function marketingPackageOf(output: unknown): MarketingPackageData | null {
  const o = (output ?? {}) as { package?: unknown };
  return o.package ? (o.package as MarketingPackageData) : null;
}

/** A generated marketing flyer (tagline/summary/highlights/CTA + a financial
 * line) paired with the launch email, rendered from `build_marketing_package`. */
function MarketingPackageCard({ pkg }: { pkg: MarketingPackageData }) {
  const { doc, email, financials } = pkg;
  const hasFinancials = financials.askingPrice != null || financials.assetType;
  return (
    <div className="d-flex flex-column gap-2">
      <div className="border rounded p-3 bg-white d-flex flex-column gap-2">
        <div className="d-flex align-items-center gap-2">
          {/* Purple, like every other generated-artifact header (see the day
              plan's and the email draft's) — blue is the app's entity colour. */}
          <FontAwesomeIcon icon={faFileLines} className="text-purple-heart-600" />
          <span className="fw-semibold small text-uppercase text-muted">Marketing flyer</span>
        </div>
        <div className="fw-semibold">{doc.tagline}</div>
        {doc.summary && <div className="small text-body">{doc.summary}</div>}
        {doc.highlights.length > 0 && (
          <ul className="small mb-0 ps-3">
            {doc.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        )}
        {hasFinancials && (
          <div className="d-flex align-items-center gap-2 small">
            {financials.assetType && (
              <Badge variant="secondary" appearance="muted">
                {financials.assetType}
              </Badge>
            )}
            {financials.askingPrice != null && (
              <span className="fw-semibold">{formatCurrency(financials.askingPrice)}</span>
            )}
          </div>
        )}
        {doc.callToAction && <div className="small text-muted">{doc.callToAction}</div>}
      </div>
      <EmailDraftCard draft={{ id: "marketing-package-email", ...email }} />
    </div>
  );
}

/** A clickable card row (deal or contact) that navigates on click. */
function ResultCard({
  title,
  badge,
  meta,
  onOpen,
}: {
  title: string;
  badge?: string;
  meta?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // `d-block` + `w-100` on the button and `w-100` on the row: Blueprint's
      // .btn is a centering flex container, so without these the content
      // collapses to its intrinsic width and floats in the middle of the card.
      className="btn d-block p-0 border rounded text-start w-100 bg-white"
    >
      <div className="d-flex align-items-center gap-2 p-2 w-100">
        <span className="flex-grow-1 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <span className="fw-semibold text-truncate">{title}</span>
          {badge && (
            <Badge variant="secondary" appearance="muted" className="flex-shrink-0">
              {badge}
            </Badge>
          )}
        </span>
        <FontAwesomeIcon icon={faChevronRight} className="text-muted flex-shrink-0" />
      </div>
      {meta && <div className="text-muted small text-truncate px-2 pb-2">{meta}</div>}
    </button>
  );
}

/** Apply a nav's filter payload to the destination's bridge store, then go. */
function goToNav(router: ReturnType<typeof useRouter>, nav: ResultNav) {
  if (nav.entity === "contacts") {
    useContactsFilter.getState().apply(nav.contactsFilter ?? {});
    router.navigate({ to: "/backoffice/contacts" as never });
  } else {
    // deals and properties both live in the Listings grid.
    useListingsFilter.getState().applyFacets(nav.listingsFacets ?? {});
    router.navigate({ to: "/listings" as never });
  }
}

/**
 * Compact summary card shown when a tool returns more than one item — instead
 * of a flood of cards. Shows the count + a button that lands the broker on the
 * pre-filtered section page (see `goToNav`).
 */
function ResultSummaryCard({ nav, onGo }: { nav: ResultNav; onGo: () => void }) {
  const icon =
    nav.entity === "contacts" ? faUsers : nav.entity === "properties" ? faBuilding : faHandshake;
  const dest = nav.entity === "contacts" ? "View in People" : "View in Deals";
  return (
    <button
      type="button"
      onClick={onGo}
      className="btn p-0 border rounded text-start w-100 bg-white"
    >
      <div className="d-flex align-items-center gap-2 p-2">
        <span
          className="d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-buildout-blue-700 flex-shrink-0"
          style={{ width: 32, height: 32 }}
        >
          <FontAwesomeIcon icon={icon} />
        </span>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate">{nav.summary}</div>
          <div className="text-muted small">{dest} →</div>
        </div>
        <FontAwesomeIcon icon={faChevronRight} className="text-muted flex-shrink-0" />
      </div>
    </button>
  );
}

/**
 * Renders a tool result. A SINGLE entity (one deal / contact / property) shows
 * its full widget card. TWO OR MORE collapse into a per-category summary card
 * with a "get there" button, so a large result set doesn't bury the chat. Rich
 * single-payload results (email draft, brief, marketing package, book answer)
 * always render in full.
 */
function ToolResultCards({
  output,
  emailFlow,
  repliedPast,
  onQuickReply,
}: {
  output: unknown;
  /** Where each draft sits in the conversation's email history (see `emailFlow`). */
  emailFlow?: EmailFlow;
  /** The broker has already replied past this turn — its quick replies retire. */
  repliedPast?: boolean;
  /** Send a quick reply as the broker's own turn ("send it", "delete it"). */
  onQuickReply?: (text: string) => void;
}) {
  const router = useRouter();
  const { deals, contacts, properties } = entitiesOf(output);
  const emailDraft = emailDraftOf(output);
  const brief = briefOf(output);
  const answer = answerOf(output);
  const marketingPackage = marketingPackageOf(output);
  const dayPlan = dayPlanOf(output);
  const sentEmail = sentEmailOf(output);
  const hasRich = !!(emailDraft || marketingPackage || brief || answer || dayPlan || sentEmail);
  const total = deals.length + contacts.length + properties.length;

  if (total === 0 && !hasRich) return null;

  const rich = (
    <>
      {dayPlan && (
        <>
          <ActionPlanChecklist done />
          {/* The summary moved out of the checklist and into plain prose: the
              checklist is now a folded line, and burying the one sentence that
              says what happened inside it meant it shipped collapsed. */}
          <div className="text-body">
            Prioritized your day, {dayPlan.length} move{dayPlan.length === 1 ? "" : "s"} queued.
            Starting you on the first one.
          </div>
          <DayPlanCard items={dayPlan} slot="arm" />
        </>
      )}
      {emailDraft && (
        <EmailDraftSection
          draft={emailDraft}
          version={emailFlow?.versionOf.get(emailDraft.id) ?? 1}
          superseded={!!emailFlow?.superseded.has(emailDraft.id)}
          showActions={!repliedPast}
          onSend={() => onQuickReply?.("Send it")}
          onDelete={() => onQuickReply?.("Delete that draft")}
        />
      )}
      {sentEmail && <SentEmailCard sent={sentEmail} />}
      {marketingPackage && <MarketingPackageCard pkg={marketingPackage} />}
      {brief && (
        <div className="assistant-markdown" style={{ whiteSpace: "pre-wrap" }}>
          {brief}
        </div>
      )}
      {answer && (
        <div
          className="assistant-markdown"
          dangerouslySetInnerHTML={{ __html: renderLightHtml(answer) }}
        />
      )}
    </>
  );

  // Exactly one entity → show its full card.
  if (total === 1 && !hasRich) {
    const d = deals[0];
    const c = contacts[0];
    const p = properties[0];
    return (
      <div className="d-flex flex-column" style={{ gap: 12 }}>
        {d && <DealCardById listingId={d.id} showStatus />}
        {c && (
          <ResultCard
            title={c.name}
            badge={c.relationship ? RELATIONSHIP_LABELS[c.relationship] ?? c.relationship : undefined}
            meta={c.company}
            onOpen={() => router.navigate({ to: `/backoffice/contacts/${c.id}` as never })}
          />
        )}
        {p && (
          <ResultCard
            title={p.address ?? "Property"}
            badge={p.propertyType}
            onOpen={() => goToNav(router, { entity: "properties", count: 1, summary: "", listingsFacets: { search: p.address } })}
          />
        )}
      </div>
    );
  }

  // Two or more → summary cards (tool-provided navs, else synthesized).
  const navs = navsOf(output);
  const summaryNavs = navs.length ? navs : synthesizeNavs(deals, contacts, properties);
  return (
    // 12px, like every other multi-element reply — see `ChatMessage`.
    <div className="d-flex flex-column" style={{ gap: 12 }}>
      {summaryNavs.map((nav, i) => (
        <ResultSummaryCard key={i} nav={nav} onGo={() => goToNav(router, nav)} />
      ))}
      {rich}
    </div>
  );
}

/**
 * Artifacts that carry their own summary line — the day plan's "Prioritized your
 * day, 8 moves queued", the draft's "Done. Let me know if you'd like any edits",
 * the receipt's own subject-and-recipient header.
 *
 * The system prompt asks the model to confirm each of these in a line of prose,
 * and that instruction is older than the cards: it was written when the model's
 * sentence was the ONLY prose in the turn. Now every one of these artifacts says
 * the same thing itself, so the model's copy is a second version of a sentence
 * the broker has already read — see `narratedIndices`.
 */
function selfNarrating(output: unknown): boolean {
  return (
    dayPlanOf(output) !== null || emailDraftOf(output) !== null || sentEmailOf(output) !== null
  );
}

/**
 * The conversation's email history, walked once and read by every draft in it.
 *
 * A draft can't tell on its own whether it's the live one: that depends on what
 * landed *after* it. So the walk goes forward through the transcript and, each
 * time a new draft or a send appears, retires everything before it. What comes
 * back is two lookups — which version a draft is (so a revision says "Draft v2"
 * under an "Edited email draft" header) and whether it's been superseded (so it
 * folds shut and leaves the live version in view).
 */
interface EmailFlow {
  versionOf: Map<string, number>;
  superseded: Set<string>;
}

function buildEmailFlow(messages: UIMessage[]): EmailFlow {
  const versionOf = new Map<string, number>();
  const superseded = new Set<string>();
  /**
   * Drafts of the email currently being worked on. Reset by a send, so the next
   * email starts over at "Drafted an email" / "Draft" — it's a new letter, not
   * revision three of one that already went out.
   */
  let live: string[] = [];
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type !== "tool-call") continue;
      const draft = emailDraftOf(p.output);
      if (draft?.id && !versionOf.has(draft.id)) {
        // Everything drafted before this one is now history.
        for (const id of live) superseded.add(id);
        live.push(draft.id);
        versionOf.set(draft.id, live.length);
        continue;
      }
      // A send closes the thread: the receipt below is the live artifact now, so
      // every draft that fed it folds away.
      if (sentEmailOf(p.output)) {
        for (const id of live) superseded.add(id);
        live = [];
      }
    }
  }
  return { versionOf, superseded };
}

/**
 * Read-only tools the model uses to resolve what the broker meant — the CRM
 * equivalent of looking something up before acting. Named here so the rail can
 * tell "the record is the answer" apart from "the record was a step on the way"
 * (see `producesArtifact` in `MessageBubble`).
 */
const LOOKUP_TOOLS = new Set([
  // Names as the tools are actually registered in `toolDefs.ts` — the older
  // read tools are camelCase there, and eight of these were spelled snake_case
  // here, so `isLookup` had been returning false for every one of them.
  "searchAll",
  "find_contact",
  "getContactDetail",
  "getProperty",
  "getListing",
  "listDeals",
  "listContacts",
  "listDealsForContact",
  "listDealsForProperty",
  "listContactsForDeal",
  // The record reads added for parity with the shipped assistant. Each one is a
  // step toward an answer, not the answer, so they chip rather than card when the
  // same turn produces a real artifact.
  "task_search",
  "task_load",
  "activity_search",
  "activity_load",
  "attachment_list",
  "attachment_load",
  "voucher_search",
  "voucher_load",
  "research_property_search",
  "research_property_load",
  "deal_pipeline_totals",
]);

/**
 * Tools that DO something — mutate a record, or move the app somewhere.
 *
 * The counterpart to `LOOKUP_TOOLS`, and read the same way: a turn that ran one
 * of these has a result of its own, so the lookups that got it there are steps.
 * "Make a deal for Rosa" was rendering her contact card above the deal it went
 * on to create — the record the assistant *consulted*, presented as though it
 * were the answer to a question about creating a deal.
 *
 * A write tool's OWN card still renders: this set only suppresses lookups, and
 * `create_contact` / `update_contact` deliberately return a `contacts` array so
 * the record they just touched is one click away.
 *
 * By name rather than by output shape because a write is defined by what it did,
 * not by what it returned — `create_task` and `log_call` hand back a receipt
 * that looks like nothing in particular.
 */
const ACTION_TOOLS = new Set([
  "createDeal",
  "updateDealStage",
  "linkContactToDeal",
  "createEmailDraft",
  "createCallList",
  "build_call_list",
  "create_contact",
  "update_contact",
  "create_task",
  "add_activity",
  "log_call",
  "start_call",
  "generateDoc",
  // Both of these leave the broker somewhere new, which is the result — a card
  // offering to take them where they already are is the noisiest kind of noise.
  "filter_listings",
  "navigateTo",
]);

/**
 * Did this call actually do the thing? A tool that came back with an error did
 * not, and on a failed write the lookup card may be the only useful thing left
 * on screen — so a failure must not suppress it.
 */
function succeeded(output: unknown): boolean {
  const o = (output ?? {}) as { error?: unknown };
  return o.error === undefined;
}

/**
 * Where a store-driven card sits in the transcript: the id of the last message
 * that existed when it arrived, `null` if it arrived before any, `undefined`
 * while it isn't showing.
 *
 * The call recap and the BOV draft come from stores rather than from a tool
 * result, so they have no message of their own to live in. They used to render
 * after the whole message list — correct at the instant they appeared, and wrong
 * from the next message onward, which is how "what can you do?" got answered
 * *above* a call recap from several turns earlier. Recording the arrival point
 * pins them to the moment they actually happened.
 *
 * Reads the live messages through a ref, and the anchor is sticky once set
 * (`prev === undefined ? … : prev`): depending on `messages` would re-run on
 * every token and drag the card down the transcript behind each new turn, which
 * is the original bug with extra steps.
 */
function useTranscriptAnchor(
  present: boolean,
  messagesRef: { current: UIMessage[] },
): string | null | undefined {
  const [anchor, setAnchor] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!present) {
      setAnchor(undefined);
      return;
    }
    setAnchor((prev) => (prev === undefined ? (messagesRef.current.at(-1)?.id ?? null) : prev));
  }, [present, messagesRef]);
  return anchor;
}

/**
 * Split a message's tool calls into the ones that render a card and the ones
 * that render a chip.
 *
 * Module-level because two callers need the same answer: `MessageBubble`, to
 * decide what to draw, and the transcript's display order, to tell a message
 * that shows *results* from one that only shows a progress step. Those must
 * agree — a chip is a step and its conclusion belongs after it, while a card is
 * the answer and its lead-in belongs before it.
 */
function splitToolCalls(
  toolCalls: ToolCallPart[],
  /**
   * True when a LATER message in the same turn took an action. One turn is
   * routinely split across two messages — the model looks a record up, then acts
   * on it in the next message — so a message read on its own can't tell that its
   * lookup has already been superseded. The rail can (see `actionTurns`).
   */
  actedElsewhereInTurn = false,
): {
  cardCalls: ToolCallPart[];
  chipCalls: ToolCallPart[];
} {
  /**
   * A lookup the model ran to answer something else is a step, not a result. When
   * the same turn also produced one of its own — an artifact it wrote, or an
   * action it took — the lookup's record cards are noise: a "Delgado Building,
   * Austin TX" property card wedged above the email draft it was looked up for,
   * or Rosa's contact card above the deal that was just created on her building.
   * Either reads as the assistant answering a question nobody asked. Those calls
   * fall back to chips ("Searching your book ✓"), which say the same thing in one
   * line.
   *
   * A lookup on its own still renders cards: "find me the Delgado Building" is a
   * turn where the record IS the answer.
   */
  const isLookup = (name: string) => LOOKUP_TOOLS.has(name);
  const producesResult =
    actedElsewhereInTurn ||
    toolCalls.some(
      (p) =>
        !isLookup(p.name) &&
        ((ACTION_TOOLS.has(p.name) && succeeded(p.output)) ||
          emailDraftOf(p.output) !== null ||
          briefOf(p.output) !== null ||
          answerOf(p.output) !== null ||
          marketingPackageOf(p.output) !== null ||
          dayPlanOf(p.output) !== null ||
          sentEmailOf(p.output) !== null ||
          p.name === "plan_my_day"),
    );

  const cardCalls = toolCalls.filter((p) => {
    if (producesResult && isLookup(p.name)) return false;
    const { deals, contacts, properties } = entitiesOf(p.output);
    return (
      deals.length > 0 ||
      contacts.length > 0 ||
      properties.length > 0 ||
      navsOf(p.output).length > 0 ||
      emailDraftOf(p.output) !== null ||
      briefOf(p.output) !== null ||
      answerOf(p.output) !== null ||
      marketingPackageOf(p.output) !== null ||
      dayPlanOf(p.output) !== null ||
      sentEmailOf(p.output) !== null ||
      // Claim plan_my_day by name, before its output arrives: otherwise it spends
      // the streaming window classified as a chip and the tool's raw name flashes
      // above the card that replaces it.
      p.name === "plan_my_day"
    );
  });
  return { cardCalls, chipCalls: toolCalls.filter((p) => !cardCalls.includes(p)) };
}

/** Render a message: text bubble + a tool chip for actions, or interactive cards for lists. */
function MessageBubble({
  message,
  suppressNarration = false,
  suppressLookupCards = false,
  emailFlow,
  repliedPast = false,
  onQuickReply,
}: {
  /** The conversation's email history — see {@link buildEmailFlow}. */
  emailFlow?: EmailFlow;
  /** A later message is the broker's, so this turn's quick replies retire. */
  repliedPast?: boolean;
  onQuickReply?: (text: string) => void;
  message: UIMessage;
  /**
   * True while this message is the in-flight half of a "plan my day" turn. The
   * model streams its lead-in *before* the tool call lands, so the day-plan card
   * isn't there yet to suppress against — without this the duplicative line
   * ("You've got a handful of moves…") flashes up and then vanishes.
   */
  suppressNarration?: boolean;
  /** A later message in this turn acted — see `splitToolCalls`. */
  suppressLookupCards?: boolean;
}) {
  const text = messageText(message);
  const toolCalls = messageToolCalls(message);
  /**
   * A lookup the model ran to answer something else is a step, not a result. When
   * the same turn also produced a real artifact, its record cards are noise — a
   * "Delgado Building, Austin TX" property card wedged above the email draft it
   * was looked up for, which reads like the assistant answered a question nobody
   * asked. Those calls fall back to chips ("Searching your book ✓"), which say
   * the same thing in one line.
   *
   * A lookup on its own still renders cards: "find me the Delgado Building" is a
   * turn where the record IS the answer.
   */
  const { cardCalls, chipCalls } = splitToolCalls(toolCalls, suppressLookupCards);

  /**
   * Drop prose the artifact below it already carries — whether the model put it
   * in the same message as the tool call (this check) or in the follow-up
   * message after it (`suppressNarration`, decided by the rail, which is the
   * only place that can see one message in the context of the next).
   */
  const suppressText = suppressNarration || cardCalls.some((p) => selfNarrating(p.output));
  const showText = !!text && !suppressText;

  // Render nothing rather than an empty wrapper. A message whose only content is
  // narration `suppressNarration` drops still *has* text, so the old
  // `!text` guard let it through — and `ChatMessage` dutifully returned a bare
  // flex column with a 0px height, which the transcript's own 24px gap then
  // spaced as if it were a real turn. Visible as a phantom double gap under an
  // email draft.
  if (!showText && chipCalls.length === 0 && cardCalls.length === 0) return null;

  return (
    <ChatMessage message={message} chipCalls={chipCalls} showText={showText}>
      {cardCalls.map((p, i) => (
        <ToolResultCards
          key={i}
          output={p.output}
          emailFlow={emailFlow}
          repliedPast={repliedPast}
          onQuickReply={onQuickReply}
        />
      ))}
    </ChatMessage>
  );
}

/**
 * A picked file, as the composer's chip shows it (Figma node 10:62): name over
 * an extension + size meta line.
 *
 * Attachments are presentational — the prototype's relay sends text only, so
 * chips demonstrate the affordance and clear on send rather than riding along
 * with the message.
 */
export function AssistantSidebar() {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const pendingPrompt = useAssistant((s) => s.pendingPrompt);
  const consumePrompt = useAssistant((s) => s.consumePrompt);
  const pendingLine = useAssistant((s) => s.pendingLine);
  const consumeLine = useAssistant((s) => s.consumeLine);
  const focusNonce = useAssistant((s) => s.focusNonce);
  const expanded = useAssistant((s) => s.expanded);
  const toggleExpanded = useAssistant((s) => s.toggleExpanded);
  const setExpanded = useAssistant((s) => s.setExpanded);
  const { pathname } = useLocation();
  /**
   * Which of the rail's two faces is showing (Figma nodes 193:4366 / 193:4669).
   *
   * The rail opens on `home` every time — the greeting, the offer and the
   * starters are a *place* you can get back to, not messages that scroll away.
   * Sending anything moves to `chat`, and the chat header's back arrow returns.
   * The transcript is never cleared by the trip, so "Resume chatting" picks up
   * exactly where the broker left off.
   */
  const [view, setView] = useState<"home" | "chat">("home");
  /** The session greeting, laid out by the home screen rather than sent as a
   * message. Null until `useGreeting` fires. */
  const [greeting, setGreeting] = useState<GreetingParts | null>(null);
  const [draft, setDraft] = useState("");
  const [brief, setBrief] = useState<{ spec: CallBriefSpecT; name: string; contactId: string } | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const tools = useMemo(
    () => createClientTools({ navigate: (to) => router.navigate({ to: to as never }) }),
    [router],
  );

  const fetcher = useCallback(
    (
      {
        messages,
        resume,
        threadId,
        runId,
        parentRunId,
      }: {
        messages: Array<UIMessage>;
        resume?: unknown[];
        threadId: string;
        runId: string;
        parentRunId?: string;
      },
      { signal }: { signal: AbortSignal },
    ) =>
      // All three forwarded, not dropped. A client tool arrives as an
      // interrupt: `resume` carries the tool's result back, and the ids let the
      // server stamp the interrupt with the run the client is actually
      // tracking — without them the run is unresumable and parks forever.
      aiChat({
        data: {
          messages,
          context: serializeContext(buildAssistantContext()),
          resume,
          threadId,
          runId,
          parentRunId,
        },
        signal,
      }),
    [],
  );

  const { messages, sendMessage, setMessages, isLoading, error, stop } = useChat({ fetcher, tools });
  // Read by `useTranscriptAnchor`, which must see the latest messages without
  // re-running on every streamed token.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Checked once (and cached) so the panel never hands `useChat` a stream from
  // an unconfigured server — a missing key is resolved entirely client-side,
  // before any network call to the agent itself. `null` = "not checked yet",
  // and an unreachable/erroring check fails open (treated as configured) so a
  // flaky check doesn't block a working assistant; the normal error banner
  // covers that path instead.
  const configuredRef = useRef<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void aiConfigured()
      .then((res) => {
        if (!cancelled) configuredRef.current = res.configured;
      })
      .catch(() => {
        if (!cancelled) configuredRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || isLoading) return;
      setDraft("");
      // Anything the broker says is a conversation — leave the home screen for
      // it, including the greeting's own "Yes, call now" / "Brief me first".
      setView("chat");

      // A pending hero offer (§Phase 4A) takes priority over the normal agent
      // turn: "yes" opens the live call, "brief me first" generates a call
      // brief, and anything else clears the offer and falls through below.
      const offer = useHeroOffer.getState().pendingOffer;
      if (offer) {
        const intent = matchOfferIntent(content);
        if (intent) {
          useHeroOffer.getState().clearOffer();
          setDraft("");
          const contact = getContact(offer.contactId);
          if (contact && intent === "call") {
            callFlow.open(contact);
            return;
          }
          if (contact && intent === "brief") {
            void generateCallBrief({
              data: {
                candidate: {
                  name: `${contact.firstName} ${contact.lastName}`.trim(),
                  role: contact.role,
                  entity: contact.company,
                  note: contact.notes ?? "",
                  phone: contact.phone,
                },
                property: null,
                signal: contact.signal?.detail ?? signalText(contact),
                firstName: contact.firstName,
              },
            })
              .then((spec) =>
                setBrief({ spec, name: `${contact.firstName} ${contact.lastName}`.trim(), contactId: contact.id }),
              )
              .catch(() => {
                const spec = callBriefFallback(contact.signal?.detail ?? signalText(contact), contact.firstName);
                setBrief({ spec, name: `${contact.firstName} ${contact.lastName}`.trim(), contactId: contact.id });
              });
            return;
          }
        } else {
          useHeroOffer.getState().clearOffer(); // fall through to the agent
        }
      }

      if (configuredRef.current === false) {
        const stamp = Date.now();
        setMessages([
          ...messages,
          { id: `local-${stamp}-user`, role: "user", parts: [{ type: "text", content }] },
          {
            id: `local-${stamp}-assistant`,
            role: "assistant",
            parts: [{ type: "text", content: NOT_CONFIGURED_MESSAGE }],
          },
        ]);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        });
        return;
      }

      void sendMessage(content).then(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    },
    [isLoading, sendMessage, setMessages, messages],
  );

  const voiceEnabled = useVoice((s) => s.voiceEnabled);
  const toggleVoice = useVoice((s) => s.toggleVoice);
  const enableVoiceForMic = useVoice((s) => s.enableVoiceForMic);
  const listening = useVoice((s) => s.listening);
  const setConversationMode = useVoice((s) => s.setConversationMode);
  const speakNextReplyRef = useRef(false);

  // Hands-free: submit final transcript to Otto, and mark that the reply should
  // be spoken back so the loop can re-arm after Otto finishes.
  const { start: startHandsFree, stop: stopHandsFree, stopForCall } = useHandsFree({
    onSubmit: (text) => {
      speakNextReplyRef.current = true;
      send(text);
    },
  });
  useEffect(() => {
    registerStopForCall(stopForCall);
    return () => registerStopForCall(null);
  }, [stopForCall]);

  // Greeting: render + speak once per session on first open; then open the mic.
  // It lands in the home screen's hero rather than in the transcript — a
  // greeting is what the rail *is* when nothing has been asked yet, and pushing
  // it in as message zero meant every later view had to carve around it.
  useGreeting({
    onGreeting: (parts) => setGreeting(parts),
    onEnterConversation: () => startHandsFree(),
  });

  // Speak Otto's reply when a voice turn completes, then re-arm the mic.
  const prevLoading = useRef(isLoading);
  useEffect(() => {
    const finished = prevLoading.current && !isLoading;
    prevLoading.current = isLoading;
    if (!finished || !speakNextReplyRef.current) return;
    speakNextReplyRef.current = false;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    const text =
      last?.parts
        .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.content)
        .join("") ?? "";
    if (!text || !voiceEnabled) return;
    void voiceEngine.speak(text).then(() => {
      if (useVoice.getState().conversationMode) setTimeout(() => startHandsFree(), 350);
    });
  }, [isLoading, messages, voiceEnabled, startHandsFree]);

  /**
   * Keep the newest message in view.
   *
   * A brand-new message always scrolls — that's the point. Mid-message updates
   * (the reply streaming in, or a card mounting under it) only scroll when the
   * broker is already parked at the bottom, so scrolling up to re-read history
   * isn't yanked back by the next token.
   */
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (!isNewMessage && !atBottom) return;
    // After paint, so the just-rendered message is included in scrollHeight.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  /**
   * The email history, derived once per transcript change and read by every
   * draft in it — versions and what's been superseded (see {@link EmailFlow}).
   */
  const emailFlow = useMemo(() => buildEmailFlow(messages), [messages]);

  /**
   * Assistant messages whose whole content is a re-telling of the artifact just
   * above them — "You've got 8 queued … here's your queue:" under the queue card,
   * "Drafted — open it in her composer" under the draft that says exactly that.
   *
   * The model can't know it's repeating itself: it writes its confirmation line
   * before the card renders, and each of these artifacts only grew its own
   * summary when the rail was rebuilt. So the judgement is made here, where one
   * message can be read in the context of the one before it: once a turn has
   * produced a self-narrating artifact, the assistant's follow-up *text* is a
   * duplicate until the broker says something new.
   *
   * A follow-up that also calls a tool is real work, not narration, so it keeps
   * its text.
   */
  const { narratedIndices, artifactLanded } = useMemo(() => {
    const out = new Set<number>();
    let armed = false;
    messages.forEach((m, i) => {
      if (m.role === "user") {
        armed = false;
        return;
      }
      const calls = m.parts.filter((p) => p.type === "tool-call");
      if (calls.some((p) => selfNarrating(p.output))) {
        armed = true;
        return;
      }
      if (armed && calls.length === 0) out.add(i);
    });
    // `armed` where the walk ends is the same question asked of the newest turn:
    // its artifact is on screen and the broker hasn't spoken since. One pass,
    // two facts — so the loading indicator and the suppression can't disagree
    // about whether a turn is visually finished.
    return { narratedIndices: out, artifactLanded: armed };
  }, [messages]);

  /**
   * Assistant messages belonging to a turn that DID something — created a deal,
   * logged a call, took the broker somewhere.
   *
   * Whole-turn rather than per-message because the two halves arrive separately:
   * the model looks Rosa up in one message and creates the deal on her building
   * in the next, so the message holding her contact card never sees the write
   * that made it redundant. Marking every message in the turn is what lets the
   * lookup card drop back to a chip once the action lands.
   *
   * Reset on each user message, like `narratedIndices` — a new ask re-opens the
   * question of what counts as this turn's result.
   */
  const actionTurns = useMemo(() => {
    const out = new Set<number>();
    let turn: number[] = [];
    let acted = false;
    const settle = () => {
      if (acted) for (const i of turn) out.add(i);
      turn = [];
      acted = false;
    };
    messages.forEach((m, i) => {
      if (m.role === "user") {
        settle();
        return;
      }
      turn.push(i);
      if (
        messageToolCalls(m).some((p) => ACTION_TOOLS.has(p.name) && succeeded(p.output))
      ) {
        acted = true;
      }
    });
    settle();
    return out;
  }, [messages]);

  /**
   * The order the transcript is *drawn* in, as indices into `messages`.
   *
   * A turn that returns results is split across two messages: the model calls
   * the tool, the result comes back, and only then does it write the sentence
   * introducing what came back. Chronologically the cards are first — so "You
   * have 5 active deals — here they are:" lands underneath the deals it was
   * introducing. Inside one message `ChatMessage` already puts text above its
   * cards; this extends that across the two messages one turn is split into.
   *
   * Narrow on purpose. It swaps only a card-bearing message that has no prose of
   * its own with the text-only message immediately after it:
   *
   * - A reply that already had a paragraph keeps its own paragraphs in order.
   * - A *chip* message is never moved. A chip is a progress step ("Searching
   *   your book ✓") and the sentence after it is its conclusion, so that pair is
   *   already the right way round.
   * - Text that `narratedIndices` is going to drop isn't worth reordering.
   *
   * Indices ride along rather than the messages themselves, because
   * `repliedPast` and `suppressNarration` are both defined against the real
   * transcript and must not be renumbered by a presentation choice.
   */
  const displayOrder = useMemo(() => {
    const order = messages.map((_, i) => i);
    for (let i = 0; i < order.length - 1; i++) {
      const first = messages[order[i]];
      const second = messages[order[i + 1]];
      if (first.role !== "assistant" || second.role !== "assistant") continue;
      if (messageText(first).trim()) continue;
      if (splitToolCalls(messageToolCalls(first), actionTurns.has(order[i])).cardCalls.length === 0)
        continue;
      if (messageToolCalls(second).length > 0) continue;
      if (!messageText(second).trim()) continue;
      if (narratedIndices.has(order[i + 1])) continue;
      [order[i], order[i + 1]] = [order[i + 1], order[i]];
      i++; // the pair is settled — don't reconsider it from the other side
    }
    return order;
  }, [messages, narratedIndices, actionTurns]);

  /**
   * Index of the broker's last turn. Every assistant message above it has been
   * replied past, which retires its quick replies: the reply *is* the answer to
   * "send it or edit it?", so leaving the buttons up offers a choice that has
   * already been made (Figma node 193:7460).
   */
  const lastUserIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return i;
    return -1;
  }, [messages]);

  /**
   * Bring a closed queue back when the broker asks for it again — from the ASK,
   * not from the tool result.
   *
   * `DayPlanCard`'s `arm` slot can only revive the card when `plan_my_day`
   * actually runs, and the model does not reliably run it twice: asked a second
   * time it is prone to answering "same plan — no new items since last time" from
   * what it already has in context. That leaves the broker reading prose about a
   * card they closed, with no way to get it back. The prompt now insists on the
   * call (see `systemPrompt.ts`), but intent is knowable here without the model's
   * cooperation, so the recovery does not depend on it.
   *
   * Keyed on the message id so it fires once per ask. A tool call that *does*
   * arrive builds a fresh queue through `arm`, which resets all of this anyway.
   */
  const lastAsk = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return { id: messages[i].id, text: messageText(messages[i]) };
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (!lastAsk || !matchesPlanIntent(lastAsk.text)) return;
    const queue = useDayPlanQueue.getState();
    if (queue.key && (queue.dismissed || queue.collapsed)) queue.revive();
  }, [lastAsk?.id, lastAsk?.text]);

  /**
   * Whether the in-flight turn is a "plan my day" ask, so the progress checklist
   * replaces the generic "Working…" line. Read off the last user message rather
   * than tracked on send, so it survives re-renders and stays correct on replay.
   */
  const planPending = useMemo(() => {
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser === -1) return false;
    const text = messages[lastUser].parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.content)
      .join("");
    if (!matchesPlanIntent(text)) return false;
    // Stop as soon as the queue itself lands: the card ships its own settled
    // checklist, but `isLoading` stays true while the model finishes its closing
    // sentence — so without this the in-flight copy renders again *below* the
    // card and then vanishes.
    const arrived = messages
      .slice(lastUser + 1)
      .some((m) =>
        m.parts.some((p) => p.type === "tool-call" && dayPlanOf(p.output) !== null),
      );
    return !arrived;
  }, [messages]);

  // Speak the hang-up recap once when it appears (Otto reports, §6.1). This is a
  // one-way report — it must NOT enter conversationMode or re-arm the mic.
  const recap = useCallStore((s) => s.recap);
  const bovDraft = useBovDraft((s) => s.draft);
  // The recap and the BOV draft are store-driven records of something that
  // already happened, so each is drawn at the point in the transcript where it
  // landed — see `useTranscriptAnchor`.
  const recapAnchor = useTranscriptAnchor(!!recap, messagesRef);
  const bovAnchor = useTranscriptAnchor(!!bovDraft, messagesRef);
  // The day-plan queue is deliberately NOT one of those: it is the surface the
  // broker is working, so it is pinned outside the transcript instead — from the
  // moment it is armed, not just once a call detaches it. Mirrors the pinned
  // slot's own guard inside `DayPlanCard`, so the wrapper never pads an element
  // that renders nothing.
  const queuePinned = useDayPlanQueue((q) => q.key !== null && !q.dismissed);
  const recapTarget = useCallStore((s) => s.target);
  const spokenRecapRef = useRef<object | null>(null);
  useEffect(() => {
    if (!recap || recap === spokenRecapRef.current) return;
    spokenRecapRef.current = recap;
    // Scroll the recap into view at the bottom of the flow (regardless of voice).
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
    if (!voiceEnabled) return;
    const { message } = composeRecapReport(recap, recapTarget?.name ?? "your contact");
    void voiceEngine.speak(recapSpeechText(message)); // no re-arm: not in conversationMode
  }, [recap, recapTarget, voiceEnabled]);

  // Speak the BOV draft's summary once when it appears (Otto drafts the BOV,
  // §Phase 4C). Also a one-way report — it must NOT enter conversationMode or
  // re-arm the mic. (`bovDraft` is read above, alongside its transcript anchor.)
  const spokenBovRef = useRef<object | null>(null);
  useEffect(() => {
    if (!bovDraft || bovDraft === spokenBovRef.current) return;
    spokenBovRef.current = bovDraft;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
    if (!voiceEnabled) return;
    void voiceEngine.speak(bovSummaryText(bovDraft)); // one-way: no re-arm
  }, [bovDraft, voiceEnabled]);

  // Presenter kill-switch: Escape silences Otto instantly and ends conversation.
  useHotkey("Escape", () => {
    voiceEngine.cancel();
    setConversationMode(false);
  });

  // A prompt queued from another surface (e.g. omni search "Ask Otto") is sent as
  // soon as it lands. This effect runs before the early return below, so the
  // hook order stays stable whether or not the panel is visible.
  useEffect(() => {
    if (pendingPrompt === null) return;
    const prompt = consumePrompt();
    if (prompt) send(prompt);
  }, [pendingPrompt, consumePrompt, send]);

  // An assistant line queued from another surface (the day-plan card's "Call X"
  // hand-off) is appended straight to the transcript — it's the assistant
  // narrating an action it already took, so it never round-trips to the model.
  useEffect(() => {
    if (pendingLine === null) return;
    const line = consumeLine();
    if (!line) return;
    setMessages([
      ...messages,
      {
        id: `said-${line.slice(0, 24)}-${messages.length}`,
        role: "assistant",
        parts: [{ type: "text", content: line }],
      } as UIMessage,
    ]);
  }, [pendingLine, consumeLine, setMessages, messages]);

  // A focus request from another surface (e.g. omni search "Ask Otto") focuses the
  // composer input, so once the queued prompt auto-sends the user is already
  // positioned to type a follow-up. Keyed off a nonce so repeat requests re-fire.
  useEffect(() => {
    if (focusNonce === 0) return;
    const id = requestAnimationFrame(() => {
      // The composer is a textarea, so `querySelector("input")` here would find
      // only the hidden file picker.
      fieldRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focusNonce]);

  /**
   * Navigating collapses full screen back to the rail.
   *
   * Full screen hides the page entirely, so a navigation that left it up would
   * take the broker somewhere they can't see — and every route change here is
   * one they asked for, including the ones started from inside the chat by
   * clicking a result. The rail stays open; only the frame gives way.
   */
  useEffect(() => {
    if (useAssistant.getState().expanded) setExpanded(false);
  }, [pathname, setExpanded]);

  /**
   * Arriving at the chat lands on the newest message — coming back from the home
   * screen, or reopening a rail that was collapsed mid-conversation.
   *
   * The effect above can't cover this: it keys off `messages`, which hasn't
   * changed on either trip, so it never re-runs — and the scroller is a fresh
   * element each time (closing the rail unmounts it), which means it starts at
   * the top showing the beginning of the conversation.
   */
  useEffect(() => {
    if (!open || view !== "chat") return;
    // After paint, so the transcript is laid out and `scrollHeight` is real.
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [open, view]);

  // The panel is launched from the global navbar; render nothing when closed
  // so the content area reclaims the full width.
  if (!open) return null;

  return (
    /*
      Two frames, one panel. Docked, it's a 380px rail against the right edge of
      the stage — inset 8px from the stage's top and right in the app shell, so
      it reads as a card floating *on* the page rather than a second column
      welded to it (Figma node 193:4365). The classic nav has no rounded stage to
      float on, so there it stays flush and keeps its plain left border.

      Expanded, it drops the width cap and the inset and takes the whole stage;
      `AppShell` hides the page content to make the room (Figma node 193:5009).
    */
    <aside
      className={`assistant-rail bg-white d-flex flex-column h-100${
        expanded ? " assistant-rail--expanded" : " flex-shrink-0"
      }`}
    >
      {/* Otto's glyphs — the header otter and the starter rows' icons — are
          gradient-filled in the design, which an SVG icon can't express in CSS.
          Their `fill` points at this def instead (see main.scss). One per rail,
          hoisted here rather than living inside the header, because two
          components now reference it. Zero-sized and aria-hidden: it paints
          nothing itself. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="position-absolute">
        <linearGradient id="otto-glyph-gradient" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9f55f7" />
          <stop offset="100%" stopColor="#360764" />
        </linearGradient>
      </svg>

      {/* Header. Two faces (Figma nodes 193:4367 / 193:4670): on the home screen
          Otto's mark is *inside* the greeting, so the header shows only the way
          back into an existing conversation; in the chat it identifies whose
          replies these are and offers the way back out. Controls stay put across
          both, so the mute and close buttons never move under the cursor. */}
      <div className="assistant-rail__header">
        {view === "home" ? (
          /* Nothing to resume until something's been said — and an empty rail
             with a "Resume chatting" button is an offer that goes nowhere. */
          messages.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setView("chat")}>
              Resume chatting
              <FontAwesomeIcon icon={faArrowRight} />
            </Button>
          ) : (
            <span className="flex-grow-1" />
          )
        ) : (
          <>
            <button
              type="button"
              className="assistant-rail__control"
              aria-label="Back to start"
              onClick={() => setView("home")}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <span className="assistant-rail__avatar">
              <FontAwesomeIcon icon={faOtter} />
            </span>
            <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
              <span className="assistant-rail__title text-truncate">Otto</span>
              <span className="assistant-rail__subtitle text-truncate">
                Your Buildout assistant
              </span>
            </div>
          </>
        )}
        {/* Route-scope badge ("People", "Buildout Suite", …) parked for now.
            `scopeLabel` is kept exported so the mapping survives; restoring the
            badge means putting a <Badge> back here with the current pathname. */}
        <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-auto">
          <button
            type="button"
            className="assistant-rail__control"
            aria-label={voiceEnabled ? "Turn voice off" : "Turn voice on"}
            onClick={() => {
              const next = !voiceEnabled;
              // Sticky manual off: toggleVoice records the intent so starting the
              // mic later won't silently turn voice back on.
              toggleVoice(next);
              if (!next) {
                voiceEngine.cancel();
                setConversationMode(false);
              }
            }}
          >
            <FontAwesomeIcon icon={voiceEnabled ? faVolumeHigh : faVolumeXmark} />
          </button>
          <button
            type="button"
            className="assistant-rail__control"
            aria-label={expanded ? "Exit full screen" : "Expand to full screen"}
            aria-pressed={expanded}
            onClick={toggleExpanded}
          >
            <FontAwesomeIcon
              icon={
                expanded
                  ? faDownLeftAndUpRightToCenter
                  : faUpRightAndDownLeftFromCenter
              }
            />
          </button>
          <button
            type="button"
            className="assistant-rail__control"
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>

      {view === "home" ? (
        <div className="flex-grow-1 overflow-auto">
          <div className="assistant-rail__column assistant-rail__column--fill">
          <OttoHome
            greeting={greeting}
            starters={SUGGESTIONS}
            onPick={send}
            onCall={() => send("yes")}
            onBrief={() => send("brief me first")}
          />
          </div>
        </div>
      ) : (
      /* Messages. 20px of inner padding and 24px between turns (Figma node
         193:4680) — elements *within* one reply group tighter at 12px, which
         each of them owns (see `ChatMessage`). */
      <div ref={scrollRef} className="flex-grow-1 overflow-auto">
        <div
          className="assistant-rail__column d-flex flex-column"
          style={{ padding: 20, gap: 24 }}
        >
        {messages.length === 0 && !recap ? (
          <div className="text-muted small">
            Ask about your properties, contacts, and deals — or have me draft an email, build a
            call list, or move a deal along.
          </div>
        ) : (
          displayOrder.map((i) => {
            const m = messages[i];
            return (
              <Fragment key={m.id}>
                <MessageBubble
                  message={m}
                  emailFlow={emailFlow}
                  repliedPast={i < lastUserIndex}
                  onQuickReply={send}
                  suppressNarration={
                    narratedIndices.has(i) ||
                    (planPending && m.role === "assistant" && i === messages.length - 1)
                  }
                  suppressLookupCards={actionTurns.has(i)}
                />
                {recapAnchor === m.id && <CallRecapCard />}
                {bovAnchor === m.id && <BovCard />}
              </Fragment>
            );
          })
        )}
        {/* Arrived before the broker had said anything, so there is no message to
            hang them under. */}
        {recapAnchor === null && <CallRecapCard />}
        {bovAnchor === null && <BovCard />}
        {/* The turn's visible work can finish before the turn does: a tool result
            lands, its card renders, and the model is still closing out. What it
            says next is suppressed anyway (see `narratedIndices`), so a spinner
            underneath the card advertises work that will never show up — it just
            vanishes. `planPending` alone didn't cover this; it stopped the
            checklist re-rendering in that gap and handed the slot to "Working…". */}
        {isLoading &&
          !artifactLanded &&
          (planPending ? (
            <ActionPlanChecklist done={false} />
          ) : (
            <div className="text-muted small d-inline-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faSparkles} beatFade className="text-purple-heart-600" />
              Working…
            </div>
          ))}
        {listening && (
          <div className="text-buildout-blue-700 small d-inline-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faMicrophone} beatFade />
            Listening…
          </div>
        )}
        {error && (
          <div className="text-danger small">Something went wrong: {error.message}</div>
        )}
        {/* A card whose anchor message is gone (the transcript was reset under it)
            still has to be reachable, so it falls back to the end of the flow
            rather than disappearing. */}
        {recapAnchor !== undefined &&
          recapAnchor !== null &&
          !messages.some((m) => m.id === recapAnchor) && <CallRecapCard />}
        {bovAnchor !== undefined &&
          bovAnchor !== null &&
          !messages.some((m) => m.id === bovAnchor) && <BovCard />}
        </div>
      </div>
      )}

      {/* The day-plan queue, pinned from the moment it is armed. Outside the
          scrolling transcript, like the call brief below — because it is not a
          record of something that happened, it is the surface the broker is
          *working*: one move at a time, with Call / Open / Done. Inside the flow
          it drifted up into scrollback behind every later turn, and answers
          appeared beneath it as though the queue were newer than they were. A
          live surface belongs where the hands are, next to the composer. */}
      {queuePinned && (
        <div className="assistant-rail__column pb-2" style={{ paddingInline: 20 }}>
          <DayPlanCard slot="pinned" />
        </div>
      )}

      {/* Call brief (Phase 4A "brief me first"), raised above the composer. */}
      {brief && (
        <div className="assistant-rail__column pb-2" style={{ paddingInline: 20 }}>
          <CallBriefCard
            brief={brief.spec}
            contactName={brief.name}
            onCall={() => {
              const c = getContact(brief.contactId);
              if (c) {
                setBrief(null);
                callFlow.open(c);
              }
            }}
          />
        </div>
      )}
      {/* Input (Figma node 193:4425) — shared with the editor's Otto panel. The
          disclaimer under it is part of the input area, not the transcript, so
          it stays put across both views. */}
      {/* 20px of gutter, matching the transcript's — the two columns are the same
          width and centred the same way, so a different inset here reads as the
          composer being misaligned with everything above it. */}
      <div className="assistant-rail__column" style={{ padding: "4px 20px 16px" }}>
        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => send(draft)}
          isLoading={isLoading}
          onStop={stop}
          placeholder="Ask Otto for assistance"
          listening={listening}
          onMicToggle={() => {
            if (listening) {
              // `voiceEngine.cancel()` only silences speech *synthesis* — the
              // recognizer lives in useHandsFree, so without stopHandsFree() the
              // mic stayed hot and `listening` never cleared: on, with no way off.
              stopHandsFree();
              voiceEngine.cancel();
            } else {
              // Starting the mic turns voice on so Otto talks back — unless the
              // user deliberately muted it (then stay silent, STT only).
              enableVoiceForMic();
              setConversationMode(true);
              startHandsFree();
            }
          }}
          fieldRef={fieldRef}
          formRef={formRef}
        />
        <p className="assistant-rail__disclaimer">AI-generated content may be inaccurate.</p>
      </div>
    </aside>
  );
}
