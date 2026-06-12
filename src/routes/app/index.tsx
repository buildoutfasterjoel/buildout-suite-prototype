import { createFileRoute } from "@tanstack/react-router";
import {
  Empty,
  EmptyTitle,
  EmptyContent,
  EmptyActions,
} from "@buildoutinc/blueprint-react/ui/Empty";
import { faArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  return (
    <div className="d-flex align-items-center justify-content-center h-100 p-8">
      <Empty>
        <EmptyTitle>No prototype loaded</EmptyTitle>
        <EmptyContent>
          Navigate to a prototype route under <code>/app</code> to see it
          rendered inside this layout.
        </EmptyContent>
        <EmptyActions>
          <Link to="/" className="btn btn-secondary btn-sm">
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to prototype directory
          </Link>
        </EmptyActions>
      </Empty>
    </div>
  );
}
