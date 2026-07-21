import { useRef, useState } from "react";
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
import { LiveCallBar } from "#/components/contacts/LiveCallBar";
import { LogCallModal } from "#/components/contacts/LogCallModal";
import { useContactShares } from "#/components/contacts/useContactShares";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useLiveCall } from "#/components/contacts/useLiveCall";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import {
  buildBriefing,
  contactFullName,
  type ComposedActivity,
} from "#/components/contacts/contactDisplay";

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

function ContactDetailPage() {
  const { contactId } = Route.useParams();
  // Subscribe to the contacts map so edits (e.g. the hero's Edit Contact form)
  // re-render the page; getContactDetailClient itself reads a fresh snapshot.
  useDataStore((s) => s.contacts);
  const detail = getContactDetailClient(contactId);
  // Called before the early return to satisfy the rules of hooks. The sharing
  // modal is owned here so both the top-bar Share button and the hero avatars
  // can open it.
  const access = useContactShares(contactId);
  const [shareOpen, setShareOpen] = useState(false);
  // Briefing collapse persists across contacts (a viewing preference).
  const briefingOpen = useContactUiPrefs((s) => s.briefingOpen);
  const setBriefingOpen = useContactUiPrefs((s) => s.setBriefingOpen);

  // Activity logged this session (compose module + live calls). Owned here so
  // the full-width call bar and the middle column write to one list.
  const [logged, setLogged] = useState<ComposedActivity[]>([]);
  const seqRef = useRef(0);
  const addLog = (draft: ComposedDraft) => {
    const seq = seqRef.current++;
    setLogged((prev) => [{ ...draft, id: `logged-${seq}`, seq }, ...prev]);
  };
  const liveCall = useLiveCall({ contact: detail?.contact ?? null });

  if (!detail) return <ContactNotFound />;

  const { contact, deals, tasks, completedTasks } = detail;

  return (
    <div
      className="d-flex flex-column h-100 overflow-hidden p-4 gap-3 mx-auto w-100"
      style={{ maxWidth: "96rem" }}
    >
      {/* Fixed top bar */}
      <ContactDetailTopBar
        contact={contact}
        access={access}
        onOpenShare={() => setShareOpen(true)}
      />

      {/* Live call bar — docks full-width above the columns while a call runs. */}
      {liveCall.call && (
        <LiveCallBar
          call={liveCall.call}
          onHangUp={liveCall.hangUp}
          onEndCall={liveCall.endCall}
          onToggleMute={liveCall.toggleMute}
        />
      )}

      {/* Full-height 3-column row; each column scrolls independently and the
          page itself never scrolls. */}
      <div className="d-flex gap-4 flex-grow-1 overflow-hidden">
        <div
          className="flex-shrink-0 h-100 overflow-auto"
          style={{ width: 380 }}
        >
          <ContactOverviewColumn
            contact={contact}
            deals={deals}
            shares={access.shares}
            onOpenShare={() => setShareOpen(true)}
          />
        </div>
        <div className="flex-grow-1 h-100 overflow-auto">
          <ContactEngagementPanel
            contact={contact}
            deals={deals}
            logged={logged}
            onLog={addLog}
            onStartCall={liveCall.startCall}
          />
        </div>
        <div
          className="flex-shrink-0 h-100 overflow-auto"
          style={{ width: 380 }}
        >
          <div className="d-flex flex-column gap-4">
            {/* AI briefing — floats above the Tasks section */}
            <ContactBriefingSection
              briefing={buildBriefing(contact, deals)}
              open={briefingOpen}
              onToggle={() => setBriefingOpen(!briefingOpen)}
            />
            <ContactTasksPanel
              contact={contact}
              tasks={tasks}
              completedTasks={completedTasks}
            />
          </div>
        </div>
      </div>

      <ShareContactModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        contactName={contactFullName(contact)}
        shares={access.shares}
        onShare={access.grant}
        onChangeTier={access.changeTier}
        onRemove={access.revoke}
      />

      {/* Mandatory post-call logging — appears when a live call ends. */}
      <LogCallModal
        open={liveCall.pendingLog}
        contact={contact}
        deals={deals}
        onLog={(draft) => {
          addLog(draft);
          liveCall.clearPendingLog();
        }}
      />

      {/* Floating design-comparison menu (prototype-only). */}
      <ContactDesignToggles />
    </div>
  );
}
