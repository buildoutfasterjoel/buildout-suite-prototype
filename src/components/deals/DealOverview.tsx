import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPencil } from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker, Listing, Property } from "#/data/types";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { formatCurrency, initials } from "./dealDisplay";

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded h-100" style={{ borderRadius: 6 }}>
      <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
        <h2 className="fs-6 fw-semibold mb-0">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Small commission-split ring — a CSS conic ring with the percentage in the center. */
function SplitRing({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
      style={{
        width: 44,
        height: 44,
        background: `conic-gradient(${color} ${pct * 3.6}deg, #e2e8f0 0deg)`,
      }}
    >
      <div
        className="d-flex align-items-center justify-content-center rounded-circle bg-card fw-semibold"
        style={{ width: 34, height: 34, fontSize: 11 }}
      >
        {Math.round(pct)}%
      </div>
    </div>
  );
}

function BrokerRow({ broker, color }: { broker: DealBroker; color: string }) {
  return (
    <div className="d-flex align-items-center gap-3">
      <Avatar>
        <Avatar.Fallback>{initials(broker.name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="text-primary fw-semibold" style={{ fontSize: 13 }}>
          {broker.role}
        </div>
        <div className="text-truncate">{broker.name}</div>
        {broker.email && (
          <div className="text-muted text-truncate" style={{ fontSize: 12 }}>
            {broker.email}
          </div>
        )}
      </div>
      <div className="d-flex align-items-center gap-3 flex-shrink-0">
        <div className="text-end">
          <div className="fw-semibold">{formatCurrency(broker.grossCommission)}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Gross Commission
          </div>
        </div>
        <SplitRing pct={broker.commissionSplitPct} color={color} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
      <span className="text-muted">{label}</span>
      <span className="fw-medium text-end">{value}</span>
    </div>
  );
}

function TransactionCard({ listing }: { listing: Listing }) {
  return (
    <SectionCard
      title="Transaction"
      action={
        <Button variant="ghost" size="icon-sm" aria-label="Edit transaction">
          <FontAwesomeIcon icon={faPencil} />
        </Button>
      }
    >
      <Field label="Deal ID" value={listing.dealId} />
      <Field label="Sale Price" value={formatCurrency(listing.transaction.salePrice)} />
      <Field
        label="Price / SF"
        value={`$${listing.financials.pricePerSqFt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      />
      <Field label="Commission %" value={`${listing.transaction.commissionPct}%`} />
      <Field label="Commission $" value={formatCurrency(listing.transaction.commissionAmount)} />
      <Field label="Close Probability" value={`${listing.transaction.closeProbability}%`} />
    </SectionCard>
  );
}

/** Combined snapshot: property facts + the deal's transaction terms, side by side. */
export function ListingOverview({
  listing,
  property,
}: {
  listing: Listing;
  property: Property;
}) {
  return (
    <div className="d-flex flex-column gap-4 p-4">
      <div className="row g-4">
        <div className="col-lg-6">
          <SectionCard title="Property">
            <Field label="Property Type" value={listing.propertyTypeLabel} />
            <Field label="Address" value={listing.street} />
            <Field label="City / State / Zip" value={`${listing.location} ${listing.zip}`} />
            <Field label="Available (SF)" value={listing.availableSqFt.toLocaleString()} />
            <Field label="Building Size (SF)" value={property.buildingSqFt.toLocaleString()} />
            <Field label="Year Built" value={property.yearBuilt} />
          </SectionCard>
        </div>
        <div className="col-lg-6">
          <TransactionCard listing={listing} />
        </div>
      </div>
    </div>
  );
}

/** Deal tab: broker splits + commission, plus the transaction terms again for context. */
export function DealTransaction({ listing }: { listing: Listing }) {
  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Transaction" />
      <div className="row g-4">
        <div className="col-lg-6">
          <SectionCard
            title="Internal Brokers"
            action={
              <Button variant="ghost" size="sm">
                <FontAwesomeIcon icon={faPlus} />
                Add broker
              </Button>
            }
          >
            <div className="d-flex flex-column gap-3">
              {listing.internalBrokers.map((b) => (
                <BrokerRow key={b.id} broker={b} color="#6366f1" />
              ))}
            </div>
          </SectionCard>
        </div>
        <div className="col-lg-6">
          <SectionCard
            title="Outside Brokers"
            action={
              <Button variant="ghost" size="sm">
                <FontAwesomeIcon icon={faPlus} />
                Add broker
              </Button>
            }
          >
            {listing.outsideBrokers.length === 0 ? (
              <p className="text-muted mb-0">No outside brokers on this deal.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {listing.outsideBrokers.map((b) => (
                  <BrokerRow key={b.id} broker={b} color="#0891b2" />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <TransactionCard listing={listing} />
        </div>
      </div>
    </div>
  );
}
