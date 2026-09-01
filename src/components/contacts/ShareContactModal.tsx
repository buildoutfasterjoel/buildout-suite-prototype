import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBuilding,
  faLock,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import {
  ACCESS_TIERS,
  CURRENT_USER,
  TEAMMATES,
  type AccessTier,
  type ContactShare,
  type Teammate,
} from "#/data/teammates";
import type { ContactOwnership } from "#/data/contactOwnership";

interface ShareContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  /** Who owns and works the record — the first rows of the access list. */
  ownership: ContactOwnership;
  shares: ContactShare[];
  /** Grant access to the given members at a tier. */
  onShare: (memberIds: string[], tier: AccessTier) => void;
  /** Change an existing member's tier. */
  onChangeTier: (memberId: string, tier: AccessTier) => void;
  /** Revoke a member's access. */
  onRemove: (memberId: string) => void;
}

/** A circular avatar: photo (when available) falling back to initials. */
function MemberAvatar({
  member,
  size,
}: {
  member: Pick<Teammate, "name" | "initials" | "avatarUrl">;
  size?: "sm" | "lg";
}) {
  return (
    <Avatar size={size} className="flex-shrink-0">
      {member.avatarUrl && <Avatar.Image src={member.avatarUrl} alt={member.name} />}
      <Avatar.Fallback className="fw-semibold">{member.initials}</Avatar.Fallback>
    </Avatar>
  );
}

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
 * What sharing does to this record right now. Sharing is the same act in every
 * configuration; what changes is what the record looked like before it — hidden,
 * or already visible with sharing only adding the right to act.
 */
function visibilityLine(ownership: ContactOwnership): string {
  const company =
    ownership.owner.kind === "company" ? ownership.owner.name : "the company";
  if (ownership.isPrivate) {
    return "Private. Only the people below can see this contact — search included. Sharing opens it to someone.";
  }
  if (ownership.owner.kind === "company") {
    return `Owned by ${company} and visible to everyone there. Sharing grants the right to act on it — log activity, edit, or reach out.`;
  }
  return "Visible to everyone at the company. Sharing grants the right to act on it — log activity, edit, or reach out.";
}

/**
 * Dropdown list of teammates that can be added, shown below the add-people input.
 * Excludes anyone already selected or already granted access.
 */
function MemberPicker({
  query,
  excludeIds,
  onPick,
}: {
  query: string;
  excludeIds: Set<string>;
  onPick: (member: Teammate) => void;
}) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEAMMATES.filter((m) => !excludeIds.has(m.id)).filter((m) =>
      q ? `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(q) : true,
    );
  }, [query, excludeIds]);

  return (
    <div className="share-modal__picker shadow-sm">
      {matches.length === 0 ? (
        <div className="px-3 py-3 text-muted fs-small">No people match.</div>
      ) : (
        matches.map((m) => (
          <button
            key={m.id}
            type="button"
            className="share-modal__picker-row d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent px-3 py-2"
            // onMouseDown fires before the input's blur, so the click lands.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(m);
            }}
          >
            <MemberAvatar member={m} size="lg" />
            <span className="fw-semibold flex-grow-1 text-truncate">{m.name}</span>
            <span className="text-muted fs-small flex-shrink-0">{m.role}</span>
          </button>
        ))
      )}
    </div>
  );
}

export function ShareContactModal({
  open,
  onOpenChange,
  contactName,
  ownership,
  shares,
  onShare,
  onChangeTier,
  onRemove,
}: ShareContactModalProps) {
  const [step, setStep] = useState<"browse" | "configure">("browse");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<Teammate[]>([]);
  const [pendingTier, setPendingTier] = useState<AccessTier>("view");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset to a clean browse view every time the modal opens.
  useEffect(() => {
    if (open) {
      setStep("browse");
      setQuery("");
      setPickerOpen(false);
      setPending([]);
      setPendingTier("view");
    }
  }, [open]);

  const sharedIds = useMemo(() => new Set(shares.map((s) => s.member.id)), [shares]);
  const pendingIds = useMemo(() => new Set(pending.map((m) => m.id)), [pending]);
  // Nobody who's already on the record can be added to it: the current user,
  // the owner, the assignee, anyone shared in, and anyone staged to be.
  const accountableIds = useMemo(() => {
    const ids: string[] = [];
    if (ownership.owner.kind === "person") ids.push(ownership.owner.user.id);
    if (ownership.assignee) ids.push(ownership.assignee.id);
    return ids;
  }, [ownership]);
  const excludeIds = useMemo(
    () =>
      new Set<string>([
        CURRENT_USER.id,
        ...accountableIds,
        ...sharedIds,
        ...pendingIds,
      ]),
    [accountableIds, sharedIds, pendingIds],
  );
  const youSuffix = (id: string) => (id === CURRENT_USER.id ? " (you)" : "");

  const openPicker = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setPickerOpen(true);
  };
  // Delay close so a click on a picker row registers before blur hides it.
  const scheduleClosePicker = () => {
    blurTimer.current = setTimeout(() => setPickerOpen(false), 120);
  };

  const pickMember = (member: Teammate) => {
    setPending((prev) => [...prev, member]);
    setQuery("");
    setPickerOpen(false);
    setStep("configure");
  };

  const removePending = (id: string) =>
    setPending((prev) => prev.filter((m) => m.id !== id));

  const handleShare = () => {
    if (pending.length === 0) return;
    onShare(pending.map((m) => m.id), pendingTier);
    setPending([]);
    setPendingTier("view");
    setQuery("");
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
          <Modal.Title>Share “{contactName}”</Modal.Title>
        </Modal.Header>

        {step === "browse" ? (
          <>
            <Modal.Body className="d-flex flex-column gap-3">
              <div className="position-relative">
                <Input
                  placeholder="Add people, groups, spaces"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={openPicker}
                  onBlur={scheduleClosePicker}
                />
                {pickerOpen && (
                  <MemberPicker
                    query={query}
                    excludeIds={excludeIds}
                    onPick={pickMember}
                  />
                )}
              </div>

              <p className="fs-small text-muted mb-0 d-flex gap-2 align-items-start">
                {ownership.isPrivate && (
                  <FontAwesomeIcon icon={faLock} className="mt-1 flex-shrink-0" />
                )}
                <span>{visibilityLine(ownership)}</span>
              </p>

              <div className="d-flex flex-column gap-1">
                <span className="fw-semibold">People with access</span>

                {/* Owner — the company, or the person whose book this is. */}
                {ownership.owner.kind === "company" ? (
                  <AccessRow
                    avatar={
                      <Avatar size="lg" className="flex-shrink-0">
                        <Avatar.Fallback className="bg-storm-grey-100 text-storm-grey-700">
                          <FontAwesomeIcon icon={faBuilding} />
                        </Avatar.Fallback>
                      </Avatar>
                    }
                    name={ownership.owner.name}
                    sub="Everyone at the company can see this contact"
                    trailing={<span className="text-muted flex-shrink-0">Owner</span>}
                  />
                ) : (
                  <AccessRow
                    avatar={<MemberAvatar member={ownership.owner.user} size="lg" />}
                    name={`${ownership.owner.user.name}${youSuffix(ownership.owner.user.id)}`}
                    sub={ownership.owner.user.email}
                    trailing={<span className="text-muted flex-shrink-0">Owner</span>}
                  />
                )}

                {/* Assignee — only when they aren't also the owner. Assignment
                    is accountability, not a share, so it carries no tier. */}
                {ownership.owner.kind === "company" && ownership.assignee && (
                  <AccessRow
                    avatar={<MemberAvatar member={ownership.assignee} size="lg" />}
                    name={`${ownership.assignee.name}${youSuffix(ownership.assignee.id)}`}
                    sub={ownership.assignee.email}
                    trailing={<span className="text-muted flex-shrink-0">Assigned</span>}
                  />
                )}

                {/* Shared members */}
                {shares.map((s) => (
                  <div key={s.member.id} className="d-flex align-items-center gap-2 py-2">
                    <MemberAvatar member={s.member} size="lg" />
                    <span className="d-flex flex-column lh-sm flex-grow-1 min-w-0">
                      <span className="fw-semibold text-truncate">{s.member.name}</span>
                      <span className="fs-small text-muted text-truncate">
                        {s.member.email}
                      </span>
                    </span>
                    <Select
                      value={s.tier}
                      onValueChange={(value) => {
                        const v = value as string;
                        if (v === "__remove") onRemove(s.member.id);
                        else onChangeTier(s.member.id, v as AccessTier);
                      }}
                    >
                      <Select.Trigger className="flex-shrink-0" style={{ width: 150 }}>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {ACCESS_TIERS.map((t) => (
                          <Select.Item key={t.value} value={t.value}>
                            {t.label}
                          </Select.Item>
                        ))}
                        <Select.Separator />
                        <Select.Item value="__remove">Remove access</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                ))}
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Modal.Close render={<Button variant="ghost" />}>Cancel</Modal.Close>
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
                  <MemberPicker
                    query={query}
                    excludeIds={excludeIds}
                    onPick={(m) => {
                      setPending((prev) => [...prev, m]);
                      setQuery("");
                      setPickerOpen(false);
                    }}
                  />
                )}
              </div>

              <RadioGroup
                value={pendingTier}
                onValueChange={(value) => setPendingTier(value as AccessTier)}
              >
                {ACCESS_TIERS.map((t) => (
                  <label
                    key={t.value}
                    htmlFor={`tier-${t.value}`}
                    className="share-modal__tier d-flex gap-2 p-2 rounded-3 mb-0"
                  >
                    <RadioGroup.Item
                      value={t.value}
                      id={`tier-${t.value}`}
                      className="mt-1 flex-shrink-0"
                    />
                    <span className="d-flex flex-column lh-sm">
                      <span className="fw-semibold">{t.label}</span>
                      <span className="fs-small text-muted">{t.description}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
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
