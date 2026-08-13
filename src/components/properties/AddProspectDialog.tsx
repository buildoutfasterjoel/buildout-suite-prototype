import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleNotch,
  faBuilding,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Property } from "#/data/types";
import { addProspectWithOwner } from "#/data/prospectActions";
import { useOwnerCredits } from "#/data/ownerCredits";

/** How long each result line spins before it settles. */
const SETTLE_MS = 600;

/**
 * One line of the result step: spinner until it settles, then a green check.
 *
 * The work behind both lines is synchronous and already finished by the time
 * this renders — same as the assistant's action checklist, the pacing is
 * presentational. It earns its place by sequencing: the property is filed, then
 * the owner is looked up, and watching them resolve in that order is what tells
 * you the credit was spent on a second, separate step rather than bundled into
 * the save.
 */
function ResultLine({
  settled,
  title,
  detail,
}: {
  settled: boolean;
  title: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className="d-flex align-items-start gap-2">
      <span
        className="flex-shrink-0 mt-1"
        style={{ width: 16, textAlign: "center" }}
      >
        {settled ? (
          <FontAwesomeIcon icon={faCircleCheck} className="text-success" />
        ) : (
          <FontAwesomeIcon
            icon={faCircleNotch}
            spin
            className="text-purple-heart-600"
          />
        )}
      </span>
      <div>
        <div className="fw-semibold">{title}</div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

/**
 * Add Property — the tile CTA's dialog.
 *
 * One decision, then one outcome. The checkbox is the only branch: filing the
 * record is free, and only the owner contact costs a credit. After saving, the
 * dialog stays open on a result step rather than dumping the user back on the
 * list, because the two things they want next — the property record and the
 * contact just found — are both one click away and neither is where they are.
 */
export function AddProspectDialog({
  property,
  open,
  onOpenChange,
}: {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [includeOwner, setIncludeOwner] = useState(true);
  const [saved, setSaved] = useState<{
    contact: Contact | null;
    creditSpent: boolean;
  } | null>(null);

  /** How many result lines have settled. Drives the spinner → check flip. */
  const [settled, setSettled] = useState(0);

  const balance = useOwnerCredits((s) => s.balance);
  const alreadyUnlocked = useOwnerCredits((s) =>
    property ? s.unlocked.has(property.id) : false,
  );

  // Reset to the decision step whenever a different record opens the dialog,
  // so a previous add's result can never be shown against a new property.
  useEffect(() => {
    if (open) {
      setSaved(null);
      setSettled(0);
      setIncludeOwner(true);
    }
  }, [open, property?.id]);

  // Settle the result lines one at a time, in the order the work happened.
  useEffect(() => {
    if (!saved) return;
    const lines = saved.contact ? 2 : 1;
    if (settled >= lines) return;
    const t = setTimeout(() => setSettled((n) => n + 1), SETTLE_MS);
    return () => clearTimeout(t);
  }, [saved, settled]);

  if (!property) return null;

  const address = property.street || property.name;

  const handleSave = () => {
    const result = addProspectWithOwner(property, includeOwner);
    setSaved({ contact: result.contact, creditSpent: result.creditSpent });
  };

  const goTo = (to: () => void) => {
    onOpenChange(false);
    to();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" centered style={{ maxWidth: "34.375rem" }}>
        <Modal.Header className="border-bottom" style={{ padding: "20px 24px" }}>
          <Modal.Title>{saved ? "Property added" : "Add Property"}</Modal.Title>
          <Modal.Description>{address}</Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3" style={{ padding: 24 }}>
          {saved ? (
            <>
              <ResultLine
                settled={settled >= 1}
                title={
                  settled >= 1
                    ? `${address} is now in your properties.`
                    : `Adding ${address}…`
                }
                detail="No deal was created — the record is yours to work when you're ready."
              />

              {saved.contact && (
                <ResultLine
                  settled={settled >= 2}
                  title={
                    settled >= 2
                      ? `Owner contact found: ${saved.contact.firstName} ${saved.contact.lastName}`
                      : "Looking up owner contact…"
                  }
                  detail={
                    settled >= 2 ? (
                      <>
                        {saved.creditSpent
                          ? "1 owner unlock credit used. "
                          : "No credit used — this owner was already unlocked. "}
                        Saved to your contacts and linked to the property.
                      </>
                    ) : (
                      "Searching public records and researched sources."
                    )
                  }
                />
              )}
            </>
          ) : (
            <>
              <label className="d-flex align-items-start gap-2 mb-0">
                <Checkbox
                  checked={includeOwner}
                  onCheckedChange={(v) => setIncludeOwner(v === true)}
                  aria-label="Include owner contact data"
                  className="mt-1"
                />
                <span>
                  <span className="fw-semibold">Include owner contact data</span>
                  <span
                    className="d-block text-muted"
                    style={{ fontSize: 13 }}
                  >
                    {alreadyUnlocked
                      ? "You have already unlocked the owner for this property, so this will not use a credit."
                      : "This will expend an owner unlock credit unless you have previously unlocked the owner for this property."}
                  </span>
                </span>
              </label>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {balance.toLocaleString()} credits available this billing cycle.
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="border-top" style={{ padding: 16 }}>
          {saved ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              {saved.contact && (
                <Button
                  variant="outline"
                  onClick={() =>
                    goTo(() =>
                      void navigate({
                        to: "/backoffice/contacts/$contactId",
                        params: { contactId: saved.contact!.id },
                      }),
                    )
                  }
                >
                  <FontAwesomeIcon icon={faUser} />
                  View Contact
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() =>
                  goTo(() =>
                    void navigate({
                      to: "/properties/$propertyId",
                      params: { propertyId: property.id },
                    }),
                  )
                }
              >
                <FontAwesomeIcon icon={faBuilding} />
                View Property
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave}>
                Save Property
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
