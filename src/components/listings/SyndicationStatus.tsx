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
  faCircleExclamation,
  faCircleWifi,
} from "@fortawesome/pro-regular-svg-icons";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import {
  getListingSyndication,
  type SyndicationConnectionStatus,
} from "#/data/listingSyndication";

const STATUS_LABELS: Record<SyndicationConnectionStatus, string> = {
  connected: "Connected",
  "needs-attention": "Needs Attention",
  "not-available": "Not Available",
};

const STATUS_COLORS: Record<SyndicationConnectionStatus, string> = {
  connected: "var(--stage-active)",
  "needs-attention": "var(--bp-warning)",
  "not-available": "var(--stage-inactive)",
};

function ConnectionStatusIndicator({
  status,
}: {
  status: SyndicationConnectionStatus;
}) {
  return (
    <span
      className="d-inline-flex align-items-center gap-1 text-muted text-nowrap"
      style={{ fontSize: 12 }}
    >
      <span
        className="rounded-circle"
        style={{
          width: 6,
          height: 6,
          backgroundColor: STATUS_COLORS[status],
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Header widget: an at-a-glance syndication status button that opens a modal
 * with per-network connection status, on/off toggles, blocking issues, and a
 * rep-email action. "Networks" are API connections to third-party listing
 * sites, not business partnerships.
 */
export function SyndicationStatus({ listing }: { listing: Listing }) {
  const { networks: initialNetworks, blockingIssues } = getListingSyndication(
    listing.id,
  );
  const [networks, setNetworks] = useState(initialNetworks);
  const rep = listing.internalBrokers[0];

  const activeCount = networks.filter((n) => n.active).length;
  const label =
    networks.length === 0 || activeCount === 0
      ? "Not syndicating"
      : `Syndicating to ${activeCount}/${networks.length} networks`;

  const needsAttention =
    blockingIssues.length > 0 ||
    networks.some((n) => n.status === "needs-attention");
  const statusColor = needsAttention
    ? "var(--bp-warning)"
    : activeCount > 0
      ? "var(--stage-active)"
      : "var(--stage-inactive)";

  const toggle = (id: string, active: boolean) => {
    setNetworks((prev) =>
      prev.map((n) => (n.id === id ? { ...n, active } : n)),
    );
  };

  const eligibleNetworks = networks.filter((n) => n.status !== "not-available");
  const allActive =
    eligibleNetworks.length > 0 && eligibleNetworks.every((n) => n.active);

  const toggleAll = (active: boolean) => {
    setNetworks((prev) =>
      prev.map((n) => (n.status === "not-available" ? n : { ...n, active })),
    );
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <Modal>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Modal.Trigger
                render={
                  <Button
                    variant="secondary"
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
            <Modal.Description>
              Where this listing's data is pushed to other listing sites via
              API.
            </Modal.Description>
          </Modal.Header>

          <Modal.Body className="d-flex flex-column gap-3">
            {blockingIssues.length > 0 && (
              <Alert severity="warning" withIcon>
                <FontAwesomeIcon icon={faTriangleExclamation} />
                <Alert.Title>Syndication is blocked</Alert.Title>
                <ul className="mb-0 ps-3">
                  {blockingIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {networks.length === 0 ? (
              <Empty className="py-6">
                <Empty.Media>
                  <FontAwesomeIcon icon={faGear} aria-hidden />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No syndication networks configured</Empty.Title>
                  Connect listing sites in profile or account settings to start
                  syndicating this listing.
                </Empty.Content>
              </Empty>
            ) : (
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center justify-content-between pb-2 border-bottom">
                  <span className="fw-medium">Syndicate to all networks</span>
                  <Switch
                    checked={allActive}
                    onCheckedChange={toggleAll}
                    aria-label="Toggle syndication to all networks"
                  />
                </div>
                {networks.map((network) => (
                  <div
                    key={network.id}
                    className="d-flex align-items-center justify-content-between border rounded px-3 py-2"
                  >
                    <div className="d-flex flex-column gap-1">
                      <span className="fw-medium">{network.name}</span>
                      <div className="d-flex align-items-center gap-2">
                        <ConnectionStatusIndicator status={network.status} />
                        {network.status === "needs-attention" && (
                          <Tooltip>
                            <Tooltip.Trigger
                              render={
                                <span className="text-warning">
                                  <FontAwesomeIcon icon={faCircleExclamation} />
                                </span>
                              }
                            />
                            <Tooltip.Content side="top">
                              This connection needs attention before it can
                              syndicate reliably.
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={network.active}
                      disabled={network.status === "not-available"}
                      onCheckedChange={(checked) => toggle(network.id, checked)}
                      aria-label={`Toggle syndication to ${network.name}`}
                    />
                  </div>
                ))}
              </div>
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
      <div className="d-flex align-items-center gap-0-5 fs-small">
        <FontAwesomeIcon icon={faCircleWifi} style={{ color: statusColor }} />
        {label}
      </div>
    </div>
  );
}
