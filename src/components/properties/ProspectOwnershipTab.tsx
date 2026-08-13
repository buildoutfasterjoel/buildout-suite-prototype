import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle,
  faUserPlus,
  faCircleCheck,
  faKey,
  faSparkles,
  faPhone,
  faEnvelope,
  faCircleInfo,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { useOwnerCredits, type LookupDepth } from "#/data/ownerCredits";
import {
  unlockOwnerContacts,
  visibleOwnerContacts,
} from "#/data/prospectActions";
import {
  getProspectOwnership,
  ownerContactName,
  type ProspectOwnerContact,
} from "#/data/prospectOwners";
import { formatPrice } from "./propertyDisplay";

/** What saving a researched owner actually does, shown on the info affordance. */
const SAVE_CONTACT_EXPLAINER =
  "Adding a contact will automatically associate it with the property. If a property does not exist, it will get created.";

/**
 * One labelled fact, as a definition row rather than a filled tile.
 *
 * The grey blocks gave seven equal-weight cards to a screen whose actual
 * headline is one line — who owns it. Rules instead of fills let the values
 * carry the emphasis and let the eye run down a column, which is how anyone
 * reads a facts table.
 */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d-flex justify-content-between gap-3 border-bottom py-2">
      <span className="text-muted text-nowrap">{label}</span>
      <span className="fw-semibold text-end">{value}</span>
    </div>
  );
}

/**
 * The Ownership tab of the prospect flyout.
 *
 * Two tiers, split by the paywall. Who owns the building comes from public
 * records and renders immediately; the people you'd actually call are behind
 * the credit. That boundary is the whole screen — everything above the CTA is
 * free, everything below it was bought.
 */
export function ProspectOwnershipTab({
  property,
  onSaveContact,
}: {
  property: Property;
  /** Saves one researched owner to the CRM. */
  onSaveContact: (owner: ProspectOwnerContact) => void;
}) {
  const ownership = useMemo(() => getProspectOwnership(property), [property]);
  const depth = useOwnerCredits((s) => s.unlocked.get(property.id) ?? null);
  const balance = useOwnerCredits((s) => s.balance);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  // Subscribed so a contact saved from this list flips to its saved state
  // without waiting for the flyout to be reopened.
  const contactsMap = useDataStore((s) => s.contacts);

  const contacts = depth ? visibleOwnerContacts(property, depth) : [];

  const runLookup = (next: LookupDepth) => {
    unlockOwnerContacts(property, next);
    setFetchedAt(new Date().toLocaleDateString());
  };

  return (
    <div className="d-flex flex-column gap-4">
      <section className="d-flex flex-column gap-3">
        {/* The owner is the headline, not one fact among seven — it leads at
            title weight with the qualifiers as badges beneath it, and the rest
            drops to a two-column facts table. */}
        {/* The icon rides inline with the eyebrow rather than in its own gutter
            column — a 28px glyph beside a two-line block left a wedge of white
            space under it and pushed the whole section off the left edge the
            facts table below sits on. */}
        <div style={{ minWidth: 0 }}>
          <div
            className="text-muted d-flex align-items-center gap-2"
            style={{ fontSize: 12 }}
          >
            <FontAwesomeIcon
              icon={faUserCircle}
              className="text-primary"
              style={{ fontSize: 14 }}
            />
            Owner of record
          </div>
          <div className="fs-5 fw-semibold">{ownership.ownerName}</div>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
            <Badge variant="secondary" appearance="muted">
              {ownership.ownerType}
            </Badge>
            <Badge variant="secondary" appearance="muted">
              {ownership.ownerOccupied ? "Owner occupied" : "Not owner occupied"}
            </Badge>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {ownership.ownerAddress}
            </span>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-md-6">
            <Fact
              label="Properties nationally"
              value={
                ownership.portfolioCount > 1
                  ? `${ownership.portfolioCount} properties`
                  : "None on record"
              }
            />
            <Fact
              label="Total tax assessed value"
              value={formatPrice(ownership.totalAssessedValue)}
            />
          </div>
          <div className="col-md-6">
            <Fact
              label="Property types held"
              value={ownership.propertyTypes.join(", ")}
            />
            {/* This building's own assessment, next to the portfolio total —
                the pair is what tells you how big a fish the owner is. */}
            <Fact
              label="Assessed value, this property"
              value={formatPrice(property.assessedTaxValue)}
            />
          </div>
        </div>
      </section>

      {depth === null ? (
        <Card>
          <Card.Body className="d-flex align-items-start gap-3 flex-wrap">
            <FontAwesomeIcon icon={faKey} className="text-primary mt-1" />
            <div className="flex-grow-1" style={{ minWidth: 240 }}>
              <div className="fw-semibold">
                Use a credit to unlock the owner contacts for this property.
              </div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                You have {balance.toLocaleString()} credits available this
                billing cycle. If contact information is found for this
                property, it will cost 1 credit.
              </div>
            </div>
            <div className="d-flex flex-row align-items-center gap-2">
              <Button variant="outline" onClick={() => runLookup("quick")}>
                Quick Lookup
              </Button>
              <Button variant="primary" onClick={() => runLookup("in-depth")}>
                <FontAwesomeIcon icon={faSparkles} />
                In-depth Owner Lookup
              </Button>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <>
          {depth === "in-depth" && ownership.relatedCompany && (
            <section className="d-flex flex-column gap-2">
              <h3 className="fs-large fw-semibold mb-0">Related Companies</h3>
              <Card>
                <Card.Body className="d-flex flex-column gap-1">
                  <Badge
                    variant="secondary"
                    appearance="muted"
                    className="align-self-start d-inline-flex align-items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faSparkles} />
                    AI Research
                  </Badge>
                  <div className="fw-semibold">
                    {ownership.relatedCompany.name}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {ownership.relatedCompany.url}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {ownership.relatedCompany.note}
                  </div>
                </Card.Body>
              </Card>
            </section>
          )}

          <section className="d-flex flex-column gap-2">
            <div className="d-flex align-items-baseline justify-content-between gap-2">
              <h3 className="fs-large fw-semibold mb-0">Contacts</h3>
              {depth === "quick" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-decoration-none"
                  onClick={() => runLookup("in-depth")}
                >
                  Run in-depth lookup (no additional credit)
                </Button>
              )}
            </div>
            {fetchedAt && (
              <div className="text-muted" style={{ fontSize: 12 }}>
                Fetched on {fetchedAt}
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              {contacts.map((c) => {
                const saved = contactsMap.get(c.id);
                return (
                  <div
                    key={c.id}
                    className="border rounded d-flex align-items-center gap-3"
                    style={{ padding: 12 }}
                  >
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-semibold">
                          {ownerContactName(c)}
                        </span>
                        {c.aiSourced && (
                          <Badge
                            variant="secondary"
                            appearance="muted"
                            className="d-inline-flex align-items-center gap-1"
                          >
                            <FontAwesomeIcon icon={faSparkles} />
                            AI Sourced
                          </Badge>
                        )}
                      </div>
                      <div
                        className="text-muted d-flex align-items-center gap-3"
                        style={{ fontSize: 12 }}
                      >
                        <span>{c.title}</span>
                        <span className="d-inline-flex align-items-center gap-1">
                          <FontAwesomeIcon icon={faPhone} />
                          {c.phones.length}{" "}
                          {c.phones.length === 1 ? "Phone" : "Phones"}
                        </span>
                        {c.emails.length > 0 && (
                          <span className="d-inline-flex align-items-center gap-1">
                            <FontAwesomeIcon icon={faEnvelope} />
                            {c.emails.length}{" "}
                            {c.emails.length === 1 ? "Email" : "Emails"}
                          </span>
                        )}
                      </div>
                    </div>

                    {saved ? (
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={
                          <Link
                            to="/backoffice/contacts/$contactId"
                            params={{ contactId: c.id }}
                          />
                        }
                      >
                        <FontAwesomeIcon icon={faCircleCheck} />
                        View Contact
                      </Button>
                    ) : (
                      // Saving is additive and instantly reversible by its own
                      // result — the row turns into View Contact — so it takes
                      // the action directly. The caveat the confirm step used
                      // to carry (a property may be created too) rides along in
                      // the info tooltip instead of blocking the click.
                      // Info sits to the *left* of the button: its tooltip then
                      // opens inboard instead of against the panel edge, and
                      // with rows in mixed states the buttons still line up on
                      // the right regardless of which label they carry.
                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <Tooltip>
                          <Tooltip.Trigger
                            render={
                              <button
                                type="button"
                                className="btn btn-link text-muted p-0 d-inline-flex"
                                aria-label={SAVE_CONTACT_EXPLAINER}
                              >
                                <FontAwesomeIcon icon={faCircleInfo} />
                              </button>
                            }
                          />
                          <Tooltip.Content side="top" style={{ maxWidth: 280 }}>
                            {SAVE_CONTACT_EXPLAINER}
                          </Tooltip.Content>
                        </Tooltip>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSaveContact(c)}
                        >
                          <FontAwesomeIcon icon={faUserPlus} />
                          Save Contact
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* The owner of record, broken out — the number you'd actually dial. */}
          {contacts[0] && (
            <Card>
              <Card.Body className="d-flex flex-column gap-2">
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Owner
                </div>
                <div className="fw-semibold fs-large">
                  {ownerContactName(contacts[0])}
                </div>
                <div className="d-flex flex-column gap-1">
                  {contacts[0].phones.map((p) => (
                    <div key={p.number} className="d-flex gap-2">
                      <span className="text-primary fw-semibold">
                        {p.number}
                      </span>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {p.label}
                      </span>
                    </div>
                  ))}
                  {contacts[0].emails.map((e) => (
                    <div key={e} className="text-primary">
                      {e}
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
