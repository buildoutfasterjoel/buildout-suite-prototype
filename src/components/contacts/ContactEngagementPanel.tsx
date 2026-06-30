import { useMemo, useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faPhone,
  faEnvelope,
  faSquareCheck,
  faWandMagicSparkles,
  faHandshake,
  faFlag,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import { buildActivity, buildBriefing } from "#/data/contacts";

type EngageTab = "note" | "call" | "email" | "task";

const COMPOSER: Record<EngageTab, { placeholder: (n: string) => string; cta: string }> = {
  note: { placeholder: (n) => `Log a note about ${n}...`, cta: "Log note" },
  call: { placeholder: (n) => `Log a call with ${n}...`, cta: "Log call" },
  email: { placeholder: (n) => `Draft an email to ${n}...`, cta: "Send email" },
  task: { placeholder: (n) => `Add a task for ${n}...`, cta: "Add task" },
};

type ActivityFilter = "all" | "calls" | "emails" | "notes";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContactEngagementPanel({
  contact,
  deals,
}: {
  contact: Contact;
  deals: DealSummary[];
}) {
  const [tab, setTab] = useState<EngageTab>("note");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const activity = useMemo(() => buildActivity(contact, deals), [contact, deals]);
  const briefing = useMemo(() => buildBriefing(contact, deals), [contact, deals]);

  // Synthesized activity is only "created"/"deal" — calls/emails/notes are empty.
  const visibleActivity = filter === "all" ? activity : [];
  const filters: { key: ActivityFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: activity.length },
    { key: "calls", label: "Calls", count: 0 },
    { key: "emails", label: "Emails", count: 0 },
    { key: "notes", label: "Notes", count: 0 },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      {/* Engagement composer */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab((v ?? "note") as EngageTab)}>
            <Tabs.List>
              <Tabs.Tab value="note" icon={<FontAwesomeIcon icon={faPenToSquare} />}>
                Note
              </Tabs.Tab>
              <Tabs.Tab value="call" icon={<FontAwesomeIcon icon={faPhone} />}>
                Call
              </Tabs.Tab>
              <Tabs.Tab value="email" icon={<FontAwesomeIcon icon={faEnvelope} />}>
                Email
              </Tabs.Tab>
              <Tabs.Tab value="task" icon={<FontAwesomeIcon icon={faSquareCheck} />}>
                Task
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={COMPOSER[tab].placeholder(contact.firstName)}
            rows={3}
          />

          <div className="d-flex align-items-center justify-content-between">
            <span className="text-muted fs-small">
              Private to you and anyone you're sharing with
            </span>
            <Button variant="primary" onClick={() => setDraft("")}>
              {COMPOSER[tab].cta}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* AI briefing */}
      <Card className="shadow-sm bg-purple-heart-50 border border-primary">
        <Card.Body className="d-flex flex-column gap-2">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2 text-purple-heart-700">
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            AI Briefing
          </Card.Title>
          <p className="mb-0">{briefing}</p>
        </Card.Body>
      </Card>

      {/* Activity */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
              Activity
              <Badge variant="secondary" appearance="muted" className="fs-xs">
                {activity.length}
              </Badge>
            </Card.Title>
            <div className="d-flex align-items-center gap-1">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  variant="ghost"
                  size="sm"
                  className={filter === f.key ? "active" : undefined}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="text-muted ms-1">{f.count}</span>
                </Button>
              ))}
            </div>
          </div>
          {visibleActivity.length === 0 ? (
            <span className="text-muted fs-small">No activity to show.</span>
          ) : (
            <>
              <span className="text-muted fs-small">This week</span>
              {visibleActivity.map((a, i) => (
                <div key={i} className="d-flex align-items-center gap-3">
                  <span
                    className={`rounded-circle d-inline-flex align-items-center justify-content-center text-white flex-shrink-0 ${
                      a.kind === "deal" ? "bg-buildout-blue-500" : "bg-storm-grey-400"
                    }`}
                    style={{ width: 32, height: 32 }}
                  >
                    <FontAwesomeIcon icon={a.kind === "deal" ? faHandshake : faFlag} />
                  </span>
                  <span className="flex-grow-1">{a.label}</span>
                  <span className="text-muted fs-small text-nowrap">
                    {medDate(a.date)}
                  </span>
                </div>
              ))}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
