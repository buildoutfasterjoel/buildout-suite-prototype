import { useLocation, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faChartSimple, faBookmark } from "@fortawesome/pro-regular-svg-icons";

type ReportsNavItem = { label: string; to: string; icon: IconDefinition };

/**
 * Two sections only, so this is a flat pill list — the collapsible grouping
 * SettingsSidebar uses would be pure chrome over two items.
 */
const REPORTS_NAV: ReportsNavItem[] = [
  { label: "Standard reports", to: "/reports/standard", icon: faChartSimple },
  { label: "My reports", to: "/reports/my-reports", icon: faBookmark },
];

export function ReportsSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const active =
    REPORTS_NAV.find((item) => pathname.startsWith(item.to))?.label ??
    REPORTS_NAV[0].label;

  function goTo(label: string) {
    const item = REPORTS_NAV.find((i) => i.label === label);
    if (!item) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: item.to } as any);
  }

  return (
    <nav className="px-3 py-3" aria-label="Report sections">
      <Tabs value={active} onValueChange={goTo} orientation="vertical">
        <Tabs.List variant="pills" orientation="vertical">
          {REPORTS_NAV.map((item) => (
            <Tabs.Tab
              key={item.label}
              value={item.label}
              icon={<FontAwesomeIcon icon={item.icon} />}
              onClick={() => goTo(item.label)}
            >
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </nav>
  );
}
