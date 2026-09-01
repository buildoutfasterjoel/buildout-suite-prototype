import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import type { ReceivableBroker } from "#/data/receivables";

/** Up to three faces, then a count — a wide column of avatars buys nothing. */
const AVATARS_SHOWN = 3;

/**
 * The Brokers cell, shared by every Back Office index.
 *
 * `Avatar.Group` owns the overlap, the ring and the radius, and `Avatar.More`
 * renders its own `+n` — none of that is reimplemented here.
 *
 * Each avatar IS its tooltip trigger, via `render`, rather than sitting inside
 * a trigger `<span>`. The group overlaps its children with
 * `.avatar .avatar:first-child { margin-left: 0 }`, so a wrapper per avatar
 * would make every one of them a first child and flatten the stack.
 */
export function BrokerStack({ brokers }: { brokers: ReceivableBroker[] }) {
  if (brokers.length === 0) return <span className="text-muted">--</span>;
  const shown = brokers.slice(0, AVATARS_SHOWN);
  const extra = brokers.length - shown.length;

  return (
    <Avatar.Group>
      {shown.map((broker, i) => (
        <Tooltip key={`${broker.name}-${i}`}>
          <Tooltip.Trigger
            render={
              <Avatar>
                {broker.avatarUrl && (
                  <Avatar.Image src={broker.avatarUrl} alt="" />
                )}
                <Avatar.Fallback>{broker.initials}</Avatar.Fallback>
              </Avatar>
            }
          />
          <Tooltip.Content>{broker.name}</Tooltip.Content>
        </Tooltip>
      ))}
      {extra > 0 && <Avatar.More count={extra} />}
    </Avatar.Group>
  );
}
