import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faCalendar } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { contactFullName } from "#/components/contacts/contactDisplay";

/**
 * Right column of the contact detail page: the contact's open tasks.
 *
 * Structural placeholder for now — per-contact task records don't exist yet
 * (tasks are deal-level), so this shows a stub open-task list sized to the
 * aggregate `openTaskCount` plus a completed-tasks toggle. Real task data and
 * styling come in a later pass.
 */
export function ContactTasksPanel({
  contact,
  openTaskCount,
}: {
  contact: Contact;
  openTaskCount: number;
}) {
  // Stub rows so the structure is visible; capped at the real open count.
  const stubCount = Math.min(openTaskCount, 3);
  const stubs = Array.from({ length: stubCount }, (_, i) => i);
  const name = contactFullName(contact);

  return (
    <Card className="shadow-sm d-flex flex-column h-100 overflow-hidden">
      <Card.Body className="d-flex flex-column gap-3 overflow-hidden">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <Card.Title
            className="fw-bold d-inline-flex align-items-center gap-2 mb-0"
            style={{ fontSize: 17 }}
          >
            Tasks
            <Badge variant="secondary" appearance="muted">
              {openTaskCount}
            </Badge>
          </Card.Title>
          <Button variant="ghost" size="icon-sm" aria-label="Add task">
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        </div>

        <div className="d-flex flex-column gap-2 overflow-auto">
          {stubs.length === 0 ? (
            <span className="text-muted fs-small">
              No open tasks — AI queues them after your next call or email.
            </span>
          ) : (
            stubs.map((i) => (
              <div
                key={i}
                className="d-flex align-items-start gap-2 border rounded p-2"
              >
                <Checkbox aria-label="Complete task" />
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fw-semibold lh-sm">
                    Confirm {name}&apos;s valuation cap before the listing window
                    closes
                  </div>
                  <div className="text-muted fs-small mt-1 d-inline-flex align-items-center gap-1">
                    <FontAwesomeIcon icon={faCalendar} />
                    Due soon
                  </div>
                </div>
              </div>
            ))
          )}

          <Button variant="ghost" size="sm" className="align-self-center mt-1">
            Show completed tasks
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
