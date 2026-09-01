import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserSlash } from "@fortawesome/pro-regular-svg-icons";
import { getContactDetailClient } from "#/data/selectors";
import { useDataStore } from "#/data/dataStore";
import { ContactDetailTopBar } from "#/components/contacts/ContactDetailTopBar";
import { ContactOverviewColumn } from "#/components/contacts/ContactOverviewColumn";
import { ContactEngagementPanel } from "#/components/contacts/ContactEngagementPanel";
import { ContactTasksPanel } from "#/components/contacts/ContactTasksPanel";
import { ContactBriefingSection } from "#/components/contacts/ContactBriefingSection";
import { ContactDesignToggles } from "#/components/contacts/ContactDesignToggles";
import { ShareContactModal } from "#/components/contacts/ShareContactModal";
import { useContactShares } from "#/components/contacts/useContactShares";
import { useContactOwnership } from "#/components/contacts/useContactOwnership";
import { resolveViewerRights } from "#/data/contactViewerAccess";
import { setContactPrivate } from "#/data/actions";
import { notify } from "#/lib/notify";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useContactNarrow } from "#/lib/useMediaQuery";
import { useAssistant } from "#/ai/useAssistant";
import { callFlow } from "#/components/call/callFlow";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import {
  buildBriefing,
  contactFullName,
} from "#/components/contacts/contactDisplay";
import {
  selectLogged,
  useContactSession,
} from "#/components/contacts/useContactSession";

export const Route = createFileRoute("/_shell/backoffice/contacts/$contactId")({
  component: ContactDetailPage,
  head: () => ({
    meta: [{ title: "Contact | Buildout Suite" }],
  }),
});

function ContactNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faUserSlash} aria-label="Contact not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Contact not found</Empty.Title>
          We couldn&apos;t find that person. They may have been removed, or the
          link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link to="/backoffice/contacts" />}
          >
            Back to People
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

/**
 * Stand-in for the ownership hook while the contact is still unresolved (or
 * missing). Only `assignedTo` and `isPrivate` are read, so nothing else needs
 * to be real.
 */
const MISSING_CONTACT = { assignedTo: "", isPrivate: false } as never;

function ContactDetailPage() {
  const { contactId } = Route.useParams();
  // Subscribe to the contacts + tasks maps so edits (e.g. the hero's Edit Contact
  // form, or a newly added task) re-render the page; getContactDetailClient
  // itself reads a fresh snapshot.
  useDataStore((s) => s.contacts);
  useDataStore((s) => s.tasks);
  useDataStore((s) => s.listings);
  const detail = getContactDetailClient(contactId);
  // Called before the early return to satisfy the rules of hooks. The sharing
  // modal is owned here so both the top-bar Share button and the hero avatars
  // can open it.
  const access = useContactShares(contactId);
  // Owner / assignee / private, resolved from the record, the roster and the
  // company's contact-ownership settings. Read here because the hero and the
  // share modal both show it. Falls back to an empty stand-in before the
  // not-found return so the hook order holds.
  const ownership = useContactOwnership(detail?.contact ?? MISSING_CONTACT);
  // What the signed-in user may do here: owner or assignee act freely, a
  // collaborator acts within their tier, anyone else reads and can ask.
  const rights = useMemo(
    () => resolveViewerRights(ownership, access.shares),
    [ownership, access.shares],
  );
  const togglePrivate = (next: boolean) => {
    setContactPrivate(contactId, next);
    notify({
      title: next ? "Marked private" : "Visible to the firm",
      description: next
        ? "Hidden from everyone — search included — until you share it."
        : "Everyone at the company can find this contact again.",
    });
  };
  const [shareOpen, setShareOpen] = useState(false);
  // Briefing collapse persists across contacts (a viewing preference).
  const briefingOpen = useContactUiPrefs((s) => s.briefingOpen);
  const setBriefingOpen = useContactUiPrefs((s) => s.setBriefingOpen);

  // Activity logged this session (compose module + live calls). Lives in the
  // contact-session store — not component state — so navigating away and back
  // keeps the timeline intact; a hard refresh starts fresh.
  const logged = useContactSession(selectLogged(contactId));
  const addLog = (draft: ComposedDraft) =>
    useContactSession.getState().addLog(contactId, draft);

  // Three columns need room the viewport doesn't always have. Below the
  // breakpoint the right column goes away and its two cards move — either into
  // the middle column's stack or into a tab strip beside the Timeline (the
  // `narrowLayout` design option decides which).
  //
  // The docked assistant rail shifts the breakpoint by its own 388px rather
  // than forcing narrow outright: what matters is the width left over for the
  // columns, not how it was spent. A big monitor keeps all three columns with
  // the rail open; a laptop drops to two (see `useContactNarrow`).
  const assistantOpen = useAssistant((s) => s.open);
  const isNarrow = useContactNarrow(assistantOpen);
  const narrowLayoutPref = useContactUiPrefs((s) => s.narrowLayout);
  // Stacking the cards into the middle column only works when that column has
  // the page to itself — with the rail open it's a third surface competing for
  // the same eye, and the page reads as noise. Tabs put one thing in view at a
  // time, so the rail forces them; the preference governs again once it closes.
  const narrowLayout = assistantOpen ? "tabs" : narrowLayoutPref;

  if (!detail) return <ContactNotFound />;

  const { contact, deals, leadDeals, tasks, completedTasks } = detail;

  // Authored once and placed by whichever layout is active, so the cards keep
  // identical props in all three arrangements.
  const briefingCard = (
    <ContactBriefingSection
      briefing={buildBriefing(contact, deals)}
      open={briefingOpen}
      onToggle={() => setBriefingOpen(!briefingOpen)}
    />
  );
  const tasksCard = (
    <ContactTasksPanel
      contact={contact}
      tasks={tasks}
      completedTasks={completedTasks}
      onLog={addLog}
      readOnly={!rights.canEdit}
    />
  );

  return (
    <div
      className="d-flex flex-column h-100 overflow-hidden p-4 gap-3 mx-auto w-100"
      // The cap follows the column count, not the rail: two columns at 96rem
      // just absorb the freed width and the middle one stretches past a
      // comfortable measure, which reads as sprawl rather than breathing room.
      // Three columns use the full cap even with the rail open — capping on
      // rail state made three columns impossible at any monitor size.
      style={{ maxWidth: isNarrow ? "72rem" : "96rem" }}
    >
      {/* Fixed top bar */}
      <ContactDetailTopBar contact={contact} />

      {/* Full-height column row; each column scrolls independently and the page
          itself never scrolls. Below the breakpoint the right column's cards
          relocate into the middle one — see `narrowLayout`. */}
      <div className="d-flex gap-4 flex-grow-1 overflow-hidden">
        <div
          className="flex-shrink-0 h-100 overflow-auto panel-scroll"
          style={{ width: 380 }}
        >
          <ContactOverviewColumn
            contact={contact}
            deals={deals}
            leadDeals={leadDeals}
            shares={access.shares}
            ownership={ownership}
            rights={rights}
            onOpenShare={() => setShareOpen(true)}
            onTogglePrivate={togglePrivate}
          />
        </div>
        <div
          className="flex-grow-1 h-100 overflow-auto panel-scroll"
          // Floor, not a target: the timeline's Log Activity tab row clips
          // below this. Fixed-width neighbors (columns, a future panel) must
          // never squish the middle silently — past the floor the row
          // overflows instead, which is visible in development.
          //
          // Three columns only. The row is `overflow-hidden`, so a floor the
          // width can't meet clips instead of scrolling — and in the narrow
          // arrangement the width genuinely can't meet it: at 768px the floor
          // put this column 74px past the row's edge and cut the timeline off,
          // where without it the column shrinks to 316px and stays whole.
          // Narrow has one fixed neighbour and no rival to protect against, so
          // it shrinks — until the sub-1024 tiers get a layout of their own.
          style={{ minWidth: isNarrow ? undefined : "24rem" }}
        >
          <ContactEngagementPanel
            contact={contact}
            ownership={ownership}
            rights={rights}
            deals={deals}
            logged={logged}
            onLog={addLog}
            onStartCall={(phone) => callFlow.open(contact, phone)}
            narrowSlot={
              // Briefing sits in the column in BOTH narrow arrangements — it's
              // the thing you read before the feed, not a place you navigate to,
              // so burying it behind a tab meant it went unread. Only Tasks
              // trades places with the Timeline.
              isNarrow ? (
                narrowLayout === "stacked" ? (
                  <>
                    {briefingCard}
                    {tasksCard}
                  </>
                ) : (
                  briefingCard
                )
              ) : undefined
            }
            sideTabs={
              isNarrow && narrowLayout === "tabs"
                ? {
                    tasks: (
                      <ContactTasksPanel
                        contact={contact}
                        tasks={tasks}
                        completedTasks={completedTasks}
                        onLog={addLog}
                        bare
                      />
                    ),
                    taskCount: tasks.length,
                  }
                : undefined
            }
          />
        </div>
        {!isNarrow && (
          <div
            className="flex-shrink-0 h-100 overflow-auto panel-scroll"
            style={{ width: 380 }}
          >
            <div className="d-flex flex-column gap-4">
              {/* AI briefing — floats above the Tasks section */}
              {briefingCard}
              {tasksCard}
            </div>
          </div>
        )}
      </div>

      <ShareContactModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        contactName={contactFullName(contact)}
        ownership={ownership}
        readOnly={!rights.canShare}
        shares={access.shares}
        onShare={access.grant}
        onChangeTier={access.changeTier}
        onRemove={access.revoke}
      />

      {/* Floating design-comparison menu (prototype-only). */}
      <ContactDesignToggles />
    </div>
  );
}
