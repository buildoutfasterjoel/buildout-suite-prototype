import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faListCheck, faBriefcase, faXmark, faPen } from "@fortawesome/pro-regular-svg-icons";
import { renderLightHtml } from "#/ai/renderLightHtml";
import { useCallStore } from "#/components/call/useCallStore";
import { composeRecapReport } from "#/components/call/callRecap";
import { createTask, createDeal } from "#/data/actions";
import { parseDueDate } from "#/ai/dueDate";
import { useAddTask } from "#/data/useAddTask";
import { emptyDraft } from "#/data/createListing";
import { undoHeroActions, weekdayFromIsoDate } from "#/components/call/heroRecapExtensions";

/**
 * "Otto reports" recap card (Phase-3 design §6.1). Renders when useCallStore.recap
 * is set, after a call ends. Drafts follow-up tasks (keep / edit / drop) and can
 * open an opportunity. Kept tasks + the opportunity create real records.
 */
export function CallRecapCard() {
  const recap = useCallStore((s) => s.recap);
  const target = useCallStore((s) => s.target);
  const clearRecap = useCallStore((s) => s.clearRecap);
  const reset = useCallStore((s) => s.reset);
  const heroActions = useCallStore((s) => s.heroActions);
  const clearHeroActions = useCallStore((s) => s.clearHeroActions);
  const router = useRouter();

  const contactName = target?.name ?? "your contact";
  const contactId = target?.contactId ?? null;
  const report = useMemo(
    () => (recap ? composeRecapReport(recap, contactName) : null),
    [recap, contactName],
  );

  const [drafts, setDrafts] = useState<{ title: string; due: string | null }[]>([]);
  const [oppOpen, setOppOpen] = useState(false);

  // Seed the editable drafts when a new recap arrives.
  useEffect(() => {
    if (recap) {
      setDrafts(recap.tasks);
      setOppOpen(false);
    }
  }, [recap]);

  if (!recap || !report) return null;

  const keep = (i: number) => {
    const d = drafts[i];
    createTask({
      name: d.title,
      dueDate: d.due ? parseDueDate(d.due) : null,
      contactId,
      source: "contact",
      type: "call",
    });
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const edit = (i: number) => {
    const d = drafts[i];
    const { task } = createTask({
      name: d.title,
      dueDate: d.due ? parseDueDate(d.due) : null,
      contactId,
      source: "contact",
      type: "call",
    });
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
    useAddTask.getState().openEdit(task.id);
  };

  const drop = (i: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));

  const openOpportunity = () => {
    if (!report.opportunity) return;
    const { deal } = createDeal({
      ...emptyDraft(),
      name: report.opportunity.name,
      address: report.opportunity.address,
      sellerContactId: contactId ?? "",
      dealSide: "seller",
    });
    setOppOpen(true);
    router.navigate({ to: "/listings/$listingId", params: { listingId: deal.id } });
  };

  const dismiss = () => {
    clearRecap();
    clearHeroActions();
    reset();
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-start gap-2">
        <div
          className="assistant-markdown flex-grow-1"
          dangerouslySetInnerHTML={{ __html: renderLightHtml(report.message) }}
        />
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss recap" onClick={dismiss}>
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="d-flex flex-column gap-2">
          <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
            <FontAwesomeIcon icon={faListCheck} />
            Follow-up tasks
          </div>
          {drafts.map((d, i) => (
            <div key={i} className="border rounded p-2 d-flex align-items-center gap-2">
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="fw-semibold text-truncate">{d.title}</div>
                {d.due && <div className="small text-muted">Due {d.due}</div>}
              </div>
              <Button variant="primary" size="sm" onClick={() => keep(i)}>
                Keep
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Edit task" onClick={() => edit(i)}>
                <FontAwesomeIcon icon={faPen} />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Drop task" onClick={() => drop(i)}>
                <FontAwesomeIcon icon={faXmark} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {report.opportunity && !oppOpen && !heroActions && (
        <div className="border rounded p-2 d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faBriefcase} className="text-buildout-blue-700" />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate">{report.opportunity.name}</div>
            <div className="small text-muted text-truncate">{report.opportunity.address}</div>
          </div>
          <Button variant="primary" size="sm" onClick={openOpportunity}>
            Open opportunity
          </Button>
        </div>
      )}
      {oppOpen && (
        <Badge variant="secondary" appearance="muted">
          Opportunity opened
        </Badge>
      )}

      {heroActions && (
        <div className="border rounded p-2 d-flex flex-column gap-2 bg-light">
          <div className="small text-muted text-uppercase fw-semibold">What Otto did</div>
          <ul className="mb-0 ps-3">
            <li>Opened opportunity <span className="fw-semibold">{heroActions.dealName}</span></li>
            <li>Moved it into your pipeline (Active)</li>
            <li>Scheduled a tour for {weekdayFromIsoDate(heroActions.tourDate)}</li>
          </ul>
          <div className="d-flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.navigate({ to: "/listings/$listingId", params: { listingId: heroActions.dealId } })}>
              View deal
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { undoHeroActions(heroActions); clearHeroActions(); }}>
              Undo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
