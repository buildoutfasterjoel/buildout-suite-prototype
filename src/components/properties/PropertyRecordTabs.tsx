import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PROPERTY_NAV_ITEMS } from "./propertyNav";

/**
 * The Property record's sections as underline tabs across the top of the main
 * column — the shape Buildout's own property page uses (Details · Activities ·
 * Comps · …), rather than the deal shell's 180px side nav. Two sections do not
 * earn a sidebar, and the right rail wants the width.
 */
export function PropertyRecordTabs({
  propertyId,
  activeLabel,
  counts,
}: {
  propertyId: string;
  activeLabel: string | null;
  /** Count badge per section label, where one applies (Spaces). */
  counts?: Partial<Record<string, number>>;
}) {
  const navigate = useNavigate();

  function handleTabChange(value: string) {
    const item = PROPERTY_NAV_ITEMS.find((i) => i.label === value);
    if (!item) return;
    void navigate({ to: `/properties/${propertyId}/${item.href}` });
  }

  return (
    // Flush with the card's top edge, the strip's rule running edge to edge —
    // as on Buildout's property page. The list carries a small inset so the first
    // tab does not touch the card's corner; the content below keeps its own p-4.
    <Tabs value={activeLabel ?? ""} onValueChange={handleTabChange}>
      <Tabs.List variant="default" className="px-2">
        {PROPERTY_NAV_ITEMS.map((item) => {
          const count = counts?.[item.label];
          return (
            <Tabs.Tab key={item.label} value={item.label} icon={<FontAwesomeIcon icon={item.icon} />}>
              {/* One inline-flex run, so the count sits beside the label rather
                  than wrapping under it inside the tab's text slot. */}
              <span className="d-inline-flex align-items-center gap-2 text-nowrap">
                {item.label}
                {count != null && (
                  <Badge variant="secondary" appearance="muted" className="fs-xs">
                    {count}
                  </Badge>
                )}
              </span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs>
  );
}
