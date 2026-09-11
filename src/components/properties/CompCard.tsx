import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollarSign, faSignHanging } from "@fortawesome/pro-regular-svg-icons";
import type { Comp } from "#/data/types";
import { CardBadge } from "#/components/deals/DealCardBadges";
import { formatPrice, formatPct, formatSqFt } from "./propertyDisplay";

/** "Mar 2026" — when the comp closed. */
function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * A comp in the redesigned card language — the same shell, type glyph, title
 * row and badge row as `NewDealCard` and `NewContactPropertyCard`, so the three
 * stack in a rail without reading as different species.
 *
 * What differs is structural: a comp has no stage and no page of its own, so
 * the card is static (no pointer, no hover lift), its second line carries the
 * transaction's numbers, and the right-hand slot the deal card gives to gross
 * commission here gives to the closing date.
 */
export function CompCard({ comp }: { comp: Comp }) {
  const sale = comp.compType === "sale";
  const meta = sale
    ? [
        comp.salePrice != null ? formatPrice(comp.salePrice) : null,
        comp.pricePerSqFt != null ? `$${Math.round(comp.pricePerSqFt)}/SF` : null,
        // Stored as a fraction (0.061), shown as a percent.
        comp.capRateAtSale != null ? `${formatPct(comp.capRateAtSale * 100)} cap` : null,
      ]
    : [
        comp.leaseRate != null ? `$${comp.leaseRate}/SF` : null,
        comp.leaseType,
        comp.leaseTerm != null ? `${comp.leaseTerm} mo` : null,
      ];
  const type = sale
    ? { icon: faDollarSign, label: "Sale", bg: "#cdfee5", color: "#003024" } // mountain-meadow/100/950
    : { icon: faSignHanging, label: "Lease", bg: "#cefaff", color: "#063346" }; // seagull/100/950

  return (
    <div className="deal-tile deal-tile--property deal-tile--static">
      <div className="deal-tile__main">
        <div className="deal-tile__headings">
          <div className="deal-tile__title-row">
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="deal-tile__type-icon">
                    <FontAwesomeIcon icon={type.icon} />
                  </span>
                }
              />
              <Tooltip.Content>{type.label} comp</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={<span className="deal-tile__title">{comp.buyerOrTenantName}</span>}
              />
              <Tooltip.Content>
                {sale ? "Bought from" : "Leased from"} {comp.sellerOrLandlordName}
              </Tooltip.Content>
            </Tooltip>
          </div>
          <span className="deal-tile__meta deal-tile__meta--muted">
            {meta.filter(Boolean).join(" • ")}
          </span>
        </div>

        <div className="deal-tile__badges">
          <div className="deal-tile__badges-main">
            <CardBadge
              icon={type.icon}
              label={type.label}
              bg={type.bg}
              color={type.color}
              tooltip={`${type.label} comp · ${comp.source}`}
            />
            <CardBadge
              label={formatSqFt(comp.sqFt)}
              bg="#eceef2"
              color="#22262f"
              tooltip={`${formatSqFt(comp.sqFt)} · ${comp.daysOnMarket} days on market`}
            />
          </div>
          <Tooltip>
            <Tooltip.Trigger
              render={<span className="deal-tile__gross">{monthYear(comp.closingDate)}</span>}
            />
            <Tooltip.Content>Closed</Tooltip.Content>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
