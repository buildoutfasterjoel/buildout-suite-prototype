import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-regular-svg-icons";

type Stat = { label: string; value: string; tip: string };

const STATS: Stat[] = [
  {
    label: "Delivered",
    value: "100%",
    tip: "Percentage of sent emails that reached the recipient's inbox.",
  },
  {
    label: "Opens",
    value: "23%",
    tip: "Percentage of delivered emails that were opened at least once.",
  },
  {
    label: "Clicks",
    value: "22%",
    tip: "Percentage of delivered emails where a link was clicked.",
  },
  {
    label: "Bounced",
    value: "2%",
    tip: "Percentage of emails that could not be delivered.",
  },
  {
    label: "Unsubscribed",
    value: "14%",
    tip: "Percentage of recipients who opted out after this send.",
  },
];

/** "Email Performance" summary card — five aggregate metrics with info tooltips. */
export function EmailPerformanceStats() {
  return (
    <Card>
      <Card.Body className="d-flex flex-column gap-3">
        <h2 className="fs-5 fw-semibold mb-0">Email Performance</h2>
        <div className="d-flex flex-wrap gap-2">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="position-relative border rounded p-3 flex-fill"
              style={{ minWidth: 160 }}
            >
              <div className="fs-2 fw-semibold lh-1">{stat.value}</div>
              <div className="text-muted mt-1">{stat.label}</div>
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <span
                      className="position-absolute top-0 end-0 m-2 text-muted lh-1"
                      role="button"
                      tabIndex={0}
                      aria-label={`About ${stat.label}`}
                    >
                      <FontAwesomeIcon icon={faCircleInfo} />
                    </span>
                  }
                />
                <Tooltip.Content>{stat.tip}</Tooltip.Content>
              </Tooltip>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
