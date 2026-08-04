import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * Stand-in for a settings section that isn't built yet. Every nav item routes
 * somewhere real so the grouped sidebar can be evaluated end to end.
 */
export function SettingsPlaceholder({
  title,
  icon,
  description,
}: {
  title: string;
  icon: IconDefinition;
  description: string;
}) {
  return (
    <div className="d-flex justify-content-center py-8">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={icon} aria-hidden />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>{title}</Empty.Title>
          {description}
        </Empty.Content>
      </Empty>
    </div>
  );
}
