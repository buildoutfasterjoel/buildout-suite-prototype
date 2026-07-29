import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
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

const AFFILIATION_DISCLAIMER =
  "Buildout has no financial, legal, commercial, or partnership affiliation with CoStar Group, Inc., LoopNet, or Crexi, Inc. No association or relationship between these companies should be implied or inferred. Buildout assists customers in sending email updates to these unaffiliated channels when listings are added, updated, or removed.";

const GROUPS: {
  delivery: SyndicationDelivery;
  label: string;
  /** How this group's "n of m" count reads — these channels behave differently. */
  verb: string;
}[] = [
  { delivery: "direct", label: "Direct connections", verb: "syndicating" },
  { delivery: "email", label: "Email updates", verb: "sending" },
];

/**
 * Header widget: an at-a-glance syndication status button that opens a modal
 * with per-channel status, dates, links, on/off toggles, and the disclaimers
 * that qualify each group.
 */
export function SyndicationStatus({ listing }: { listing: Listing }) {
  const { channels: initialChannels, blockingIssues } =
    getListingSyndication(listing);
  const [channels, setChannels] = useState(initialChannels);
  const rep = listing.internalBrokers[0];
  const websiteUrl = getListingWebsiteSettings(listing).websiteUrl;
  const websiteLabel =
    listing.dealType === "Lease" ? "Lease Website" : "Sale Website";

  const published = listing.publishedAt != null;
  // A Closed or Lost deal that was published is off-market now — show its history
  // without implying it is still live.
  const offMarket =
    published && (listing.status === "closed" || listing.status === "inactive");
  const activeCount = channels.filter((c) => c.active).length;
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

  const toggle = (id: string, active: boolean) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active } : c)),
    );
  };

  const toggleGroup = (delivery: SyndicationDelivery, active: boolean) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.delivery !== delivery || c.state === "not-available"
          ? c
          : { ...c, active },
      ),
    );
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="d-flex align-items-center gap-0-5 fs-small">
        <FontAwesomeIcon icon={faCircleWifi} style={{ color: statusColor }} />
        {label}
      </div>
      <Modal>
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
                <Alert.Title>Photos limit your reach</Alert.Title>
                <ul className="mb-0 ps-3">
                  {blockingIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
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
                    verb={group.verb}
                    channels={groupChannels}
                    informational={group.delivery === "email"}
                    websiteUrl={websiteUrl}
                    websiteLabel={websiteLabel}
                    onToggle={toggle}
                    onToggleAll={(active) => toggleGroup(group.delivery, active)}
                  />
                );
              })
            )}
          </Modal.Body>

          <Modal.Footer>
            <Modal.Close render={<Button variant="ghost">Close</Button>} />
            {rep && (
              <Button
                variant="primary"
                nativeButton={false}
                render={<a href={`mailto:${rep.email}`} />}
              >
                <FontAwesomeIcon icon={faEnvelope} />
                Send Rep Email
              </Button>
            )}
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}

/**
 * One delivery-method group. The email group renders on an informational
 * surface with its affiliation disclaimer inside, so the note is visually
 * scoped to the channels it actually names. Deliberately not an Alert:
 * nothing is wrong with these channels.
 */
function SyndicationGroup({
  label,
  verb,
  channels,
  informational,
  websiteUrl,
  websiteLabel,
  onToggle,
  onToggleAll,
}: {
  label: string;
  verb: string;
  channels: SyndicationChannel[];
  informational: boolean;
  websiteUrl: string;
  websiteLabel: string;
  onToggle: (id: string, active: boolean) => void;
  onToggleAll: (active: boolean) => void;
}) {
  const eligible = channels.filter((c) => c.state !== "not-available");
  const activeCount = channels.filter((c) => c.active).length;
  const allActive = eligible.length > 0 && eligible.every((c) => c.active);

  const body = (
    <div className="d-flex flex-column gap-2">
      {channels.map((channel) => (
        <SyndicationChannelCard
          key={channel.id}
          channel={channel}
          websiteUrl={websiteUrl}
          websiteLabel={websiteLabel}
          onToggle={(active) => onToggle(channel.id, active)}
        />
      ))}
      {informational && (
        <p
          className="d-flex gap-2 fs-small text-muted mb-0 mt-1"
          style={{ maxWidth: "62ch" }}
        >
          <FontAwesomeIcon
            icon={faCircleInfo}
            style={{ color: "var(--channel-info-strong)", marginTop: "0.2em" }}
          />
          <span>{AFFILIATION_DISCLAIMER}</span>
        </p>
      )}
    </div>
  );

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between gap-3 pb-2 border-bottom">
        <span className="text-uppercase fw-medium fs-small text-muted">
          {label}
        </span>
        <div className="d-flex align-items-center gap-2">
          <span className="fs-small text-muted">
            {activeCount} of {channels.length} {verb}
          </span>
          <Switch
            checked={allActive}
            disabled={eligible.length === 0}
            onCheckedChange={onToggleAll}
            aria-label={`Toggle all ${label.toLowerCase()}`}
          />
        </div>
      </div>
      {informational ? (
        <div
          className="rounded p-3"
          style={{
            background: "var(--channel-info-surface)",
            border: "1px solid var(--channel-info-border)",
          }}
        >
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  );
}
