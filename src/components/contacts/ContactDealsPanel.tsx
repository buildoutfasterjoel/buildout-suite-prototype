import { useNavigate } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Progress } from "@buildoutinc/blueprint-react/ui/Progress";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faEllipsisVertical,
  faUserGroup,
  faHandshake,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import { useCreateDeal } from "#/data/useCreateDeal";
import { getListing } from "#/data/store";
import { DealCardById } from "#/components/deals/DealCard";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { initials as nameInitials } from "#/components/deals/dealDisplay";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A contact's linked deal, rendered with the universal {@link DealCardById} core
 * plus contact-specific extras (started date, plan progress, lead, actions menu)
 * threaded in through the card's `footer`/`action` slots.
 */
function DealCard({ deal, startedAt }: { deal: DealSummary; startedAt: string }) {
  const navigate = useNavigate();
  const pct = deal.planTotal
    ? Math.round((deal.planDone / deal.planTotal) * 100)
    : 0;

  const action = (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Deal actions">
            <FontAwesomeIcon icon={faEllipsisVertical} />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        {/* The card body routes through `DealCardById`; this menu item has to
            resolve the same destination itself. A `DealSummary` doesn't carry
            `parentDealId`, so the listing is re-read to ask `dealCardLinkProps`
            — and if it isn't in the store the card wouldn't be rendering. */}
        <DropdownMenu.Item
          onClick={() => {
            const listing = getListing(deal.id);
            if (listing) void navigate(dealCardLinkProps(listing));
          }}
        >
          Open deal
        </DropdownMenu.Item>
        <DropdownMenu.Item>Edit</DropdownMenu.Item>
        <DropdownMenu.Item>Remove link</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );

  const footer = (
    <div className="d-flex flex-column gap-2">
      <div className="text-muted fs-small">Started {medDate(startedAt)}</div>

      {/* Plan */}
      <div className="d-flex flex-column gap-1">
        <div className="d-flex align-items-center justify-content-between fs-small">
          <span className="text-muted">Plan</span>
          <span className="text-muted">
            {deal.planDone} of {deal.planTotal} tasks · {pct}%
          </span>
        </div>
        <Progress value={pct} />
      </div>

      {/* Lead */}
      <div className="d-flex align-items-center gap-2">
        <Avatar size="sm">
          <Avatar.Fallback className="fw-semibold">
            {nameInitials(deal.leadName)}
          </Avatar.Fallback>
        </Avatar>
        <span>
          {deal.leadName} <span className="text-muted">Lead</span>
        </span>
      </div>
    </div>
  );

  return (
    <DealCardById
      listingId={deal.id}
      showStatus
      action={action}
      footer={footer}
    />
  );
}

export function ContactDealsPanel({
  contact,
  deals,
  openTaskCount,
}: {
  contact: Contact;
  deals: DealSummary[];
  openTaskCount: number;
}) {
  return (
    <div className="d-flex flex-column gap-4">
      {/* Deals */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
              Deals
              <Badge variant="secondary" appearance="muted" className="fs-xs">
                {deals.length}
              </Badge>
              {deals.length > 0 && (
                <Badge
                  variant="secondary"
                  appearance="muted"
                  className="fs-xs d-inline-flex align-items-center gap-1"
                >
                  <FontAwesomeIcon icon={faUserGroup} />
                  SHARED
                </Badge>
              )}
            </Card.Title>
            <Button
              variant="outline"
              size="sm"
              onClick={() => useCreateDeal.getState().openFor({ contact })}
            >
              <FontAwesomeIcon icon={faPlus} />
              New deal
            </Button>
          </div>
          {deals.length === 0 ? (
            <Empty className="py-4">
              <Empty.Media>
                <FontAwesomeIcon icon={faHandshake} aria-label="No deals" />
              </Empty.Media>
              <Empty.Content>
                <Empty.Title>No deals yet</Empty.Title>
                Deals you link to this contact will show up here.
              </Empty.Content>
            </Empty>
          ) : (
            deals.map((d) => (
              <DealCard key={d.id} deal={d} startedAt={contact.createdAt} />
            ))
          )}
        </Card.Body>
      </Card>

      {/* Tasks */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Tasks
            <Badge variant="secondary" appearance="muted" className="fs-xs">
              {openTaskCount} OPEN
            </Badge>
          </Card.Title>
          <div className="d-flex align-items-center justify-content-between gap-2">
            <span className="text-muted fs-small">
              {openTaskCount === 0
                ? "No tasks yet — AI queues them after your next call or email."
                : `${openTaskCount} open task${openTaskCount > 1 ? "s" : ""} across linked deals.`}
            </span>
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <FontAwesomeIcon icon={faPlus} />
              Add task
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
