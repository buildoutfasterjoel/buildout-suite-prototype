import type { ReactNode } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/pro-regular-svg-icons";

/**
 * One collapsible section on the contact detail page: chevron on the LEFT of the
 * label + count, with the right side reserved for an optional action (e.g. an
 * "Add" button). The action button is overlaid on the header (a sibling of the
 * trigger) so it toggles its own click, not the section.
 *
 * Shared by the left overview column (Deals, Properties, …) and the Tasks
 * column so their headers stay visually identical. Render inside an
 * `<Accordion className="contact-overview-accordion" …>`.
 */
export function ContactSection({
  value,
  label,
  count,
  open,
  action,
  children,
}: {
  value: string;
  label: string;
  count?: number;
  open: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="position-relative">
      <Accordion.Trigger>
        <span className="d-flex align-items-center gap-2">
          <FontAwesomeIcon
            icon={open ? faChevronDown : faChevronRight}
            className="text-muted"
            style={{ width: 12 }}
          />
          <span className="fw-semibold" style={{ fontSize: 20, lineHeight: "26px" }}>
            {label}
          </span>
          {count !== undefined && (
            <Badge variant="secondary" appearance="muted">
              {count}
            </Badge>
          )}
        </span>
      </Accordion.Trigger>
      {action && <div className="contact-accordion__action">{action}</div>}
      <Accordion.Content>{children}</Accordion.Content>
    </Accordion.Item>
  );
}
