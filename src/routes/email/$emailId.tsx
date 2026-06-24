import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartColumn,
  faUserGroupSimple,
  faEye,
  faEnvelopeCircleCheck,
  faPersonDigging,
} from "@fortawesome/pro-regular-svg-icons";
import { getEmailById, getEmailPerformance } from "#/data/emails";
import { EmailCampaignHeader } from "#/components/email/EmailCampaignHeader";
import { EmailMetaCard } from "#/components/email/EmailMetaCard";
import { EmailPerformanceTab } from "#/components/email/EmailPerformanceTab";

export const Route = createFileRoute("/email/$emailId")({
  component: EmailCampaignDetail,
  head: ({ params }) => {
    const email = getEmailById(params.emailId);
    return {
      meta: [{ title: `${email?.subject ?? "Campaign"} | Buildout Suite` }],
    };
  },
});

function CampaignNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon
            icon={faEnvelopeCircleCheck}
            aria-label="Campaign not found"
          />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Campaign not found</Empty.Title>
          We couldn&apos;t find performance for this campaign. It may not have
          been sent yet, or the link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" nativeButton={false} render={<Link to="/email" />}>
            Back to Emails
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

/** Centered placeholder for tabs not yet built (Recipients, Preview Email). */
function ComingSoon({ title }: { title: string }) {
  return (
    <Empty className="py-6">
      <Empty.Media>
        <FontAwesomeIcon icon={faPersonDigging} aria-label={title} />
      </Empty.Media>
      <Empty.Content>
        <Empty.Title>{title}</Empty.Title>
        This view is coming in a future update.
      </Empty.Content>
    </Empty>
  );
}

function EmailCampaignDetail() {
  const { emailId } = Route.useParams();
  const email = getEmailById(emailId);
  const [tab, setTab] = useState("performance");

  // Only sent campaigns have performance to show.
  if (!email || email.status !== "sent") return <CampaignNotFound />;

  const performance = getEmailPerformance(email);

  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      <EmailCampaignHeader email={email} />

      <div className="container py-4 d-flex flex-column gap-4">
        <EmailMetaCard email={email} performance={performance} />

        <Card>
          <Card.Body className="d-flex flex-column gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v ?? "performance")} className="email-campaign-tabs">
              <Tabs.List>
                <Tabs.Tab
                  value="performance"
                  icon={<FontAwesomeIcon icon={faChartColumn} />}
                >
                  Performance
                </Tabs.Tab>
                <Tabs.Tab
                  value="recipients"
                  icon={<FontAwesomeIcon icon={faUserGroupSimple} />}
                >
                  Recipients
                  <Badge
                    variant="secondary"
                    appearance="muted"
                    className="fs-xs ms-1"
                  >
                    {performance.recipientCount}
                  </Badge>
                </Tabs.Tab>
                <Tabs.Tab
                  value="preview"
                  icon={<FontAwesomeIcon icon={faEye} />}
                >
                  Preview Email
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            {tab === "performance" && (
              <EmailPerformanceTab performance={performance} />
            )}
            {tab === "recipients" && <ComingSoon title="Recipients" />}
            {tab === "preview" && <ComingSoon title="Preview Email" />}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
