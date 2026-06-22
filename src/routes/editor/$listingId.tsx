import { createFileRoute, Link } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { EditorRoot } from "#/features/editor/EditorRoot";

export const Route = createFileRoute("/editor/$listingId")({
  component: DocumentEditor,
  head: ({ params }) => {
    const property = getStore().properties.get(params.listingId);
    return {
      meta: [{ title: `Editing — ${property?.name ?? "Document"} | Buildout` }],
    };
  },
});

function DocumentEditor() {
  const { listingId } = Route.useParams();
  const listing = getStore().properties.get(listingId);

  if (!listing) {
    return (
      <div className="container py-8 d-flex justify-content-center">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faBuildingCircleExclamation} aria-label="Property not found" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>Listing not found</Empty.Title>
            We couldn&apos;t find a listing to build a document for.
          </Empty.Content>
          <Empty.Actions>
            <Button variant="primary" render={<Link to="/listings" />}>
              Back to Listings
            </Button>
          </Empty.Actions>
        </Empty>
      </div>
    );
  }

  return <EditorRoot listing={listing} listingId={listingId} />;
}
