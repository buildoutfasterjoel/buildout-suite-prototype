import { useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import type { UnitType } from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import { addSpaceToDeal, addPropertyUnit } from "#/data/leaseSpaces";

/**
 * Commercial types only. A space added here is immediately spun into a lease
 * deal, and housing is a property-management assignment rather than a lease — so
 * `residential` is absent even though `UnitType` still allows it for units that
 * live on the property record without ever being leased.
 */
const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
  { value: "other", label: "Other" },
];

export function AddSpaceModal({
  parentDealId,
  open,
  onOpenChange,
  onAdded,
}: {
  parentDealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}) {
  const deal = getListing(parentDealId);
  const property = deal ? getProperty(deal.propertyId) : undefined;

  const [newLabel, setNewLabel] = useState("");
  const [newSqft, setNewSqft] = useState<number | null>(null);
  const [newType, setNewType] = useState<UnitType>("retail");

  // Reset local state when the modal (re)opens.
  const [seededOpen, setSeededOpen] = useState(false);
  if (open && !seededOpen) {
    setNewLabel("");
    setNewSqft(null);
    setNewType("retail");
    setSeededOpen(true);
  }
  if (!open && seededOpen) setSeededOpen(false);

  if (!deal || !property) return null;

  const canAdd = newLabel.trim().length > 0 && (newSqft ?? 0) > 0;

  const commit = () => {
    if (!canAdd) return;
    // A suite added here is being added *in order to* market it, so it starts
    // vacant. The unit lands on the property record first, then gets its deal —
    // the case this modal exists for is a broker who learns a suite was carved
    // out of the building.
    const unit = addPropertyUnit(deal.propertyId, {
      label: newLabel.trim(),
      sqft: newSqft as number,
      unitType: newType,
    });
    if (unit) addSpaceToDeal(parentDealId, unit.id);
    onOpenChange(false);
    onAdded?.();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>Add space</Modal.Title>
          <Modal.Description>
            Add a suite to {property.name} and start its deal. Suites already on
            the property are listed on the Spaces page.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <div className="d-flex gap-2">
            <Field className="flex-grow-1">
              <Field.Label>Label</Field.Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Suite 300"
              />
            </Field>
            <Field style={{ width: 140 }}>
              <Field.Label>SF</Field.Label>
              <Input
                type="number"
                value={newSqft ?? ""}
                onChange={(e) => setNewSqft(e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
            <Field style={{ width: 160 }}>
              <Field.Label>Type</Field.Label>
              <Select
                items={UNIT_TYPE_OPTIONS}
                value={newType}
                onValueChange={(v) => setNewType(v as UnitType)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {UNIT_TYPE_OPTIONS.map((o) => (
                    <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </div>
          <div className="form-text text-muted">
            A new space is added to the property record, then spun into a deal.
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!canAdd} onClick={commit}>
            Add space
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
