import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSparkles,
  faArrowUp,
  faPaperPlaneTop,
  faUser,
  faPlus,
  faPaperclip,
  faStop,
  faXmark,
  faFileLines,
  faListCheck,
  faPhone,
  faUserPlus,
  faPenNib,
  faScrewdriverWrench,
  faCircleNotch,
  faCheck,
  faChevronRight,
  faChevronDown,
  faMicrophone,
  faVolumeHigh,
  faVolumeXmark,
  faHandshake,
  faUsers,
  faBuilding,
} from "@fortawesome/pro-regular-svg-icons";
// Solid, deliberately: the avatar's glyph is a silhouette on a pale disc, and
// the regular weight reads as a hairline outline at 14px.
import { faOtter } from "@fortawesome/pro-solid-svg-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { registerStopForCall, callFlow } from "#/components/call/callFlow";
import { useCallStore } from "#/components/call/useCallStore";
import { CallRecapCard } from "#/components/call/CallRecapCard";
import { composeRecapReport, recapSpeechText } from "#/components/call/callRecap";
import { DealCardById } from "#/components/deals/DealCard";
import { EmailDraftCard, type EmailDraftCardData } from "#/components/ai/EmailDraftCard";
import { DayPlanCard } from "#/components/ai/DayPlanCard";
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
const SUGGESTIONS = [
  {
    icon: faListCheck,
    label: "Recommend my next actions",
    sublabel: "Walk my whole day, top move first",
    prompt: "What should I do today?",
  },
  {
    icon: faPhone,
    label: "Build my call list",
    sublabel: "Rank the warmest prospects to call now",
    prompt: "Build my call list.",
  },
  {
    icon: faUserPlus,
    label: "Add a contact",
    sublabel: "Add someone new to your book",
    prompt: "Add a contact",
  },
  {
    icon: faPenNib,
    label: "Draft an email",
    sublabel: "Outreach to a list, in your voice",
    prompt: "Draft a price-reduction email to the Investors list.",
    // Parked while the drafting flow gets a fresh look. The `draft_email` tool
    // still works if asked for directly — this only pulls the starter row.
    hidden: true,
  },
  {
    icon: faFileLines,
    label: "Generate a doc",
    sublabel: "Client reports and marketing packages",
    prompt: "Generate a client-report summary for one of my active listings.",
  },
  {
    icon: faSparkles,
    label: "What can you do?",
    sublabel: "See everything I can help with",
    prompt: "What can you do?",
  },
];

/**
 * The starter prompts, as a collapsible column of two-line rows. Sends on click
 * rather than filling the composer: every prompt is a complete question, so
 * making the broker press enter again is friction for no gain.
 *
 * Controlled open state so the first ask can fold them away (see
 * `startersOpen`) while leaving them one click from coming back.
 */
function StarterPrompts({
  onPick,
  open,
  onOpenChange,
}: {
  onPick: (prompt: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Accordion
      // `assistant-starters` suppresses Bootstrap's own right-edge ::after
      // chevron so the caret below is the only one (see main.scss).
      className="assistant-starters"
      variant="inline"
      value={open ? ["starters"] : []}
      onValueChange={(v: unknown[]) => onOpenChange(v.includes("starters"))}
    >
      <Accordion.Item value="starters">
        <Accordion.Trigger>
          <span className="d-flex align-items-center gap-2 fw-semibold">
            <FontAwesomeIcon
              icon={open ? faChevronDown : faChevronRight}
              className="text-muted"
            />
            Suggested prompts
            <FontAwesomeIcon icon={faSparkles} className="text-purple-heart-600" />
          </span>
        </Accordion.Trigger>
        <Accordion.Content>
          <StarterRows onPick={onPick} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

/**
 * One row per starter prompt, per the Otto AI Chat Rail design (Figma 44:665):
 * a round purple token badge, a title over a muted subtitle, and a trailing
 * chevron; hover shifts the card to a light purple fill with a purple border.
 * Layout and both states live in `.assistant-starter-row` (see main.scss).
 */
function StarterRows({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="d-flex flex-column gap-2">
      {SUGGESTIONS.filter((s) => !s.hidden).map((s) => (
        <button
          key={s.label}
          type="button"
          className="assistant-starter-row"
          onClick={() => onPick(s.prompt)}
        >
          <span className="assistant-starter-row__icon">
            <FontAwesomeIcon icon={s.icon} />
          </span>
          <span className="flex-grow-1" style={{ minWidth: 0 }}>
            <span className="assistant-starter-row__title d-block fw-semibold text-truncate">
              {s.label}
            </span>
            <span className="assistant-starter-row__subtitle d-block text-muted text-truncate">
              {s.sublabel}
            </span>
          </span>
          <FontAwesomeIcon icon={faChevronRight} className="assistant-starter-row__chevron" />
        </button>
      ))}
    </div>
  );
}

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

type SentEmailData = {
  subject: string;
  to: string;
  contactId: string;
  contactName: string;
};

/** Extract a just-sent email (from `send_email`) from a tool-call's output. */
function sentEmailOf(output: unknown): SentEmailData | null {
  const o = (output ?? {}) as { sentEmail?: unknown };
  return o.sentEmail ? (o.sentEmail as SentEmailData) : null;
}

/**
 * Receipt for an email the assistant sent. Sending is the one irreversible
 * thing it does, so the confirmation is a card rather than a line of prose —
 * and it carries the way through to the record, which is where the broker goes
 * next to see it on the timeline.
 */
function SentEmailCard({ sent }: { sent: SentEmailData }) {
  const router = useRouter();
  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-2">
      <div className="d-flex align-items-center gap-2">
        <FontAwesomeIcon icon={faPaperPlaneTop} className="text-purple-heart-600" />
        <span className="fw-semibold small text-uppercase text-muted">Email sent</span>
      </div>
      <div>
        <div className="fw-semibold">{sent.subject}</div>
        <div className="small text-muted text-truncate">
          To {sent.contactName} · {sent.to}
        </div>
      </div>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.navigate({
              to: "/backoffice/contacts/$contactId",
              params: { contactId: sent.contactId },
            })
          }
        >
          <FontAwesomeIcon icon={faUser} />
          View {sent.contactName.split(" ")[0]}
        </Button>
      </div>
    </div>
  );
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
  latestDraftId,
}: {
  output: unknown;
  /**
   * The id of the newest email draft in the whole conversation. Anything older
   * renders collapsed — see `EmailDraftCard`'s `superseded`.
   */
  latestDraftId?: string | null;
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
          <ActionPlanChecklist
            done
            summary={`Prioritized your day, ${dayPlan.length} move${dayPlan.length === 1 ? "" : "s"} queued. Starting you on the first one.`}
          />
          <DayPlanCard items={dayPlan} slot="inline" />
        </>
      )}
      {emailDraft && (
        <EmailDraftCard
          draft={emailDraft}
          superseded={!!latestDraftId && emailDraft.id !== latestDraftId}
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
      <div className="d-flex flex-column gap-2">
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
    <div className="d-flex flex-column gap-2">
      {summaryNavs.map((nav, i) => (
        <ResultSummaryCard key={i} nav={nav} onGo={() => goToNav(router, nav)} />
      ))}
      {rich}
    </div>
  );
}

/**
 * Assistant replies stream as GitHub-flavored markdown. react-markdown is safe
 * by default — it does not render raw HTML and sanitizes URLs — so LLM output
 * can't inject scripts. Spacing is tuned via the `.assistant-markdown` styles.
 */
function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Human labels for the tools that surface as chips — "Drafting email", not
 * `draft_email`. Present participle while running, which is when the broker
 * actually reads them. A tool missing from this map falls back to a de-snaked
 * version of its own name, so a new tool reads as prose rather than as code.
 */
const TOOL_LABELS: Record<string, string> = {
  draft_email: "Drafting email",
  send_email: "Sending email",
  create_email_draft: "Creating draft",
  searchAll: "Searching your book",
  find_contact: "Finding contact",
  get_contact_detail: "Reading the record",
  list_deals: "Pulling deals",
  list_contacts: "Pulling contacts",
  list_deals_for_contact: "Pulling their deals",
  list_deals_for_property: "Pulling deals",
  list_contacts_for_deal: "Pulling contacts",
  get_property: "Reading the property",
  get_listing: "Reading the deal",
  create_deal: "Creating deal",
  update_deal_stage: "Updating stage",
  link_contact_to_deal: "Linking contact",
  create_contact: "Adding contact",
  create_call_list: "Saving call list",
  build_call_list: "Building call list",
  build_marketing_package: "Building package",
  generate_doc: "Generating document",
  filter_listings: "Filtering deals",
  research_contact: "Researching contact",
  answer_about_contact: "Looking that up",
  analyze_book: "Reviewing your book",
  add_note: "Logging note",
  create_task: "Setting reminder",
  start_call: "Starting call",
  plan_my_day: "Planning your day",
  navigate_to: "Taking you there",
};

function toolLabel(name: string): string {
  const known = TOOL_LABELS[name];
  if (known) return known;
  const words = name.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A running (or finished) tool call, as a gradient pill (Figma node 102:3967).
 * The design specifies the in-flight state; a settled call keeps the pill and
 * swaps the spinner for a check, so the chip reads as a completed step rather
 * than one still spinning forever.
 */
function ToolChip({ name, running }: { name: string; running: boolean }) {
  return (
    <span className="assistant-tool-chip">
      <FontAwesomeIcon icon={faScrewdriverWrench} className="assistant-tool-chip__icon" />
      {toolLabel(name)}
      <FontAwesomeIcon
        icon={running ? faCircleNotch : faCheck}
        spin={running}
        className="assistant-tool-chip__spinner"
      />
    </span>
  );
}

/**
 * Read-only tools the model uses to resolve what the broker meant — the CRM
 * equivalent of looking something up before acting. Named here so the rail can
 * tell "the record is the answer" apart from "the record was a step on the way"
 * (see `producesArtifact` in `MessageBubble`).
 */
const LOOKUP_TOOLS = new Set([
  "searchAll",
  "find_contact",
  "get_contact_detail",
  "get_property",
  "get_listing",
  "list_deals",
  "list_contacts",
  "list_deals_for_contact",
  "list_deals_for_property",
  "list_contacts_for_deal",
]);

/** Render a message: text bubble + a tool chip for actions, or interactive cards for lists. */
function MessageBubble({
  message,
  suppressPlanText = false,
  latestDraftId,
}: {
  /** Newest email draft in the conversation; older ones render collapsed. */
  latestDraftId?: string | null;
  message: UIMessage;
  /**
   * True while this message is the in-flight half of a "plan my day" turn. The
   * model streams its lead-in *before* the tool call lands, so the day-plan card
   * isn't there yet to suppress against — without this the duplicative line
   * ("You've got a handful of moves…") flashes up and then vanishes.
   */
  suppressPlanText?: boolean;
}) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.content)
    .join("");
  const toolCalls = message.parts.filter(
    (p): p is Extract<typeof p, { type: "tool-call" }> => p.type === "tool-call",
  );
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
  const isLookup = (name: string) => LOOKUP_TOOLS.has(name);
  const producesArtifact = toolCalls.some(
    (p) =>
      !isLookup(p.name) &&
      (emailDraftOf(p.output) !== null ||
        briefOf(p.output) !== null ||
        answerOf(p.output) !== null ||
        marketingPackageOf(p.output) !== null ||
        dayPlanOf(p.output) !== null ||
        sentEmailOf(p.output) !== null ||
        p.name === "plan_my_day"),
  );

  const cardCalls = toolCalls.filter((p) => {
    if (producesArtifact && isLookup(p.name)) return false;
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
  const chipCalls = toolCalls.filter((p) => !cardCalls.includes(p));

  /**
   * The day-plan card carries its own "Prioritized your day, N moves queued"
   * summary, so the model's lead-in to it ("You've got a queue ready — starting
   * with …") only says the same thing twice. Drop the text on the message that
   * carries the card; the model's follow-up message, which adds detail the card
   * doesn't have, still renders.
   */
  const suppressText =
    suppressPlanText || cardCalls.some((p) => dayPlanOf(p.output) !== null);
  const showText = !!text && !suppressText;

  if (!text && toolCalls.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-2">
      {(showText || chipCalls.length > 0) && (
        <div className={`d-flex ${isUser ? "justify-content-end" : "justify-content-start"}`}>
          <div
            // Modern-chat convention: the user's turn is a grey bubble, the
            // assistant's is unadorned text that runs the full width. The
            // bubble's fill, radius and max width are the design's — see
            // `.assistant-bubble--user` (Figma node 5:29).
            className={isUser ? "assistant-bubble--user" : "text-body w-100"}
          >
            {showText &&
              (isUser ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
              ) : (
                <MarkdownMessage content={text} />
              ))}
            {chipCalls.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mt-1">
                {chipCalls.map((p, i) => (
                  <ToolChip key={i} name={p.name} running={p.output === undefined} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {cardCalls.map((p, i) => (
        <ToolResultCards key={i} output={p.output} latestDraftId={latestDraftId} />
      ))}
    </div>
  );
}

/** The hero offer's quick-response chips ("Yes, call now" / "Brief me first").
 * Reads the offer reactively so it disappears the moment `send` clears it, and
 * calls `send(...)` for both so the click path shares the exact same routing as
 * voice/typed input. */
function HeroOfferChips({ onCall, onBrief }: { onCall: () => void; onBrief: () => void }) {
  const offer = useHeroOffer((s) => s.pendingOffer);
  if (!offer) return null;
  return (
    // No horizontal padding: these sit inside the already-padded message flow,
    // so they line up with the greeting bubble and the starter rows.
    <div className="d-flex gap-2">
      <Button variant="primary" size="sm" onClick={onCall}>
        Yes, call now
      </Button>
      <Button variant="outline" size="sm" onClick={onBrief}>
        Brief me first
      </Button>
    </div>
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
type ComposerAttachment = { id: string; name: string; meta: string };

function describeFile(file: File): ComposerAttachment {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toUpperCase() : "FILE";
  const kb = Math.max(1, Math.round(file.size / 1024));
  const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  return { id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, meta: `${ext} · ${size}` };
}

export function AssistantSidebar() {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const pendingPrompt = useAssistant((s) => s.pendingPrompt);
  const consumePrompt = useAssistant((s) => s.consumePrompt);
  const pendingLine = useAssistant((s) => s.pendingLine);
  const consumeLine = useAssistant((s) => s.consumeLine);
  const focusNonce = useAssistant((s) => s.focusNonce);
  const [draft, setDraft] = useState("");
  const [brief, setBrief] = useState<{ spec: CallBriefSpecT; name: string; contactId: string } | null>(
    null,
  );
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /**
   * Auto-grow the composer: one line at rest, growing with the value to a cap
   * (roughly six lines) after which it scrolls, so a long prompt can't push the
   * transcript off the top of the rail.
   */
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const tools = useMemo(
    () => createClientTools({ navigate: (to) => router.navigate({ to: to as never }) }),
    [router],
  );

  const fetcher = useCallback(
    ({ messages }: { messages: Array<UIMessage> }, { signal }: { signal: AbortSignal }) =>
      aiChat({ data: { messages, context: serializeContext(buildAssistantContext()) }, signal }),
    [],
  );

  const { messages, sendMessage, setMessages, isLoading, error, stop } = useChat({ fetcher, tools });

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
      setAttachments([]);

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
  useGreeting({
    onGreeting: (text) =>
      setMessages([
        ...messages,
        { id: `greeting-${Date.now()}`, role: "assistant", parts: [{ type: "text", content: text }] },
      ]),
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
   * Starter prompts start expanded and fold away on the broker's first ask, but
   * stay one click from returning. Collapsed exactly once, via the ref: after
   * that the accordion is the broker's to control, so re-expanding it mid-chat
   * isn't immediately undone by the next message.
   */
  const [startersOpen, setStartersOpen] = useState(true);
  const startersCollapsedRef = useRef(false);
  const hasUserMessage = messages.some((m) => m.role === "user");
  useEffect(() => {
    if (!hasUserMessage || startersCollapsedRef.current) return;
    startersCollapsedRef.current = true;
    setStartersOpen(false);
  }, [hasUserMessage]);

  /**
   * The newest email draft in the transcript. Every older draft card collapses
   * against it, so a revision leaves one open version in view and the history
   * folded above it rather than a stack of near-identical emails.
   *
   * Scoped to drafts that arrived as `draft_email` results: the marketing
   * package's launch email is part of a different artifact and shouldn't fold
   * away because someone later revised an unrelated one.
   */
  const latestDraftId = useMemo(() => {
    let latest: string | null = null;
    for (const m of messages) {
      for (const p of m.parts) {
        if (p.type !== "tool-call") continue;
        const d = emailDraftOf(p.output);
        if (d?.id) latest = d.id;
      }
    }
    return latest;
  }, [messages]);

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
  // re-arm the mic.
  const bovDraft = useBovDraft((s) => s.draft);
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

  // The panel is launched from the global navbar; render nothing when closed
  // so the content area reclaims the full width.
  if (!open) return null;

  return (
    <aside
      className="border-start bg-white d-flex flex-column flex-shrink-0 h-100"
      style={{ width: 380 }}
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

      {/* Header (Figma node 25:178) */}
      <div className="assistant-rail__header">
        <span className="assistant-rail__avatar">
          <FontAwesomeIcon icon={faOtter} />
        </span>
        <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
          <span className="assistant-rail__title text-truncate">Otto</span>
          <span className="assistant-rail__subtitle text-truncate">Your Buildout assistant</span>
        </div>
        {/* Route-scope badge ("People", "Buildout Suite", …) parked for now.
            `scopeLabel` is kept exported so the mapping survives; restoring the
            badge means putting a <Badge> back here with the current pathname. */}
        <div className="d-flex align-items-start gap-1 flex-shrink-0">
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
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-4">
        {messages.length === 0 && !recap ? (
          <div className="text-muted small">
            Ask about your properties, contacts, and deals — or have me draft an email, build a
            call list, or move a deal along.
          </div>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.id}>
              <MessageBubble
                message={m}
                latestDraftId={latestDraftId}
                suppressPlanText={
                  planPending && m.role === "assistant" && i === messages.length - 1
                }
              />
              {/* The offer + starters belong to the greeting, so they sit directly
                  under the first message rather than pinned above the composer. */}
              {i === 0 && (
                // Grouped tighter than the flow's own gap: the offer and the
                // starters are one block belonging to the greeting.
                <div className="d-flex flex-column gap-2">
                  <HeroOfferChips
                    onCall={() => send("yes")}
                    onBrief={() => send("brief me first")}
                  />
                  {/* Kept in place after the first ask rather than retired, so the
                      starters stay reachable mid-conversation — collapsed once
                      the broker is under way. Deliberately NOT gated on `recap`:
                      these sit at the top of the flow attached to the greeting,
                      so a call recap arriving at the bottom is unrelated. That
                      guard is what made them vanish for good after a call. */}
                  <StarterPrompts
                    onPick={send}
                    open={startersOpen}
                    onOpenChange={setStartersOpen}
                  />
                </div>
              )}
            </Fragment>
          ))
        )}
        {isLoading &&
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
        {/* The hang-up recap is the newest event — render it at the BOTTOM of the
            flow (after the messages), not the top, so the conversation reads
            chronologically. */}
        {recap && <CallRecapCard />}
        {/* The queue, once a call detached it from its place in the transcript —
            it belongs below the recap it was interrupted by, not above it. */}
        <DayPlanCard slot="bottom" />
        {/* The BOV draft self-arrives after the underwriting result is ready
            (§Phase 4C) — render it at the bottom of the flow too. */}
        <BovCard />
      </div>

      {/* Call brief (Phase 4A "brief me first") + the hero-offer chips */}
      {brief && (
        <div className="px-3 pb-2">
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
      {/* Input (Figma node 12:108) */}
      <div className="px-3 pb-3">
        <form
          ref={formRef}
          // `--filled` swaps the grid template so the value lifts to its own row
          // above the controls; empty, the placeholder sits inline between them.
          className={`otto-composer${draft ? " otto-composer--filled" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          {attachments.length > 0 && (
            <div className="otto-composer__files">
              {attachments.map((f) => (
                <span key={f.id} className="otto-composer__file">
                  <FontAwesomeIcon icon={faPaperclip} className="flex-shrink-0" />
                  <span className="otto-composer__file-label">
                    <span className="otto-composer__file-name text-truncate">{f.name}</span>
                    <span className="otto-composer__file-meta">{f.meta}</span>
                  </span>
                  <button
                    type="button"
                    className="otto-composer__file-remove"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== f.id))}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="otto-composer__body">
            {/* A textarea, not an Input: the value wraps onto as many lines as it
                needs (auto-grown below, to a cap) and the box, not the field,
                carries the border. Its position in the tree is FIXED — the
                resting/filled switch is CSS only, so typing the first character
                can't re-parent it and drop focus. */}
            <textarea
              ref={fieldRef}
              className="otto-composer__field"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter is a newline.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask Otto for assistance"
              aria-label="Message Otto"
              // Without this the browser offers its own form-history dropdown of
              // previously-typed prompts the moment the composer takes focus,
              // which reads as a stray suggestion bubble floating over the rail.
              autoComplete="off"
            />
            <div className="otto-composer__left">
              <button
                type="button"
                className="otto-composer__attach"
                aria-label="Attach a file"
                onClick={() => fileRef.current?.click()}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="d-none"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) setAttachments((prev) => [...prev, ...picked.map(describeFile)]);
                  // Reset, so picking the same file twice still fires a change.
                  e.target.value = "";
                }}
              />
            </div>
            <div className="otto-composer__right">
              <button
                type="button"
                className={`otto-composer__mic${listening ? " is-live" : ""}`}
                aria-label={listening ? "Listening — tap to stop" : "Speak to Otto"}
                onClick={() => {
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
              >
                <FontAwesomeIcon icon={faMicrophone} />
              </button>
              {/* Send only exists once there's something to send (per the
                  design); mid-turn it's the stop button in the same slot. */}
              {isLoading ? (
                <button
                  type="button"
                  className="otto-composer__send"
                  aria-label="Stop"
                  onClick={stop}
                >
                  <FontAwesomeIcon icon={faStop} />
                </button>
              ) : (
                draft.trim() && (
                  <button type="submit" className="otto-composer__send" aria-label="Send">
                    <FontAwesomeIcon icon={faArrowUp} />
                  </button>
                )
              )}
            </div>
          </div>
        </form>
      </div>
    </aside>
  );
}
