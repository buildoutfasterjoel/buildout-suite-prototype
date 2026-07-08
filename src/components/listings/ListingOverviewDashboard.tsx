import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronRight,
  faDownload,
  faEnvelopeOpen,
  faTriangleExclamation,
  faWandMagicSparkles,
  faListCheck,
  faAddressCard,
  faFileLines,
  faTag,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Listing, DealTask } from "#/data/types";
import { STATUS_COLORS } from "#/components/properties/propertyDisplay";
import { formatDate } from "#/components/deals/dealDisplay";
import {
  getEmails,
  getEmailPerformance,
  EMAIL_STATUS_DISPLAY,
  type Email,
} from "#/data/emails";
import { ListingPageHeader } from "./ListingPageHeader";
import { KpiTile, SectionCard } from "./listingWidgets";

function OverdueTaskRow({ task }: { task: DealTask }) {
  return (
    <div className="d-flex align-items-center gap-3 px-4 py-3 border-bottom">
      <span
        className="rounded-circle flex-shrink-0"
        style={{
          width: 10,
          height: 10,
          backgroundColor: STATUS_COLORS.proposal,
        }}
      />
      <div className="flex-grow-1 text-truncate">
        <div className="text-truncate">{task.label}</div>
        <span className="text-danger" style={{ fontSize: 12 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} /> Due{" "}
          {formatDate(task.date)}
        </span>
      </div>
      <Avatar size="sm" className="flex-shrink-0">
        <Avatar.Fallback>{task.assigneeInitials}</Avatar.Fallback>
      </Avatar>
    </div>
  );
}

function CampaignRow({ email }: { email: Email }) {
  const display = EMAIL_STATUS_DISPLAY[email.status];
  const opens =
    email.status === "sent" ? getEmailPerformance(email).opens : null;
  return (
    <Link
      to="/email/$emailId"
      params={{ emailId: email.id }}
      className="d-flex align-items-center gap-3 px-4 py-3 border-bottom text-decoration-none text-body"
    >
      <span
        className="rounded-circle flex-shrink-0"
        style={{ width: 10, height: 10, backgroundColor: display.dotColor }}
        title={display.label}
      />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-medium text-truncate">{email.campaign}</div>
        <div className="text-muted text-truncate" style={{ fontSize: 12 }}>
          {email.subject} · {display.label}
        </div>
      </div>
      {opens !== null && (
        <div className="text-end flex-shrink-0">
          <div className="fw-semibold">{opens}%</div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            opens
          </div>
        </div>
      )}
      <FontAwesomeIcon
        icon={faChevronRight}
        className="text-muted flex-shrink-0"
      />
    </Link>
  );
}

type SetupStep = {
  href: "contacts" | "transaction" | "tasks" | "documents";
  icon: IconDefinition;
  title: string;
  description: string;
};

const PROPOSAL_STEPS: SetupStep[] = [
  {
    href: "contacts",
    icon: faAddressCard,
    title: "Add contacts",
    description: "Link the seller, buyer, and other deal parties.",
  },
  {
    href: "transaction",
    icon: faTag,
    title: "Set pricing & commission",
    description: "Enter the asking price, deal terms, and broker splits.",
  },
  {
    href: "tasks",
    icon: faListCheck,
    title: "Plan the deal",
    description: "Add the tasks and critical dates to move this forward.",
  },
  {
    href: "documents",
    icon: faFileLines,
    title: "Upload documents",
    description: "Add the offering memo, agreement, and marketing files.",
  },
];

/** Getting-started state for a brand-new proposal — no traffic/deal data yet. */
function ProposalGettingStarted({ listing }: { listing: Listing }) {
  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Overview" />

      {/* Hero */}
      <div
        className="bg-card border rounded p-4 d-flex align-items-start gap-3"
        style={{ borderRadius: 6 }}
      >
        <span
          className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            backgroundColor: `color-mix(in srgb, ${STATUS_COLORS.proposal} 10%, transparent)`,
            color: STATUS_COLORS.proposal,
          }}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} />
        </span>
        <div className="flex-grow-1">
          <h2 className="fs-5 fw-semibold mb-1">Proposal created</h2>
          <p className="text-muted mb-0">
            {listing.name} is in proposal mode. Complete the steps below to get it
            ready, then publish it as an active listing.
          </p>
        </div>
        <Button variant="primary" className="flex-shrink-0">
          Publish listing
        </Button>
      </div>

      {/* Next steps checklist */}
      <SectionCard title="Next steps" bodyClassName="">
        {PROPOSAL_STEPS.map((step) => (
          <Link
            key={step.href}
            to={`/listings/$listingId/${step.href}` as string}
            params={{ listingId: listing.id } as never}
            className="d-flex align-items-center gap-3 px-4 py-3 border-bottom text-decoration-none text-body"
          >
            <span
              className="d-inline-flex align-items-center justify-content-center rounded flex-shrink-0 text-muted bg-body-secondary"
              style={{ width: 36, height: 36 }}
            >
              <FontAwesomeIcon icon={step.icon} />
            </span>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="fw-medium">{step.title}</div>
              <div className="text-muted text-truncate" style={{ fontSize: 13 }}>
                {step.description}
              </div>
            </div>
            <FontAwesomeIcon
              icon={faChevronRight}
              className="text-muted flex-shrink-0"
            />
          </Link>
        ))}
      </SectionCard>
    </div>
  );
}

/** At-a-glance dashboard: website traffic, active campaigns, and overdue tasks. */
export function ListingOverviewDashboard({ listing }: { listing: Listing }) {
  if (listing.status === "proposal") {
    return <ProposalGettingStarted listing={listing} />;
  }

  const overdueTasks = listing.tasks.filter((t) => t.status === "overdue");

  const campaigns = getEmails()
    .filter(
      (e) =>
        e.type === listing.propertyType &&
        !e.archived &&
        (e.status === "sent" || e.status === "scheduled"),
    )
    .sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))
    .slice(0, 5);

  return (
    <div className="d-flex flex-column gap-4 p-4">
      {/* Header */}
      <ListingPageHeader
        title="Overview"
        actions={
          <Button variant="outline">
            <FontAwesomeIcon icon={faDownload} />
            Download PDF
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="row g-3">
        <div className="col-6 col-md">
          <KpiTile label="Active Campaigns" value={campaigns.length} />
        </div>
        <div className="col-6 col-md">
          <KpiTile
            label="Overdue Tasks"
            value={overdueTasks.length}
            accent={overdueTasks.length > 0}
          />
        </div>
      </div>

      {/* Widget grid */}
      <div className="row g-4">
        <div className="col-lg-6">
          <SectionCard
            title="Overdue Tasks"
            bodyClassName=""
            action={
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/listings/$listingId/tasks"
                    params={{ listingId: listing.id }}
                  >
                    View tasks
                  </Link>
                }
              />
            }
          >
            {overdueTasks.length === 0 ? (
              <Empty className="py-5 m-4">
                <Empty.Media>
                  <FontAwesomeIcon icon={faCheck} aria-hidden />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>All caught up</Empty.Title>
                  No overdue tasks on this listing.
                </Empty.Content>
              </Empty>
            ) : (
              overdueTasks.map((t) => <OverdueTaskRow key={t.id} task={t} />)
            )}
          </SectionCard>
        </div>

        <div className="col-lg-6">
          <SectionCard
            title="Active Campaigns"
            bodyClassName=""
            action={
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/listings/$listingId/email"
                    params={{ listingId: listing.id }}
                  >
                    View all
                  </Link>
                }
              />
            }
          >
            {campaigns.length === 0 ? (
              <Empty className="py-5">
                <Empty.Media>
                  <FontAwesomeIcon icon={faEnvelopeOpen} aria-hidden />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No active campaigns</Empty.Title>
                  No sent or scheduled campaigns for {
                    listing.propertyTypeLabel
                  }{" "}
                  listings.
                </Empty.Content>
              </Empty>
            ) : (
              campaigns.map((e) => <CampaignRow key={e.id} email={e} />)
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
