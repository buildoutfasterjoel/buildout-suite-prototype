import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";

/**
 * The marker over a broker's payout — their commission plan, their personal
 * split, and the net that falls out of the two. See `canSeeBrokerPayout` for
 * why those three facts are private and the gross beside them is not.
 *
 * A lock and the word, and nothing else on the line. Who can see it is a
 * question a reader only asks sometimes, so it lives in the tooltip; spelling it
 * out in the row put a sentence of explanation inside a table of figures, where
 * it read as data.
 *
 * One deliberate departure from `PrivateContactPlaceholder`, which this is
 * otherwise modelled on — **no "Request access" knock.** A private contact's
 * owner can reasonably be asked to share the record. Asking a colleague to show
 * you what the house pays them is not a request anyone should be invited to
 * make, and the request that *is* legitimate — "my own plan looks wrong" — goes
 * to the back office, not to the person in the row.
 */
export function PrivatePayout({
  /** Whose payout it is. Named in the tooltip, so the row still reads as theirs. */
  brokerName,
  /** `row` carries the word; `cell` is the lock alone, for a narrow money column. */
  variant = "row",
}: {
  brokerName: string;
  variant?: "row" | "cell";
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <span
            className="text-muted d-inline-flex align-items-center gap-2"
            tabIndex={0}
            aria-label={`Private — ${brokerName}'s payout`}
          >
            <FontAwesomeIcon icon={faLock} />
            {variant === "row" && <span>Private</span>}
          </span>
        }
      />
      <Tooltip.Content style={{ maxWidth: 260 }}>
        What the brokerage pays {brokerName} is between them and the back office.
        The deal&apos;s gross commission, above, is visible to everyone on the deal.
      </Tooltip.Content>
    </Tooltip>
  );
}
