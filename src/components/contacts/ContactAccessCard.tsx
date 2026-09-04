import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLockKeyhole } from "@fortawesome/pro-regular-svg-icons";
import type { ContactOwnership } from "#/data/contactOwnership";
import { accountableName, type ContactRights } from "#/data/contactViewerAccess";

/**
 * Stands in for the composer when the viewer can read the record but not act
 * on it. Names what the viewer has, then says why in one sentence. There is no
 * ask here — requesting access was pulled for now, so the card only explains.
 *
 * A View-tier collaborator lands here too — they can already see everything,
 * so the copy shifts from "you can see this because it's visible" to "you were
 * shared in to read".
 */
export function ContactAccessCard({
  ownership,
  rights,
}: {
  ownership: ContactOwnership;
  rights: ContactRights;
}) {
  const who = accountableName(ownership);
  const whoFirst = who.split(" ")[0];

  const title = rights.preview
    ? "Previewing Private Contact"
    : rights.relationship === "collaborator"
      ? `You Have ${rights.label} Access`
      : "Read-Only Access";

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
      </div>
    </Card>
  );
}
