import type { ReactNode } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";

/**
 * One collapsible section on the contact detail page: the expand chevron, the
 * label + count, and an optional action (e.g. an "Add" button) on the far right.
 *
 * The action is a flex sibling of the trigger rather than a child of it — HTML
 * won't nest a button inside a button, and the click has to toggle the action,
 * not the section. Shared by the left overview column (Deals, Properties, …) and
 * the Tasks column so their headers stay identical. Render inside an
 * `<Accordion className="contact-overview-accordion" …>`.
 */
export function ContactSection({
  value,
  label,
  count,
  primaryCount = false,
  action,
  children,
}: {
  value: string;
  label: string;
  count?: number;
  /**
   * When true, a non-zero count renders as a solid primary (purple) badge; zero
   * falls back to the muted grey badge. Used for the Tasks indicator. Other
   * sections use the grey badge regardless.
   */
  primaryCount?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={value}>
      <div className="contact-accordion__header">
        <Accordion.Trigger>
          <span className="d-flex align-items-center gap-2">
            <span
              className="fw-semibold"
              style={{ fontSize: 20, lineHeight: "26px" }}
            >
              {label}
            </span>
            {count !== undefined &&
              (primaryCount && count > 0 ? (
                <Badge variant="primary">{count}</Badge>
              ) : (
                <Badge
                  variant="secondary"
                  appearance="muted"
                  style={{ backgroundColor: "#ECEEF2" }}
                >
                  {count}
                </Badge>
              ))}
          </span>
        </Accordion.Trigger>
        {action && <div className="contact-accordion__action">{action}</div>}
      </div>
      <Accordion.Content>{children}</Accordion.Content>
    </Accordion.Item>
  );
}
