import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faXmark } from "@fortawesome/pro-regular-svg-icons";
import {
  ACCESS_TIERS,
  CURRENT_USER,
  TEAMMATES,
  type AccessTier,
  type ContactShare,
  type Teammate,
} from "#/data/teammates";

interface ShareContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
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
  member: Teammate;
  size?: "sm" | "lg";
}) {
  return (
    <Avatar size={size} className="flex-shrink-0">
      {member.avatarUrl && <Avatar.Image src={member.avatarUrl} alt={member.name} />}
      <Avatar.Fallback className="fw-semibold">{member.initials}</Avatar.Fallback>
    </Avatar>
  );
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
  const excludeIds = useMemo(
    () => new Set<string>([CURRENT_USER.id, ...sharedIds, ...pendingIds]),
    [sharedIds, pendingIds],
  );

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

              <div className="d-flex flex-column gap-1">
                <span className="fw-semibold">People with access</span>

                {/* Owner */}
                <div className="d-flex align-items-center gap-2 py-2">
                  <MemberAvatar member={CURRENT_USER} size="lg" />
                  <span className="d-flex flex-column lh-sm flex-grow-1 min-w-0">
                    <span className="fw-semibold text-truncate">
                      {CURRENT_USER.name} (you)
                    </span>
                    <span className="fs-small text-muted text-truncate">
                      {CURRENT_USER.email}
                    </span>
                  </span>
                  <span className="text-muted flex-shrink-0">Owner</span>
                </div>

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
