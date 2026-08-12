import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faBuilding,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Property } from "#/data/types";
import { addProspectWithOwner } from "#/data/prospectActions";
import { useOwnerCredits } from "#/data/ownerCredits";

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

  const balance = useOwnerCredits((s) => s.balance);
  const alreadyUnlocked = useOwnerCredits((s) =>
    property ? s.unlocked.has(property.id) : false,
  );

  // Reset to the decision step whenever a different record opens the dialog,
  // so a previous add's result can never be shown against a new property.
  useEffect(() => {
    if (open) {
      setSaved(null);
      setIncludeOwner(true);
    }
  }, [open, property?.id]);

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
              <div className="d-flex align-items-start gap-2">
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className="text-success mt-1"
                />
                <div>
                  <div className="fw-semibold">
                    {address} is now in your properties.
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    No deal was created — the record is yours to work when
                    you&apos;re ready.
                  </div>
                </div>
              </div>

              {saved.contact && (
                <div className="d-flex align-items-start gap-2">
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="text-success mt-1"
                  />
                  <div>
                    <div className="fw-semibold">
                      Owner contact found: {saved.contact.firstName}{" "}
                      {saved.contact.lastName}
                    </div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      {saved.creditSpent
                        ? "1 owner unlock credit used. "
                        : "No credit used — this owner was already unlocked. "}
                      Saved to your contacts and linked to the property.
                    </div>
                  </div>
                </div>
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
