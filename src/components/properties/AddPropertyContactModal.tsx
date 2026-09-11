import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlus, faUser } from "@fortawesome/pro-regular-svg-icons";
import type { PropertyContactRole } from "#/data/types";
import { getContactOptions, getProperty, type ContactOption } from "#/data/store";
import { createContact, linkContactToProperty, setContactPrivate } from "#/data/actions";
import {
  contactRoleFor,
  PROPERTY_CONTACT_ROLE_LABELS,
  PROPERTY_CONTACT_ROLES,
  SPACE_LEVEL_ROLES,
} from "#/data/propertyContacts";
import { RelationshipPill } from "#/components/contacts/pills";
import { notify } from "#/lib/notify";

type Visibility = "public" | "private";

/**
 * Buildout's "Add contact" modal from the property record's Contacts tab:
 * search the book (or create someone new), give them a role on the property,
 * set who can see them. Three fields, so plain stacked `Field`s.
 *
 * With `unitId` the same modal adds a contact to one *space*. Only the
 * tenant-side roles are offered there — owner-side roles describe the building
 * and are inherited by every space, so attaching one to a suite would be a
 * second, divergent copy of a fact the property already holds.
 */
export function AddPropertyContactModal({
  propertyId,
  unitId,
  unitLabel,
  open,
  onOpenChange,
}: {
  propertyId: string;
  unitId?: string;
  unitLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const property = getProperty(propertyId);
  const roles = unitId ? SPACE_LEVEL_ROLES : PROPERTY_CONTACT_ROLES;
  const roleItems = roles.map((value) => ({ value, label: PROPERTY_CONTACT_ROLE_LABELS[value] }));
  const contactOptions = useMemo<ContactOption[]>(getContactOptions, []);

  const [contactOption, setContactOption] = useState<ContactOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<PropertyContactRole | "">("");
  const [visibility, setVisibility] = useState<Visibility>("public");

  // Reset when the modal (re)opens.
  const [seededOpen, setSeededOpen] = useState(false);
  if (open && !seededOpen) {
    setContactOption(null);
    setCreating(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setCompany("");
    setRole("");
    setVisibility("public");
    setSeededOpen(true);
  }
  if (!open && seededOpen) setSeededOpen(false);

  if (!property) return null;

  const personOk = creating ? firstName.trim().length > 0 && lastName.trim().length > 0 : contactOption != null;
  const canAdd = personOk && role !== "";

  const commit = () => {
    if (!canAdd) return;
    const chosenRole = role as PropertyContactRole;
    const link = { propertyId, role: chosenRole, unitId: unitId ?? null };
    let contactId: string;
    let name: string;
    if (creating) {
      const { contact } = createContact({
        firstName,
        lastName,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        role: contactRoleFor(chosenRole),
        propertyLinks: [link],
      });
      contactId = contact.id;
      name = `${contact.firstName} ${contact.lastName}`.trim();
    } else {
      contactId = contactOption!.value;
      name = contactOption!.name;
      linkContactToProperty(contactId, link);
    }
    if (visibility === "private") setContactPrivate(contactId, true);
    notify({
      title: `${name} added to ${unitLabel ?? property.name}`,
      description: PROPERTY_CONTACT_ROLE_LABELS[chosenRole],
    });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered>
        <Modal.Header>
          <Modal.Title>Add contact</Modal.Title>
          <Modal.Description>
            {unitId
              ? `Attach someone to ${unitLabel ?? "this space"}. Owner-side contacts come from ${property.name} and apply to every space.`
              : `Attach someone from your book to ${property.name}, or create them here.`}
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          {creating ? (
            <>
              <div className="d-flex gap-3">
                <Field className="flex-grow-1">
                  <Field.Label>First name</Field.Label>
                  <Input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field className="flex-grow-1">
                  <Field.Label>Last name</Field.Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </div>
              <div className="d-flex gap-3">
                <Field className="flex-grow-1">
                  <Field.Label>Email</Field.Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field className="flex-grow-1">
                  <Field.Label>Company</Field.Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                </Field>
              </div>
              <Button variant="ghost" size="sm" className="align-self-start" onClick={() => setCreating(false)}>
                Search existing contacts instead
              </Button>
            </>
          ) : (
            <Field>
              <Field.Label>Person or company</Field.Label>
              <Combobox
                items={contactOptions}
                value={contactOption}
                onValueChange={(v) => setContactOption(v as ContactOption | null)}
              >
                <Combobox.InputGroup>
                  <InputGroup.Addon>
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </InputGroup.Addon>
                  <Combobox.Input placeholder="Enter contact name or email" showClear />
                </Combobox.InputGroup>
                <Combobox.Content>
                  <Combobox.Empty className="text-muted">No matching contacts</Combobox.Empty>
                  <Combobox.List>
                    {(item: ContactOption) => {
                      const meta = [item.title, item.company].filter(Boolean).join(" · ");
                      return (
                        <Combobox.Item key={item.value} value={item}>
                          <span className="d-flex gap-2 user-select-none" style={{ minWidth: 0 }}>
                            <FontAwesomeIcon icon={faUser} className="text-muted flex-shrink-0 d-inline-block mt-1" />
                            <span className="d-flex flex-column" style={{ minWidth: 0 }}>
                              <span className="d-flex align-items-center gap-2">
                                <span className="text-truncate">{item.name}</span>
                                <span className="flex-shrink-0">
                                  <RelationshipPill value={item.relationship} />
                                </span>
                              </span>
                              {meta && <span className="text-muted fs-small text-truncate">{meta}</span>}
                            </span>
                          </span>
                        </Combobox.Item>
                      );
                    }}
                  </Combobox.List>
                </Combobox.Content>
              </Combobox>
              {/* Production puts "+ Create new contact" at the foot of the list;
                  here it sits under the field so it is reachable without opening it. */}
              <Button variant="ghost" size="sm" className="align-self-start mt-1" onClick={() => setCreating(true)}>
                <FontAwesomeIcon icon={faPlus} />
                Create new contact
              </Button>
            </Field>
          )}

          <Field>
            <Field.Label>Role</Field.Label>
            <Select items={roleItems} value={role} onValueChange={(v) => setRole(v as PropertyContactRole)}>
              <Select.Trigger>
                <Select.Value placeholder="Choose from the dropdown" />
              </Select.Trigger>
              <Select.Content>
                {roleItems.map((o) => (
                  <Select.Item key={o.value} value={o.value}>
                    {o.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field>
            <Field.Label>Contact Visibility</Field.Label>
            <Select
              items={[
                { value: "public", label: "Public" },
                { value: "private", label: "Private" },
              ]}
              value={visibility}
              onValueChange={(v) => setVisibility(v as Visibility)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="public">Public</Select.Item>
                <Select.Item value="private">Private</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!canAdd} onClick={commit}>
            Add contact
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
