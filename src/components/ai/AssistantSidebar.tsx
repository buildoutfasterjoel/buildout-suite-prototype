import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSparkles,
  faPaperPlaneTop,
  faStop,
  faXmark,
  faPenNib,
  faListCheck,
  faFileLines,
  faScrewdriverWrench,
  faChevronRight,
  faMicrophone,
  faVolumeHigh,
  faVolumeXmark,
} from "@fortawesome/pro-regular-svg-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClientTools } from "#/ai/tools";
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
import { formatCurrency } from "#/components/deals/dealDisplay";
import { useHeroOffer, matchOfferIntent } from "#/ai/heroOffer";
import { getContact } from "#/data/store";
import { signalText } from "#/data/signal";
import { generateCallBrief, callBriefFallback } from "#/ai/generate";
import { CallBriefCard } from "#/components/call/CallBriefCard";
import type { CallBriefSpecT } from "#/ai/generate/schemas";
import { InboundEmailCard } from "#/components/call/InboundEmailCard";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { inboundSummaryText } from "#/components/call/heroInbound";

/** Shown instead of sending when the server has no Anthropic key configured. */
const NOT_CONFIGURED_MESSAGE =
  "The assistant isn't configured — no API key — so I can't run AI actions right now.";

/** Human label for the context chip, derived from the current route. */
function scopeLabel(pathname: string): string {
  if (pathname.startsWith("/listings")) return "Listings";
  if (pathname.startsWith("/backoffice/contacts")) return "People";
  if (pathname.startsWith("/backoffice")) return "Back office";
  if (pathname.startsWith("/email")) return "Email";
  if (pathname.startsWith("/editor")) return "Editor";
  if (pathname === "/" || pathname.startsWith("/suite")) return "Suite";
  return "Buildout Suite";
}

const SUGGESTIONS = [
  { icon: faPenNib, label: "Draft email", prompt: "Draft a price-reduction email to the Investors list." },
  { icon: faListCheck, label: "Create call list", prompt: "Create a call list of my cold prospects to warm up." },
  { icon: faFileLines, label: "Generate doc", prompt: "Generate a client-report summary for one of my active listings." },
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

const RELATIONSHIP_LABELS: Record<string, string> = {
  cold: "Cold",
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
} {
  const o = (output ?? {}) as { deals?: unknown; contacts?: unknown };
  return {
    deals: Array.isArray(o.deals) ? (o.deals as DealCardData[]) : [],
    contacts: Array.isArray(o.contacts) ? (o.contacts as ContactCardData[]) : [],
  };
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
          <FontAwesomeIcon icon={faFileLines} className="text-buildout-blue-700" />
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
      className="btn p-0 border rounded text-start w-100 bg-white"
    >
      <div className="d-flex align-items-center gap-2 p-2">
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate">{title}</div>
          <div className="text-muted small text-truncate">
            {badge && (
              <Badge variant="secondary" appearance="muted" className="me-1">
                {badge}
              </Badge>
            )}
            {meta}
          </div>
        </div>
        <FontAwesomeIcon icon={faChevronRight} className="text-muted flex-shrink-0" />
      </div>
    </button>
  );
}

/** Interactive cards rendered from a tool result's deals/contacts. */
function ToolResultCards({ output }: { output: unknown }) {
  const router = useRouter();
  const { deals, contacts } = entitiesOf(output);
  const emailDraft = emailDraftOf(output);
  const brief = briefOf(output);
  const answer = answerOf(output);
  const marketingPackage = marketingPackageOf(output);
  if (
    deals.length === 0 &&
    contacts.length === 0 &&
    !emailDraft &&
    !brief &&
    !answer &&
    !marketingPackage
  )
    return null;

  return (
    <div className="d-flex flex-column gap-2">
      {deals.map((d) => (
        <DealCardById key={d.id} listingId={d.id} showStatus />
      ))}
      {contacts.map((c) => (
        <ResultCard
          key={c.id}
          title={c.name}
          badge={c.relationship ? RELATIONSHIP_LABELS[c.relationship] ?? c.relationship : undefined}
          meta={c.company}
          onOpen={() =>
            router.navigate({ to: `/backoffice/contacts/${c.id}` as never })
          }
        />
      ))}
      {emailDraft && <EmailDraftCard draft={emailDraft} />}
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

/** Render a message: text bubble + a tool chip for actions, or interactive cards for lists. */
function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.content)
    .join("");
  const toolCalls = message.parts.filter(
    (p): p is Extract<typeof p, { type: "tool-call" }> => p.type === "tool-call",
  );
  const cardCalls = toolCalls.filter((p) => {
    const { deals, contacts } = entitiesOf(p.output);
    return (
      deals.length > 0 ||
      contacts.length > 0 ||
      emailDraftOf(p.output) !== null ||
      briefOf(p.output) !== null ||
      answerOf(p.output) !== null ||
      marketingPackageOf(p.output) !== null
    );
  });
  const chipCalls = toolCalls.filter((p) => !cardCalls.includes(p));

  if (!text && toolCalls.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-2">
      {(text || chipCalls.length > 0) && (
        <div className={`d-flex ${isUser ? "justify-content-end" : "justify-content-start"}`}>
          <div
            className={`rounded px-3 py-2 ${isUser ? "bg-buildout-blue-600 text-white" : "bg-body-tertiary"}`}
            style={{ maxWidth: "85%" }}
          >
            {text &&
              (isUser ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
              ) : (
                <MarkdownMessage content={text} />
              ))}
            {chipCalls.map((p, i) => (
              <div
                key={i}
                className={`d-inline-flex align-items-center gap-1 mt-1 small ${isUser ? "text-white-50" : "text-muted"}`}
              >
                <FontAwesomeIcon icon={faScrewdriverWrench} />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
      {cardCalls.map((p, i) => (
        <ToolResultCards key={i} output={p.output} />
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
    <div className="d-flex gap-2 px-3 pb-2">
      <Button variant="primary" size="sm" onClick={onCall}>
        Yes, call now
      </Button>
      <Button variant="outline" size="sm" onClick={onBrief}>
        Brief me first
      </Button>
    </div>
  );
}

export function AssistantSidebar() {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const pendingPrompt = useAssistant((s) => s.pendingPrompt);
  const consumePrompt = useAssistant((s) => s.consumePrompt);
  const focusNonce = useAssistant((s) => s.focusNonce);
  const [draft, setDraft] = useState("");
  const [brief, setBrief] = useState<{ spec: CallBriefSpecT; name: string; contactId: string } | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
  const setVoiceEnabled = useVoice((s) => s.setVoiceEnabled);
  const listening = useVoice((s) => s.listening);
  const setConversationMode = useVoice((s) => s.setConversationMode);
  const speakNextReplyRef = useRef(false);

  // Hands-free: submit final transcript to Otto, and mark that the reply should
  // be spoken back so the loop can re-arm after Otto finishes.
  const { start: startHandsFree, stopForCall } = useHandsFree({
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
    const hero = useCallStore.getState().heroActions;
    const spoken = hero ? `${recapSpeechText(message)} ${hero.narration}` : recapSpeechText(message);
    void voiceEngine.speak(spoken); // no re-arm: not in conversationMode
  }, [recap, recapTarget, voiceEnabled]);

  // Speak the inbound owner-email summary once when it self-arrives (§Phase 4B).
  // Also a one-way report — it must NOT enter conversationMode or re-arm the mic.
  const inbound = useInboundEmail((s) => s.inbound);
  const spokenInboundRef = useRef<object | null>(null);
  useEffect(() => {
    if (!inbound || inbound === spokenInboundRef.current) return;
    spokenInboundRef.current = inbound;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
    if (!voiceEnabled) return;
    void voiceEngine.speak(inboundSummaryText(inbound)); // one-way: no re-arm
  }, [inbound, voiceEnabled]);

  // Presenter kill-switch: Escape silences Otto instantly and ends conversation.
  useHotkey("Escape", () => {
    voiceEngine.cancel();
    setConversationMode(false);
  });

  // A prompt queued from another surface (e.g. omni search "Ask AI") is sent as
  // soon as it lands. This effect runs before the early return below, so the
  // hook order stays stable whether or not the panel is visible.
  useEffect(() => {
    if (pendingPrompt === null) return;
    const prompt = consumePrompt();
    if (prompt) send(prompt);
  }, [pendingPrompt, consumePrompt, send]);

  // A focus request from another surface (e.g. omni search "Ask AI") focuses the
  // composer input, so once the queued prompt auto-sends the user is already
  // positioned to type a follow-up. Keyed off a nonce so repeat requests re-fire.
  useEffect(() => {
    if (focusNonce === 0) return;
    const id = requestAnimationFrame(() => {
      formRef.current?.querySelector("input")?.focus();
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
      {/* Header */}
      <div className="d-flex align-items-center gap-2 px-3 py-3 border-bottom">
        <FontAwesomeIcon icon={faSparkles} className="text-buildout-blue-700" />
        <div className="d-flex flex-column lh-sm flex-grow-1" style={{ minWidth: 0 }}>
          <span className="fw-semibold">Assistant</span>
          <span className="text-muted small text-truncate">Your Buildout assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={voiceEnabled ? "Turn voice off" : "Turn voice on"}
          onClick={() => {
            const next = !voiceEnabled;
            setVoiceEnabled(next);
            if (!next) {
              voiceEngine.cancel();
              setConversationMode(false);
            }
          }}
        >
          <FontAwesomeIcon icon={voiceEnabled ? faVolumeHigh : faVolumeXmark} />
        </Button>
        <Badge variant="secondary" appearance="muted" className="flex-shrink-0">
          {scopeLabel(pathname)}
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close assistant"
          onClick={() => setOpen(false)}
        >
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2">
        {messages.length === 0 && !recap ? (
          <div className="text-muted small">
            Ask about your properties, contacts, and deals — or have me draft an email, build a
            call list, or move a deal along.
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {isLoading && (
          <div className="text-muted small d-inline-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faSparkles} beatFade />
            Working…
          </div>
        )}
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
        {/* The inbound owner email self-arrives after the recap (§Phase 4B) —
            render it at the bottom of the flow too, chronologically after the recap. */}
        <InboundEmailCard />
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
      <HeroOfferChips onCall={() => send("yes")} onBrief={() => send("brief me first")} />

      {/* Suggested actions (only before the first message, and not under a recap) */}
      {messages.length === 0 && !recap && (
        <div className="px-3 pb-2 d-flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s.label} variant="outline" size="sm" onClick={() => setDraft(s.prompt)}>
              <FontAwesomeIcon icon={s.icon} />
              {s.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        ref={formRef}
        className="d-flex align-items-center gap-2 p-3 border-top"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the assistant…"
          aria-label="Message the assistant"
        />
        <Button
          type="button"
          variant={listening ? "primary" : "outline"}
          size="icon"
          aria-label={listening ? "Listening — tap to stop" : "Speak to the assistant"}
          onClick={() => {
            if (listening) {
              voiceEngine.cancel();
              setConversationMode(false);
            } else {
              setConversationMode(true);
              startHandsFree();
            }
          }}
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </Button>
        {isLoading ? (
          <Button type="button" variant="outline" size="icon" aria-label="Stop" onClick={stop}>
            <FontAwesomeIcon icon={faStop} />
          </Button>
        ) : (
          <Button type="submit" variant="primary" size="icon" aria-label="Send" disabled={!draft.trim()}>
            <FontAwesomeIcon icon={faPaperPlaneTop} />
          </Button>
        )}
      </form>
    </aside>
  );
}
