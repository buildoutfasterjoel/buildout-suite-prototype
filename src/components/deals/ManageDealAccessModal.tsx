import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { viewerId } from "#/data/currentUser";
import { teammateIdByName, type Teammate } from "#/data/teammates";
import { addDealInternalBroker } from "#/data/store";
import { notify } from "#/lib/notify";
import type { Listing } from "#/data/types";
import { MemberAvatar, TeammatePicker } from "#/components/common/TeammatePicker";
import { brokerTeammate, dealCreator, dealTeamBrokers } from "./dealAccess";

/** One row of the access list: avatar, name + sub-line, and a trailing label. */
function AccessRow({
  avatar,
  name,
  sub,
  trailing,
}: {
  avatar: ReactNode;
  name: ReactNode;
  sub?: string;
  trailing: ReactNode;
}) {
  return (
    <div className="d-flex align-items-center gap-2 py-2">
      {avatar}
      <span className="d-flex flex-column lh-sm flex-grow-1 min-w-0">
        <span className="fw-semibold text-truncate">{name}</span>
        {sub && <span className="fs-small text-muted text-truncate">{sub}</span>}
      </span>
      {trailing}
    </div>
  );
}

/**
 * Who can open this deal, and how to let someone else in — the modal behind the
 * deal header's user-gear button.
 *
 * A deal's access is its team (see `dealAccess.ts`), so this list is the
 * creator plus the internal brokers, and adding someone puts them on the team.
 * Nothing here has an access level: a deal is either yours to work or it isn't,
 * and the tiers the contact sharing modal offers would be three ways of saying
 * the same thing. They arrive with the shared-roles work.
 *
 * Rows are read-only. Taking someone off a deal also takes their row out of the
 * commission table, and that consequence belongs on the Financials tab where
 * their split is visible — not behind an avatar in the header.
 */
export function ManageDealAccessModal({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A clean search every time it opens — a leftover query would hide most of
  // the roster behind a filter nobody typed this time.
  useEffect(() => {
    if (open) {
      setQuery("");
      setPickerOpen(false);
    }
  }, [open]);

  const creator = dealCreator(listing);
  const team = dealTeamBrokers(listing);

  // Nobody already on the deal can be added to it: the creator and every
  // internal broker, matched back to the roster by name.
  const excludeIds = useMemo(() => {
    const ids = listing.internalBrokers
      .map((b) => teammateIdByName(b.name))
      .filter((id): id is string => !!id);
    return new Set<string>([creator.id, ...ids]);
  }, [creator.id, listing.internalBrokers]);

  const youSuffix = (id: string) => (id === viewerId() ? " (you)" : "");

  const openPicker = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setPickerOpen(true);
  };
  // Delay close so a click on a picker row registers before blur hides it.
  const scheduleClosePicker = () => {
    blurTimer.current = setTimeout(() => setPickerOpen(false), 120);
  };

  const grant = (member: Teammate) => {
    addDealInternalBroker(listing.id, member);
    setQuery("");
    setPickerOpen(false);
    notify({
      title: `${member.name} has access`,
      description:
        "Added to the deal team with no commission split — set theirs on the Financials tab.",
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "33rem" }}>
        <Modal.Header>
          <Modal.Title>Access to “{listing.name}”</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <div className="position-relative">
            <Input
              placeholder="Add people"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={openPicker}
              onBlur={scheduleClosePicker}
            />
            {pickerOpen && (
              <TeammatePicker
                query={query}
                excludeIds={excludeIds}
                onPick={grant}
              />
            )}
          </div>

          <p className="fs-small text-muted mb-0">
            Access follows the deal team. Everyone below can open this deal — its
            documents, its planner and its financials. Adding someone puts them
            on the team with no commission split; take them off on the
            Financials tab, where their split is visible.
          </p>

          <div className="d-flex flex-column gap-1">
            <span className="fw-semibold">People with access</span>

            <AccessRow
              avatar={<MemberAvatar member={creator} size="lg" />}
              name={`${creator.name}${youSuffix(creator.id)}`}
              sub={creator.email}
              trailing={<span className="text-muted flex-shrink-0">Creator</span>}
            />

            {team.map((b) => {
              const member = brokerTeammate(b);
              return (
                <AccessRow
                  key={b.id}
                  avatar={
                    <MemberAvatar
                      member={member ?? { name: b.name, initials: b.name.slice(0, 2).toUpperCase() }}
                      size="lg"
                    />
                  }
                  name={`${b.name}${member ? youSuffix(member.id) : ""}`}
                  sub={b.email}
                  trailing={<span className="text-muted flex-shrink-0">Broker</span>}
                />
              );
            })}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
