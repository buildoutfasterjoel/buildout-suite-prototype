import { useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import type { PropertyType, PropertyUnit, UnitType } from "#/data/types";
import { getProperty, addPropertyUnit, updatePropertyUnit } from "#/data/store";
import { isDuplicateSpaceLabel } from "#/data/propertySpaces";
import { notify } from "#/lib/notify";
import { UNIT_TYPE_LABELS } from "./propertySpaceDisplay";

/**
 * All five unit types, unlike the deal-side `AddSpaceModal`, which drops
 * Residential because what it adds is immediately spun into a lease. This adds
 * to the asset record and nothing more, so a residential unit is a fine space.
 */
const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = (
  ["office", "retail", "industrial", "residential", "other"] as UnitType[]
).map((value) => ({ value, label: UNIT_TYPE_LABELS[value] }));

/** The seed's own property-type → unit-type default. */
function defaultUnitType(propertyType: PropertyType): UnitType {
  if (propertyType === "multifamily") return "residential";
  if (propertyType === "office" || propertyType === "retail" || propertyType === "industrial") {
    return propertyType;
  }
  return "other";
}

type Draft = {
  label: string;
  unitType: UnitType;
  sqft: number | null;
  suite: string;
  floor: number | null;
};

function draftFrom(unit: PropertyUnit | undefined, propertyType: PropertyType): Draft {
  return {
    label: unit?.label ?? "",
    unitType: unit?.unitType ?? defaultUnitType(propertyType),
    sqft: unit?.sqft ?? null,
    suite: unit?.suite ?? "",
    floor: unit?.floor ?? null,
  };
}

/**
 * Create a space on a property — or, with `unit`, edit one. Creating a space is
 * adding a `PropertyUnit`: label, type, size, suite, floor. Five fields, so
 * plain stacked `Field`s rather than the long-form record shell.
 *
 * Both modes write the unit directly. The space deal's Details form writes the
 * same physical fields through `saveSpaceDetails`, so there is one record and
 * the two forms cannot disagree.
 */
export function CreateSpaceModal({
  propertyId,
  unit,
  open,
  onOpenChange,
}: {
  propertyId: string;
  /** When set, the modal edits this unit instead of creating one. */
  unit?: PropertyUnit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const property = getProperty(propertyId);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Seed local state when the modal (re)opens, from the unit being edited or blank.
  const [seededOpen, setSeededOpen] = useState(false);
  if (open && !seededOpen && property) {
    setDraft(draftFrom(unit, property.propertyType));
    setSeededOpen(true);
  }
  if (!open && seededOpen) setSeededOpen(false);

  if (!property || !draft) return null;

  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...(prev ?? draft), ...next }));

  const trimmedLabel = draft.label.trim();
  const duplicate = isDuplicateSpaceLabel(property, trimmedLabel, unit?.id);
  const canSave = trimmedLabel.length > 0 && (draft.sqft ?? 0) > 0 && !duplicate;

  const commit = () => {
    if (!canSave) return;
    const fields = {
      label: trimmedLabel,
      unitType: draft.unitType,
      sqft: draft.sqft as number,
      suite: draft.suite.trim() || null,
      floor: draft.floor,
    };
    if (unit) {
      updatePropertyUnit(propertyId, unit.id, fields);
      notify({ title: "Space saved" });
    } else {
      addPropertyUnit(propertyId, fields);
      notify({ title: "Space added" });
    }
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content scrollable centered>
        <Modal.Header>
          <Modal.Title>{unit ? "Edit space" : "Add space"}</Modal.Title>
          <Modal.Description>
            {unit
              ? `Update ${unit.label} on ${property.name}.`
              : `Add a space to ${property.name}. You can start a deal on it from its page.`}
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <Field>
            <Field.Label>Label</Field.Label>
            <Input
              autoFocus
              value={draft.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="e.g. Suite 200, Bay 4, Pad C"
              className={duplicate ? "is-invalid" : undefined}
            />
            {/* The message is rendered directly rather than through
                `Field.Error`: Base UI gates that on the field's own validity
                state, which a cross-record check (against the property's other
                units) never trips. Same `invalid-feedback` class, so it reads
                identically to a native error. */}
            {duplicate && (
              <div className="invalid-feedback d-block" role="alert">
                A space named &ldquo;{trimmedLabel}&rdquo; already exists on this property.
              </div>
            )}
          </Field>

          <Field>
            <Field.Label>Unit type</Field.Label>
            <Select
              items={UNIT_TYPE_OPTIONS}
              value={draft.unitType}
              onValueChange={(v) => patch({ unitType: v as UnitType })}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {UNIT_TYPE_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>
                    {o.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field>
            <Field.Label>Size (SF)</Field.Label>
            <Input
              type="number"
              min={1}
              value={draft.sqft ?? ""}
              onChange={(e) => patch({ sqft: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>

          <div className="d-flex gap-3">
            <Field className="flex-grow-1">
              <Field.Label>Suite</Field.Label>
              <Input value={draft.suite} onChange={(e) => patch({ suite: e.target.value })} placeholder="200" />
            </Field>
            <Field style={{ width: 140 }}>
              <Field.Label>Floor</Field.Label>
              <Input
                type="number"
                value={draft.floor ?? ""}
                onChange={(e) => patch({ floor: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!canSave} onClick={commit}>
            {unit ? "Save" : "Add space"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
