import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";
import { PRIVATE_CONTACT_LABEL, placeholderCode } from "#/components/contacts/contactRights";

/**
 * A private contact on a shared object — the one place a private record's
 * existence may surface. The deal is the firm's business even when the
 * relationship is not, so the row says *that* someone is here and *what* they
 * are to the deal, never who: a lock for a face, "Private Contact" for a name,
 * a short code so two placeholders on one deal can be told apart, and no link.
 * The code is derived from the real contact id, but the id itself is never
 * shown.
 */
export function PrivateContactPlaceholder({
  contactId,
  /** Who holds the record — the accountable person's name. */
  askName,
  /** Row layout (avatar + two lines) or compact inline (avatar + label). */
  variant = "row",
  /** Second line under the label, e.g. the party role. */
  detail,
}: {
  contactId: string;
  askName: string;
  variant?: "row" | "inline";
  detail?: string;
}) {
  const code = placeholderCode(contactId);

  const avatar = (
    <Avatar size={variant === "row" ? "lg" : "sm"} className="flex-shrink-0">
      <Avatar.Fallback className="bg-storm-grey-100 text-storm-grey-600">
        <FontAwesomeIcon icon={faLock} />
      </Avatar.Fallback>
    </Avatar>
  );

  if (variant === "inline") {
    return (
      <Tooltip>
        <Tooltip.Trigger
          render={
            <span className="d-inline-flex align-items-center gap-2 text-muted" tabIndex={0}>
              {avatar}
              <span className="text-truncate">{PRIVATE_CONTACT_LABEL}</span>
            </span>
          }
        />
        <Tooltip.Content style={{ maxWidth: 260 }}>
          Someone is on this deal whose record is private. You can see they&apos;re here,
          not who they are. {askName} holds the record.
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return (
    <div className="d-flex align-items-center gap-2 py-2">
      {avatar}
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold text-truncate d-flex align-items-center gap-2">
          <span>{PRIVATE_CONTACT_LABEL}</span>
          <span className="fs-xs text-muted fw-normal">#{code}</span>
        </div>
        <div className="text-muted text-truncate fs-small">
          {detail ? `${detail} · ` : ""}
          Held by {askName}
        </div>
      </div>
    </div>
  );
}
