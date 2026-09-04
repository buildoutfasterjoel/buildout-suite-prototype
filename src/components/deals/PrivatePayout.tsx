import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";

/**
 * The marker over a broker's payout — their commission plan, their personal
 * split, and the net that falls out of the two. See `canSeeBrokerPayout` for
 * why those three facts are private and the gross beside them is not.
 *
 * Modelled on `PrivateContactPlaceholder`: a lock for the figure, a label
 * instead of the number, and a line saying who *can* see it, so the reader
 * knows this is withheld rather than missing.
 *
 * One deliberate departure from that component — **no "Request access" knock.**
 * A private contact's owner can reasonably be asked to share the record. Asking
 * a colleague to show you what the house pays them is not a request anyone
 * should be invited to make, and the request that *is* legitimate — "my own
 * plan looks wrong" — goes to the back office, not to the person in the row.
 */
export function PrivatePayout({
  /** Whose payout it is. Named in the tooltip so the row still reads as theirs. */
  brokerName,
  /** `row` fills a spanned cell; `cell` is a lone figure in a narrow column. */
  variant = "row",
}: {
  brokerName: string;
  variant?: "row" | "cell";
}) {
  const explanation = `What the brokerage pays ${brokerName} is between them and the back office. The deal's gross commission, above, is visible to everyone on the deal.`;

  if (variant === "cell") {
    return (
      <Tooltip>
        <Tooltip.Trigger
          render={
            <span
              className="text-muted d-inline-flex align-items-center gap-1"
              tabIndex={0}
              aria-label={`Private — ${brokerName}'s payout`}
            >
              <FontAwesomeIcon icon={faLock} />
            </span>
          }
        />
        <Tooltip.Content style={{ maxWidth: 260 }}>{explanation}</Tooltip.Content>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <span
            className="text-muted d-inline-flex align-items-center gap-2"
            tabIndex={0}
          >
            <FontAwesomeIcon icon={faLock} />
            <span>Private plan</span>
            <span className="fs-small">
              Visible to {brokerName} and the back office
            </span>
          </span>
        }
      />
      <Tooltip.Content style={{ maxWidth: 260 }}>{explanation}</Tooltip.Content>
    </Tooltip>
  );
}
