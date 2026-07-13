import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
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
} from "@fortawesome/pro-regular-svg-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClientTools } from "#/ai/tools";
import { aiChat } from "#/ai/relay";
import { useAssistant } from "#/ai/useAssistant";
import { DealCardById } from "#/components/deals/DealCard";

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
  if (deals.length === 0 && contacts.length === 0) return null;

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
    return deals.length > 0 || contacts.length > 0;
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

export function AssistantSidebar() {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const pendingPrompt = useAssistant((s) => s.pendingPrompt);
  const consumePrompt = useAssistant((s) => s.consumePrompt);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tools = useMemo(
    () => createClientTools({ navigate: (to) => router.navigate({ to: to as never }) }),
    [router],
  );

  const fetcher = useCallback(
    ({ messages }: { messages: Array<UIMessage> }, { signal }: { signal: AbortSignal }) =>
      aiChat({ data: { messages }, signal }),
    [],
  );

  const { messages, sendMessage, isLoading, error, stop } = useChat({ fetcher, tools });

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || isLoading) return;
      setDraft("");
      void sendMessage(content).then(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    },
    [isLoading, sendMessage],
  );

  // A prompt queued from another surface (e.g. omni search "Ask AI") is sent as
  // soon as it lands. This effect runs before the early return below, so the
  // hook order stays stable whether or not the panel is visible.
  useEffect(() => {
    if (pendingPrompt === null) return;
    const prompt = consumePrompt();
    if (prompt) send(prompt);
  }, [pendingPrompt, consumePrompt, send]);

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
        {messages.length === 0 ? (
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
        {error && (
          <div className="text-danger small">Something went wrong: {error.message}</div>
        )}
      </div>

      {/* Suggested actions (only before the first message) */}
      {messages.length === 0 && (
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
