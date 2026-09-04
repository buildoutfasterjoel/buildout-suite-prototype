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
 * a colleague to ask — which is the request the marker exists to prevent. The
 * row says the figure is withheld and stops there.
 *
 * `cell` drops the word for a narrow money column, where the lock alone has to
 * carry it. The label moves to `aria-label` there, so the column is not silent
 * to a screen reader; the `row` variant needs none, since its own text says it.
 */
export function PrivatePayout({
  variant = "row",
}: {
  variant?: "row" | "cell";
}) {
  return (
    <span
      className="text-muted d-inline-flex align-items-center gap-2"
      aria-label={variant === "cell" ? "Private" : undefined}
    >
      <FontAwesomeIcon icon={faLock} />
      {variant === "row" && <span>Private</span>}
    </span>
  );
}
