import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faXmark } from "@fortawesome/pro-regular-svg-icons";
import { viewerId } from "#/data/currentUser";
import { teammateIdByName, type Teammate } from "#/data/teammates";
import { roleName } from "#/data/permissions";
import {
  SHARE_LEVELS,
  shareLevelLabel,
  type ShareLevel,
} from "#/data/dealShares";
import { notify } from "#/lib/notify";
import type { Listing } from "#/data/types";
import type { RosterUser } from "#/data/roster";
import { useRoster } from "#/components/settings/users/useRoster";
import { MemberAvatar, TeammatePicker } from "#/components/common/TeammatePicker";
import { canEditMarketing, brokerTeammate, dealCreator, dealTeamBrokers } from "./dealAccess";
import { useDealShares } from "./useDealAccess";

/** One row of the access list: avatar, name + sub-line, and a trailing control. */
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
 * **Sharing a deal shares its marketing.** There is no scope to pick: the
 * voucher is not a broker's to hand out, and who sees the money is settled by a
 * person's role rather than by one deal's invitations. So the only choice here
 * is the level.
 *
 * That level is capped by the person's role, not replaced by it.
 * `permissions.ts` already owns what a person may do; this modal only decides
 * which records they may do it on. Where the two meet — a role that cannot edit
 * marketing offered an edit — the option is disabled with the reason on it,
 * rather than granted and quietly taken back on the page.
 *
 * Team rows (creator, internal brokers) stay label-only. Taking someone off a
 * deal also takes their row out of the commission table, and that consequence
 * belongs on the Financials tab where their split is visible.
 */
export function ManageDealAccessModal({
  listing,
  open,
  onOpenChange,
  readOnly = false,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A guest — someone shared in — can see who has access but not change it. */
  readOnly?: boolean;
}) {
  const [step, setStep] = useState<"browse" | "configure">("browse");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<Teammate[]>([]);
  const [level, setLevel] = useState<ShareLevel>("view");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roster = useRoster((s) => s.users);
  const { shares, grant, change, revoke } = useDealShares(listing.id);

  // A clean browse view every time it opens — a leftover query or a half-staged
  // share is nobody's intent this time round.
  useEffect(() => {
    if (open) {
      setStep("browse");
      setQuery("");
      setPickerOpen(false);
      setPending([]);
    }
  }, [open]);

  const creator = dealCreator(listing);
  const team = dealTeamBrokers(listing);

  const rosterRow = (id: string): RosterUser | undefined =>
    roster.find((u) => u.id === id);

  // Nobody already on the deal can be added to it: the creator, every internal
  // broker (matched back to the roster by name), and anyone already shared in.
  const sharedIds = useMemo(() => new Set(shares.map((s) => s.member.id)), [shares]);
  const pendingIds = useMemo(() => new Set(pending.map((m) => m.id)), [pending]);
  const excludeIds = useMemo(() => {
    const brokerIds = listing.internalBrokers
      .map((b) => teammateIdByName(b.name))
      .filter((id): id is string => !!id);
    return new Set<string>([
      viewerId(),
      creator.id,
      ...brokerIds,
      ...sharedIds,
      ...pendingIds,
    ]);
  }, [creator.id, listing.internalBrokers, sharedIds, pendingIds]);

  const youSuffix = (id: string) => (id === viewerId() ? " (you)" : "");

  const openPicker = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setPickerOpen(true);
  };
  // Delay close so a click on a picker row registers before blur hides it.
  const scheduleClosePicker = () => {
    blurTimer.current = setTimeout(() => setPickerOpen(false), 120);
  };

  /** Staging the first person also opens on the highest level their role allows. */
  const addPending = (member: Teammate, first: boolean) => {
    setPending((prev) => [...prev, member]);
    setQuery("");
    setPickerOpen(false);
    if (!first) return;
    const row = rosterRow(member.id);
    setLevel(row && canEditMarketing(row) ? "contribute" : "view");
  };

  const removePending = (id: string) =>
    setPending((prev) => prev.filter((m) => m.id !== id));

  /** Staged people whose role cannot edit marketing. */
  const cappedPending = useMemo(
    () => pending.filter((m) => {
      const row = rosterRow(m.id);
      return row ? !canEditMarketing(row) : false;
    }),
    // `roster` is the reactive input rosterRow closes over.
    [pending, roster],
  );
  const anyCanContribute = pending.length > cappedPending.length;

  // Removing the last person who could edit drops the level with them, so the
  // Share button can never send a grant the radio no longer offers.
  useEffect(() => {
    if (!anyCanContribute && level === "contribute") setLevel("view");
  }, [anyCanContribute, level]);

  const capReason = (member: Teammate): string => {
    const row = rosterRow(member.id);
    const role = row ? roleName(row.roleIds[0]) : "Their role";
    return `${role} cannot edit marketing`;
  };

  const handleShare = () => {
    if (pending.length === 0) return;
    grant(pending.map((m) => m.id), level);
    notify({
      title:
        pending.length === 1
          ? `${pending[0].name} has access`
          : `${pending.length} people have access`,
      description:
        "The listing, website, documents and media. The voucher stays hidden.",
    });
    setPending([]);
    setStep("browse");
  };

  const backToBrowse = () => {
    setPending([]);
    setQuery("");
    setPickerOpen(false);
    setStep("browse");
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "33rem" }}>
        <Modal.Header>
          {step === "configure" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back"
              onClick={backToBrowse}
              className="me-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          )}
          <Modal.Title>Access to “{listing.name}”</Modal.Title>
        </Modal.Header>

        {step === "browse" ? (
          <>
            <Modal.Body className="d-flex flex-column gap-3">
              {!readOnly && (
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
                    onPick={(m) => {
                      addPending(m, true);
                      setStep("configure");
                    }}
                  />
                )}
              </div>
              )}

              <p className="fs-small text-muted mb-0">
                Sharing a deal shares its marketing — the listing, website,
                documents and media. The voucher is never part of it: who sees
                the money is set by a person&apos;s role, not from here.
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
                          member={
                            member ?? {
                              name: b.name,
                              initials: b.name.slice(0, 2).toUpperCase(),
                            }
                          }
                          size="lg"
                        />
                      }
                      name={`${b.name}${member ? youSuffix(member.id) : ""}`}
                      sub={b.email}
                      trailing={<span className="text-muted flex-shrink-0">Broker</span>}
                    />
                  );
                })}

                {shares.map((s) => (
                  <div key={s.member.id} className="d-flex align-items-center gap-2 py-2">
                    <MemberAvatar member={s.member} size="lg" />
                    <span className="d-flex flex-column lh-sm flex-grow-1 min-w-0">
                      <span className="fw-semibold text-truncate">
                        {s.member.name}
                        {youSuffix(s.member.id)}
                      </span>
                      <span className="fs-small text-muted text-truncate">
                        {s.member.email}
                      </span>
                    </span>
                    {readOnly ? (
                      <span className="text-muted flex-shrink-0">
                        {shareLevelLabel(s.level)}
                      </span>
                    ) : (
                      <Select
                        value={s.level}
                        onValueChange={(value) => {
                          const v = value as string;
                          if (v === "__remove") {
                            revoke(s.member.id);
                            return;
                          }
                          change(s.member.id, v as ShareLevel);
                        }}
                      >
                        <Select.Trigger className="flex-shrink-0" style={{ width: 150 }}>
                          {/* The label, not the value: `Select.Value` renders the
                              raw stored string on its own. */}
                          <Select.Value>{shareLevelLabel(s.level)}</Select.Value>
                        </Select.Trigger>
                        <Select.Content>
                          {SHARE_LEVELS.map((lv) => {
                            const row = rosterRow(s.member.id);
                            const blocked =
                              lv.value === "contribute" && !!row && !canEditMarketing(row);
                            return (
                              <Select.Item
                                key={lv.value}
                                value={lv.value}
                                disabled={blocked}
                              >
                                {lv.label}
                              </Select.Item>
                            );
                          })}
                          <Select.Separator />
                          <Select.Item value="__remove">Remove access</Select.Item>
                        </Select.Content>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </Modal.Footer>
          </>
        ) : (
          <>
            <Modal.Body className="d-flex flex-column gap-3">
              <div className="position-relative">
                <div className="share-modal__chips form-control d-flex flex-wrap align-items-center gap-2">
                  {pending.map((m) => (
                    <span
                      key={m.id}
                      className="share-modal__chip d-inline-flex align-items-center gap-1"
                    >
                      <MemberAvatar member={m} size="sm" />
                      <span className="fw-medium">{m.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        className="share-modal__chip-remove border-0 bg-transparent d-inline-flex p-0"
                        onClick={() => removePending(m.id)}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="share-modal__chip-input flex-grow-1 border-0 bg-transparent"
                    placeholder="Add more people"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={openPicker}
                    onBlur={scheduleClosePicker}
                  />
                </div>
                {pickerOpen && (
                  <TeammatePicker
                    query={query}
                    excludeIds={excludeIds}
                    onPick={(m) => addPending(m, pending.length === 0)}
                  />
                )}
              </div>

              <p className="fs-small text-muted mb-0">
                They get this deal&apos;s marketing — the listing, website,
                documents and media. Not the voucher.
              </p>

              <div className="d-flex flex-column gap-1">
                <span className="fw-semibold">What they can do</span>
                <RadioGroup
                  value={level}
                  onValueChange={(value) => setLevel(value as ShareLevel)}
                >
                  {SHARE_LEVELS.map((l) => {
                    const blocked = l.value === "contribute" && !anyCanContribute;
                    return (
                      <label
                        key={l.value}
                        htmlFor={`level-${l.value}`}
                        className={`share-modal__tier d-flex gap-2 p-2 rounded-3 mb-0${
                          blocked ? " share-modal__tier--blocked" : ""
                        }`}
                      >
                        <RadioGroup.Item
                          value={l.value}
                          id={`level-${l.value}`}
                          disabled={blocked}
                          className="mt-1 flex-shrink-0"
                        />
                        <span className="d-flex flex-column lh-sm">
                          <span className="fw-semibold">{l.label}</span>
                          <span className="fs-small text-muted">
                            {blocked && pending.length === 1
                              ? capReason(pending[0])
                              : l.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Some staged people can edit and some can't: say who gets less,
                  rather than silently granting everyone the same thing. */}
              {level === "contribute" && cappedPending.length > 0 && (
                <p className="fs-small text-muted mb-0">
                  {cappedPending.map((m) => m.name).join(", ")} will get view only —{" "}
                  {capReason(cappedPending[0])}.
                </p>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onClick={backToBrowse}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleShare}
                disabled={pending.length === 0}
              >
                Share
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal.Content>
    </Modal>
  );
}
