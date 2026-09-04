import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";

/**
 * The marker over a broker's payout — their commission plan, their personal
 * split, and the net that falls out of the two. See `canSeeBrokerPayout` for
 * why those three facts are private and the gross beside them is not.
 *
 * A lock and the word. No tooltip, and no name: unlike a private contact, this
 * is not a record someone can be asked to share. What the brokerage pays a
 * person is between them and the back office, and naming a holder would invite
 * a colleague to ask — which is the request the marker exists to prevent.
 *
 * Used in one place: the internal commissions table, where the row has to stay
 * because the gross beside it is the deal's business. Payables has no marker at
 * all — a payable is one person's cheque end to end, so the row is dropped
 * rather than half-hidden.
 */
export function PrivatePayout() {
  return (
    <span className="text-muted d-inline-flex align-items-center gap-2">
      <FontAwesomeIcon icon={faLock} />
      <span>Private</span>
    </span>
  );
}
