import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type DealPagePlaceholderProps = {
  title: string;
  icon: IconDefinition;
  description?: string;
};

export function DealPagePlaceholder({
  title,
  icon,
  description,
}: DealPagePlaceholderProps) {
  return (
    <div className="py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={icon} aria-label={title} />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>{title}</Empty.Title>
          {description ?? "This section is coming soon."}
        </Empty.Content>
      </Empty>
    </div>
  );
}
