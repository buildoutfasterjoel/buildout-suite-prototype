import type { ReactNode } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";

/**
 * One collapsible section on the contact detail page, styled to match the deal
 * detail rail's Seller/Buyer/Other accordions: the expand chevron sits on the
 * RIGHT (Blueprint's default), an optional action (e.g. an "Add" button) sits
 * just to its left, and the panel content has a subtle grey background.
 *
 * The action is an overlaid sibling of the trigger (not nested inside it) so it
 * toggles its own click, not the section. Shared by the left overview column
 * (Deals, Properties, …) and the Tasks column so their headers stay identical.
 * Render inside an `<Accordion className="contact-overview-accordion" …>`.
 */
export function ContactSection({
  value,
  label,
  count,
  action,
  children,
}: {
  value: string;
  label: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="position-relative">
      <Accordion.Trigger>
        <span className="d-flex align-items-center gap-2">
          <span
            className="fw-semibold"
            style={{ fontSize: 20, lineHeight: "26px" }}
          >
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
