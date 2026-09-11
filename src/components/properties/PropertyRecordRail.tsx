import { useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Comp, Listing, Property } from "#/data/types";
import { useCreateDeal } from "#/data/useCreateDeal";
import { PROPERTY_CONTACT_ROLE_LABELS, propertyContactRows } from "#/data/propertyContacts";
import { AddPropertyContactModal } from "./AddPropertyContactModal";
import { ContactSection } from "#/components/contacts/ContactSection";
import { ContactIdentityChip } from "#/components/contacts/ContactIdentityChip";
import { RecordDealCard } from "#/components/deals/RecordDealCard";
import { CompCard } from "./CompCard";

/** The "+" at a section's far right — the contact page's `SectionAction`, same glyph and size. */
export function RailAction({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Button variant="ghost" appearance="muted" size="icon-sm" aria-label={label} onClick={onClick}>
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        }
      />
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}



/**
 * The Property record's right rail: Deals, Contacts and Comps as the collapsible
 * sections the contact detail page uses (`ContactSection` inside a
 * `contact-overview-accordion`), with the redesigned cards inside them.
 *
 * Deals lists top-level deals. A lease shell's spaces show as the rollup badge
 * on the shell's card — the way the old card did — and, under it, a "Show N
 * space deals" toggle (the contact page's "Show Past Deals" control) that
 * reveals them as cards for whoever wants them in the rail. Collapsed by
 * default: a building with six suites in play is one card that says six, and
 * the Spaces tab is the place that lays the suites out.
 */
export function PropertyRecordRail({
  property,
  deals,
  comps,
}: {
  property: Property;
  deals: Listing[];
  comps: Comp[];
}) {
  // Read here rather than taken as a prop so the row carries its property role;
  // the layout subscribes to the contacts map, so an add repaints this.
  const contactRows = propertyContactRows(property.id);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const topLevel = deals.filter((d) => d.parentDealId == null);
  const childrenOf = (shellId: string) => deals.filter((d) => d.parentDealId === shellId);
  // Which shells have their space deals unfolded. Per shell, so two buildings'
  // worth of suites never open together.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    // No top rule: on the contact page it separates the accordion from the hero
    // above it, and here the accordion is the first thing in the card.
    <Accordion
      className="contact-overview-accordion contact-overview-accordion--legacy"
      style={{ borderTop: 0 }}
      multiple
      defaultValue={["deals", "contacts", "comps"]}
    >
      <ContactSection
        value="deals"
        label="Deals"
        count={topLevel.length}
        action={
          <RailAction label="Create New Deal" onClick={() => useCreateDeal.getState().openFor({ property })} />
        }
      >
        <div className="d-flex flex-column gap-2">
          {topLevel.length === 0 ? (
            <span className="text-muted fs-small">
              No deals yet. Start one from this property and it will show up here.
            </span>
          ) : (
            topLevel.map((d) => {
              const spaces = childrenOf(d.id);
              const open = expanded.has(d.id);
              return (
                <div key={d.id} className="d-flex flex-column gap-2">
                  <RecordDealCard listingId={d.id} />
                  {spaces.length > 0 && (
                    <>
                      <Button variant="ghost" className="w-100" onClick={() => toggle(d.id)}>
                        {open
                          ? "Hide space deals"
                          : `Show ${spaces.length} space deal${spaces.length > 1 ? "s" : ""}`}
                      </Button>
                      {open && spaces.map((s) => <RecordDealCard key={s.id} listingId={s.id} />)}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ContactSection>

      <ContactSection
        value="contacts"
        label="Contacts"
        count={contactRows.length}
        action={<RailAction label="Add Contact" onClick={() => setAddContactOpen(true)} />}
      >
        {contactRows.length === 0 ? (
          <span className="text-muted fs-small">No contacts linked to this property yet.</span>
        ) : (
          <div className="d-flex flex-column gap-2">
            {contactRows.map((r) => (
              <ContactIdentityChip
                key={r.contact.id}
                contact={r.contact}
                role={
                  PROPERTY_CONTACT_ROLE_LABELS[r.role] +
                  (r.unitId ? ` • ${property.units.find((u) => u.id === r.unitId)?.label ?? "space"}` : "")
                }
                secondary={r.contact.company}
              />
            ))}
          </div>
        )}
        <AddPropertyContactModal propertyId={property.id} open={addContactOpen} onOpenChange={setAddContactOpen} />
      </ContactSection>

      <ContactSection value="comps" label="Comps" count={comps.length}>
        {comps.length === 0 ? (
          <span className="text-muted fs-small">No comps recorded.</span>
        ) : (
          <div className="d-flex flex-column gap-2">
            {comps.map((comp) => (
              <CompCard key={comp.id} comp={comp} />
            ))}
          </div>
        )}
      </ContactSection>
    </Accordion>
  );
}
