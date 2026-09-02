import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLockKeyhole, faPaperPlane } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import type { ContactOwnership } from "#/data/contactOwnership";
import { accountableName, type ContactRights } from "#/data/contactViewerAccess";
import { ACCESS_TIERS, accessTierLabel, type AccessTier } from "#/data/teammates";
import { useAccessRequests } from "#/components/contacts/useAccessRequests";
import { notify } from "#/lib/notify";

/**
 * Stands in for the composer when the viewer can read the record but not act
 * on it. Says why in one sentence, then offers the knock: pick a tier, ask the
 * accountable person. The tiers are the same three the share modal grants, so
 * the request and the grant speak the same language.
 *
 * A View-tier collaborator lands here too — they can already see everything,
 * so the copy shifts from "you can see this because it's visible" to "you were
 * shared in to read", and the ask is for more.
 */
export function ContactRequestAccessCard({
  contact,
  ownership,
  rights,
}: {
  contact: Contact;
  ownership: ContactOwnership;
  rights: ContactRights;
}) {
  const who = accountableName(ownership);
  const whoFirst = who.split(" ")[0];
  const pending = useAccessRequests((s) => s.requests[contact.id]);
  const request = useAccessRequests((s) => s.request);
  const cancel = useAccessRequests((s) => s.cancel);
  // A reader asks for the lowest tier that lets them work; a View collaborator
  // already has View, so the ask starts one rung up.
  const [tier, setTier] = useState<AccessTier>(
    rights.tier === "view" ? "contributor" : "contributor",
  );
  // On a company-owned record everyone at the firm can already read it — View
  // is what the viewer has, not something to ask for. So the card says so, and
  // offers only the tiers that would change anything.
  const alreadyReadable =
    ownership.owner.kind === "company" && rights.relationship === "none" && !rights.preview;
  const askable = ACCESS_TIERS.filter(
    (t) => t.value !== rights.tier && !(alreadyReadable && t.value === "view"),
  );
  // One line does both jobs: what you have, and what the card is for.
  const standing = rights.preview
    ? "Previewing private contact"
    : rights.relationship === "collaborator"
      ? `You have ${rights.label} access`
      : "You have read-only access";
  const title = `${standing}. Ask to collaborate.`;

  const reason = rights.preview
    ? `You can see that this contact exists — the name, the stage and that ${who} owns it — because you have View Private Contacts permission turned on. Everything else stays hidden until ${whoFirst} shares it with you. To brokers without that permission, this contact doesn't exist at all.`
    : rights.relationship === "collaborator"
      ? `${who} shared this contact with you to read. Logging activity or making changes needs a higher tier.`
      : ownership.owner.kind === "company"
        ? `This contact belongs to the company and is visible to everyone here. Only ${who}, who's assigned to it, and the people they've shared it with can act on it.`
        : `This contact is visible to the firm, but it's ${who}'s. Only ${whoFirst} and the people ${whoFirst} has shared it with can act on it.`;

  return (
    <Card className="panel-card overflow-hidden">
      <div className="d-flex flex-column gap-3 p-4">
        <div className="d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faLockKeyhole} className="text-muted" />
          <span className="fw-semibold" style={{ fontSize: 20, lineHeight: "26px" }}>
            {title}
          </span>
        </div>
        <p className="mb-0 text-muted">{reason}</p>

        {pending ? (
          <div className="d-flex align-items-center justify-content-between gap-3 rounded bg-storm-grey-50 px-3 py-2">
            <span>
              <span className="fw-semibold">
                {accessTierLabel(pending.tier)} access requested
              </span>{" "}
              <span className="text-muted">
                from {who}. You&apos;ll be able to act on this contact once they grant it.
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => cancel(contact.id)}
            >
              Cancel request
            </Button>
          </div>
        ) : (
          <>
            <RadioGroup
              value={tier}
              onValueChange={(v) => setTier(v as AccessTier)}
              className="d-flex flex-column gap-1"
              aria-label="Ask to collaborate — access level to request"
            >
              {askable.map((t) => (
                // Blueprint's radio isn't a labelable element, so the label
                // selects explicitly — its text is a target too.
                <label
                  key={t.value}
                  className="d-flex gap-2 p-2 rounded-3 mb-0 share-modal__tier"
                  style={{ cursor: "pointer" }}
                  onClick={() => setTier(t.value)}
                >
                  <RadioGroup.Item
                    value={t.value}
                    className="mt-1 flex-shrink-0"
                    aria-label={t.label}
                  />
                  <span className="d-flex flex-column lh-sm">
                    <span className="fw-semibold">{t.label}</span>
                    <span className="fs-small text-muted">{t.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => {
                  request(contact.id, tier);
                  notify({
                    title: "Access requested",
                    description: `${who} will see your request for ${accessTierLabel(
                      tier,
                    )} access to ${contact.firstName} ${contact.lastName}.`,
                  });
                }}
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                Request access from {whoFirst}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
