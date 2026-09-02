import { useState } from "react";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faLocationDot,
  faPhone,
} from "@fortawesome/pro-regular-svg-icons";
import {
  faEnvelope as faEnvelopeSolid,
  faPhone as faPhoneSolid,
} from "@fortawesome/pro-solid-svg-icons";
import {
  seededVerified,
  useContactVerification,
  verificationKey,
} from "#/components/contacts/useContactVerification";

/** The two record types that carry a verification state and an action. */
type RecordKind = "phone" | "email";

const ICONS: Record<RecordKind, { verified: typeof faPhone; unverified: typeof faPhone }> = {
  phone: { verified: faPhoneSolid, unverified: faPhone },
  email: { verified: faEnvelopeSolid, unverified: faEnvelope },
};

/**
 * One phone/email record: a verify icon-button in the 20px icon column, then the
 * value itself as a borderless button. The icon's weight carries the state
 * (solid = verified, regular = not) and the value's hover fill echoes it —
 * green when it's safe to reach out on, grey when it isn't.
 */
function RecordRow({
  contactId,
  kind,
  value,
  isPrimary,
  invalid,
  suffix,
  canEdit,
  canReachOut,
  onActivate,
}: {
  /** May flip the verification state. Otherwise the icon just reports it. */
  canEdit: boolean;
  /** May dial or email from here. Otherwise the value is plain text. */
  canReachOut: boolean;
  contactId: string;
  kind: RecordKind;
  value: string;
  isPrimary: boolean;
  /** A known-bad number — struck through, and never verified by default. */
  invalid?: boolean;
  /** Trailing note on the value, e.g. "(mobile)" on the primary phone. */
  suffix?: string;
  onActivate: (value: string) => void;
}) {
  const key = verificationKey(contactId, value);
  const override = useContactVerification((s) => s.overrides[key]);
  const verified = override ?? seededVerified(key, isPrimary && !invalid);
  const icons = ICONS[kind];

  const valueText = (
    <>
      <span
        className={
          invalid ? "text-decoration-line-through text-destructive" : undefined
        }
      >
        {value}
      </span>
      {suffix && <span className="contact-info__value-note">{suffix}</span>}
    </>
  );

  return (
    <div className="contact-info__row">
      <span className="contact-info__icon-slot">
        {canEdit ? (
        <Tooltip>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                className="contact-info__verify"
                aria-label={
                  verified
                    ? `${value} is verified — click to un-verify`
                    : `${value} is un-verified — click to verify`
                }
                onClick={() =>
                  useContactVerification.getState().toggle(key, verified)
                }
              >
                <FontAwesomeIcon
                  icon={verified ? icons.verified : icons.unverified}
                />
              </button>
            }
          />
          <Tooltip.Content>
            {verified
              ? "Verified. Click to un-verify"
              : "Un-verified. Click to verify"}
          </Tooltip.Content>
        </Tooltip>
        ) : (
          // Reports the state without offering to change it — and without the
          // hover treatment that promises a click will do something.
          <span
            className="contact-info__verify contact-info__verify--static"
            aria-label={verified ? `${value} is verified` : `${value} is un-verified`}
          >
            <FontAwesomeIcon icon={verified ? icons.verified : icons.unverified} />
          </span>
        )}
      </span>
      {canReachOut ? (
      <Tooltip>
        <Tooltip.Trigger
          render={
            <button
              type="button"
              className={`contact-info__value contact-info__value--${
                verified ? "verified" : "unverified"
              }`}
              onClick={() => onActivate(value)}
            >
              {valueText}
            </button>
          }
        />
        <Tooltip.Content>
          {kind === "phone" ? `Dial ${value}` : `Email ${value}`}
        </Tooltip.Content>
      </Tooltip>
      ) : (
        <span className="contact-info__value contact-info__value--static">
          {valueText}
        </span>
      )}
    </div>
  );
}

/**
 * All of a contact's numbers (or addresses) of one type. Only the primary shows
 * until the broker asks for the rest — a contact with five numbers shouldn't
 * push the deals below the fold — so the extras sit behind a Show/Hide link that
 * appears only when there's more than one record.
 */
function RecordGroup({
  contactId,
  kind,
  values,
  phoneInvalid,
  canEdit,
  canReachOut,
  onActivate,
}: {
  contactId: string;
  kind: RecordKind;
  values: string[];
  /** The contact's primary number is known bad (phoneStatus === "invalid"). */
  phoneInvalid?: boolean;
  canEdit: boolean;
  canReachOut: boolean;
  onActivate: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const extra = values.length - 1;
  const shown = expanded ? values : values.slice(0, 1);

  return (
    <div className="contact-info__group">
      {shown.map((value, i) => (
        <RecordRow
          key={`${value}-${i}`}
          contactId={contactId}
          kind={kind}
          value={value}
          isPrimary={i === 0}
          invalid={i === 0 && kind === "phone" && phoneInvalid}
          suffix={i === 0 && kind === "phone" ? "(mobile)" : undefined}
          canEdit={canEdit}
          canReachOut={canReachOut}
          onActivate={onActivate}
        />
      ))}
      {extra > 0 && (
        <div className="contact-info__more">
          <button
            type="button"
            className="contact-info__more-link"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show Less" : `Show ${extra} More`}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The contact hero's reach-out block: every phone number, email address, and the
 * mailing address. Each phone/email is actionable — clicking a number starts the
 * simulated call, clicking an address opens the composer on its Email tab — and
 * each carries a verification toggle so the broker can mark a record good or bad
 * from where they read it.
 */
export function ContactHeroInfo({
  contactId,
  phones,
  emails,
  addressLine,
  phoneInvalid,
  canEdit = true,
  canReachOut = true,
  onDial,
  onEmail,
}: {
  contactId: string;
  phones: string[];
  emails: string[];
  /** Street + city/state/zip as one line; empty when nothing's on file. */
  addressLine: string;
  phoneInvalid?: boolean;
  /** May flip verification on the records. */
  canEdit?: boolean;
  /** May dial or email from the records. */
  canReachOut?: boolean;
  onDial: (phone: string) => void;
  onEmail: (email: string) => void;
}) {
  if (phones.length === 0 && emails.length === 0 && !addressLine) return null;

  return (
    <div className="contact-info border-bottom pb-3">
      {phones.length > 0 && (
        <RecordGroup
          contactId={contactId}
          kind="phone"
          values={phones}
          phoneInvalid={phoneInvalid}
          canEdit={canEdit}
          canReachOut={canReachOut}
          onActivate={onDial}
        />
      )}
      {emails.length > 0 && (
        <RecordGroup
          contactId={contactId}
          kind="email"
          values={emails}
          canEdit={canEdit}
          canReachOut={canReachOut}
          onActivate={onEmail}
        />
      )}
      {addressLine && (
        <div className="contact-info__group">
          {/* No verify toggle or action here: an address isn't something the
              broker reaches out on from this panel. */}
          <div className="contact-info__row contact-info__row--static">
            <span className="contact-info__icon-slot">
              <FontAwesomeIcon icon={faLocationDot} />
            </span>
            <span className="contact-info__address">{addressLine}</span>
          </div>
        </div>
      )}
    </div>
  );
}
