import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faFloppyDisk,
  faSignal,
} from "@fortawesome/pro-regular-svg-icons";

/**
 * The header band every report wears: breadcrumb back to the catalog, the
 * report's name, and the two actions.
 *
 * This is the only piece extracted from the first report, and it is judged by
 * whether the *second* report can wear it unchanged — which is why nothing
 * Pipeline-specific (its filters, its columns) appears here.
 *
 * Actions and Save As are inert this phase: they render enabled and do nothing.
 * Deliberately not `disabled`, which reads as "unavailable to you" when the
 * truth is "not built yet". Column management and report saving are later
 * phases that fill these slots rather than redesign the band.
 */
export function ReportShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <div className="bg-card border-bottom">
        <div className="container p-4 d-flex align-items-center gap-3">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <Breadcrumb className="mb-1">
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<Link to="/reports/standard" />}>
                    <FontAwesomeIcon icon={faSignal} />
                    Reports
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Page>{title}</Breadcrumb.Page>
                </Breadcrumb.Item>
              </Breadcrumb.List>
            </Breadcrumb>
            <h1 className="fs-4 fw-semibold mb-0">{title}</h1>
          </div>

          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button variant="outline">
                  Actions
                  <FontAwesomeIcon icon={faChevronDown} />
                </Button>
              }
            />
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item>Edit Columns</DropdownMenu.Item>
              <DropdownMenu.Item>Export to PDF</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>

          <Button>
            <FontAwesomeIcon icon={faFloppyDisk} />
            Save As
          </Button>
        </div>
      </div>

      <div className="container py-4">{children}</div>
    </div>
  );
}
