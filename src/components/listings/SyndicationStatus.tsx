import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faEnvelope,
  faCircleWifi,
  faCircleInfo,
} from "@fortawesome/pro-regular-svg-icons";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import {
  getListingSyndication,
  type SyndicationChannel,
  type SyndicationDelivery,
} from "#/data/listingSyndication";
import { getListingWebsiteSettings } from "#/data/listingWebsiteSettings";
import { SyndicationChannelCard } from "./syndication/SyndicationChannelCard";
import {
  EmailRepsModal,
  type EmailRepsTemplate,
} from "./syndication/EmailRepsModal";

const AFFILIATION_DISCLAIMER =
  "Buildout has no financial, legal, commercial, or partnership affiliation with CoStar Group, Inc., LoopNet, or Crexi, Inc. No association or relationship between these companies should be implied or inferred. Buildout assists customers in sending email updates to these unaffiliated channels when listings are added, updated, or removed.";

const GROUPS: { delivery: SyndicationDelivery; label: string }[] = [
  { delivery: "direct", label: "Direct Connections" },
  { delivery: "email", label: "Email Updates" },
];

/**
 * Header widget: an at-a-glance syndication status button that opens a modal
 * with per-channel status, dates, links, and the disclaimers that qualify each
 * group. Turning channels on and off lives on the user profile, not here.
 */
export function SyndicationStatus({ listing }: { listing: Listing }) {
  // Recomputed from `listing` on every render (deterministic, so identical
  // input always yields identical output) rather than frozen at mount — a
  // publish/unpublish elsewhere in the app re-renders this component with a
  // new `listing.publishedAt`, and the channel list must track it instead of
  // going stale.
  const { channels: allChannels, blockingIssues, blocksSyndication } =
    getListingSyndication(listing);
  // A channel the account has no connection for is not something this listing
  // can reach, so it isn't part of this listing's story — it belongs on the
  // profile page where connections are made, not in a list of where the
  // listing goes.
  const channels = allChannels.filter((c) => c.state !== "not-available");
  const websiteUrl = getListingWebsiteSettings(listing).websiteUrl;
  const websiteLabel =
    listing.dealType === "Lease" ? "Lease Website" : "Sale Website";
  // The two modals take turns rather than stacking: a dialog opened over
  // another dialog reads as a panel spliced into the first one.
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const published = listing.publishedAt != null;
  // A Closed or Lost deal that was published is off-market now — show its history
  // without implying it is still live.
  const offMarket =
    published && (listing.status === "closed" || listing.status === "inactive");
  const activeCount = channels.filter((c) => c.active).length;
  // The listing's own state says what the broker is almost certainly here to
  // send, so the template that matches it starts selected.
  const defaultTemplate: EmailRepsTemplate = offMarket
    ? "offline"
    : published
      ? "update"
      : "new";
  const label = !published
    ? "Not published"
    : offMarket
      ? "Previously published"
      : activeCount === 0
        ? "Published"
        : `Published · syndicating to ${activeCount}/${channels.length}`;

  const needsAttention =
    blockingIssues.length > 0 ||
    channels.some((c) => c.state === "needs-attention");
  const statusColor =
    !published || offMarket
      ? "var(--stage-inactive)"
      : needsAttention
        ? "var(--bp-warning)"
        : "var(--stage-active)";

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="d-flex align-items-center gap-0-5 fs-small">
        <FontAwesomeIcon icon={faCircleWifi} style={{ color: statusColor }} />
        {label}
      </div>
      <Modal open={open} onOpenChange={setOpen}>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Modal.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Manage syndication"
                  >
                    <FontAwesomeIcon icon={faGear} />
                  </Button>
                }
              />
            }
          />
          <Tooltip.Content>Syndication Settings</Tooltip.Content>
        </Tooltip>

        <Modal.Content size="lg" scrollable centered>
          <Modal.Header>
            <Modal.Title>Syndication</Modal.Title>
            {/*
              The old copy said "pushed ... via API", which is only true of the
              direct group. Email channels are not an API push.
            */}
            <Modal.Description>
              Where this listing reaches other listing sites, and when it last
              did.
            </Modal.Description>
          </Modal.Header>

          <Modal.Body className="d-flex flex-column gap-4">
            {blockingIssues.length > 0 && (
              <Alert severity="warning" withIcon>
                <FontAwesomeIcon icon={faTriangleExclamation} />
                <Alert.Title>
                  {blocksSyndication
                    ? "Media issues will block syndication"
                    : "Photos limit your reach"}
                </Alert.Title>
                {/* A lone issue reads as a sentence, the way the live product
                    shows it; bullets only earn their keep once there are two. */}
                {blockingIssues.length === 1 ? (
                  blockingIssues[0]
                ) : (
                  <ul className="mb-0 ps-3">
                    {blockingIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}

            {channels.length === 0 ? (
              <Empty className="py-6">
                <Empty.Media>
                  <FontAwesomeIcon icon={faGear} aria-hidden />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No syndication channels configured</Empty.Title>
                  Connect listing sites in profile or account settings to start
                  syndicating this listing.
                </Empty.Content>
              </Empty>
            ) : (
              GROUPS.map((group) => {
                const groupChannels = channels.filter(
                  (c) => c.delivery === group.delivery,
                );
                if (groupChannels.length === 0) return null;
                return (
                  <SyndicationGroup
                    key={group.delivery}
                    label={group.label}
                    channels={groupChannels}
                    disclaimer={
                      group.delivery === "email"
                        ? AFFILIATION_DISCLAIMER
                        : undefined
                    }
                    websiteUrl={websiteUrl}
                    websiteLabel={websiteLabel}
                    action={
                      group.delivery === "email" ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setOpen(false);
                            setEmailOpen(true);
                          }}
                        >
                          <FontAwesomeIcon icon={faEnvelope} />
                          Email Reps
                        </Button>
                      ) : undefined
                    }
                  />
                );
              })
            )}
          </Modal.Body>

          <Modal.Footer>
            <Modal.Close render={<Button variant="ghost">Close</Button>} />
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      <EmailRepsModal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        channelNames={channels
          .filter((c) => c.delivery === "email")
          .map((c) => c.name)}
        defaultTemplate={defaultTemplate}
      />
    </div>
  );
}

/**
 * One delivery-method group. A group that carries a `disclaimer` renders it
 * below its own cards, so the note stays scoped to the channels it names
 * rather than sitting unattributed at the foot of the modal. `action` is the
 * group's own button, sitting opposite the label.
 */
function SyndicationGroup({
  label,
  channels,
  disclaimer,
  websiteUrl,
  websiteLabel,
  action,
}: {
  label: string;
  channels: SyndicationChannel[];
  disclaimer?: string;
  websiteUrl: string;
  websiteLabel: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between gap-3 pb-2 border-bottom">
        <span className="fs-large fw-semibold">{label}</span>
        {action}
      </div>
      {channels.map((channel) => (
        <SyndicationChannelCard
          key={channel.id}
          channel={channel}
          websiteUrl={websiteUrl}
          websiteLabel={websiteLabel}
        />
      ))}
      {disclaimer && (
        <p className="d-flex gap-2 fs-small text-muted mb-0 mt-1">
          <FontAwesomeIcon icon={faCircleInfo} style={{ marginTop: "0.2em" }} />
          <span>{disclaimer}</span>
        </p>
      )}
    </div>
  );
}
