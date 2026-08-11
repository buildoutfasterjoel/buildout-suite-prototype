import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import type { MediaAsset, MediaAssetKind } from "#/data/types";
import { assetsInScope, removeAsset, type MediaScope } from "./mediaScope";

/**
 * A grid of uploaded assets for one kind in one scope.
 *
 * Serves Property Photos, Space Photos and Floor Plan — they differ only by
 * `kind`, `title` and scope, so they are one component rather than three.
 *
 * "Add" appends a record pointing at a URL rather than uploading a file: real
 * upload is not modelled anywhere in this prototype, and `VisualMediaLink`
 * already works this way.
 */
export function MediaAssetGrid({
  scope,
  kind,
  title,
  emptyHint,
}: {
  scope: MediaScope;
  kind: MediaAssetKind;
  title: string;
  /** Shown in place of the grid when the scope holds nothing. */
  emptyHint: string;
}) {
  const assets = assetsInScope(scope.marketing, scope.unitId, kind);
  const all = scope.marketing.photos ?? [];

  const add = () => {
    // A derived id (scope + kind + count) collides across a remove-then-add: with
    // nothing monotonic behind the count, deleting an item and adding a new one
    // can regenerate an id still in use by a sibling. Determinism is only needed
    // in the seed fixtures (snapshotted and asserted against); these ids are
    // minted by a user clicking Add, so `crypto.randomUUID()` — already how the
    // rest of this codebase mints runtime ids (`addSpaceToDeal`, `emptyVisualMediaLink`) — is correct and simpler.
    const next: MediaAsset = {
      id: crypto.randomUUID(),
      url: "",
      kind,
      caption: "",
      unitId: scope.unitId,
    };
    scope.patchMarketing({ photos: [...all, next] });
  };

  const remove = (id: string) =>
    scope.patchMarketing({ photos: removeAsset(all, id) });

  const setField = (id: string, patch: Partial<MediaAsset>) =>
    scope.patchMarketing({
      photos: all.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="fs-large fw-semibold mb-0">{title}</h3>
        {!scope.readOnly && (
          <Button variant="ghost" onClick={add}>
            <FontAwesomeIcon icon={faPlus} />
            Add
          </Button>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="form-text">{emptyHint}</div>
      ) : (
        <div className="row g-3">
          {assets.map((a) => (
            <div key={a.id} className="col-6 col-md-4 col-xl-3">
              <Card>
                {a.url ? (
                  <img
                    src={a.url}
                    alt={a.caption || title}
                    className="w-100 rounded-top"
                    style={{
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    className="w-100 rounded-top bg-body-secondary d-flex align-items-center justify-content-center text-muted"
                    style={{ aspectRatio: "4 / 3" }}
                  >
                    No image URL
                  </div>
                )}
                <Card.Body className="p-2 d-flex flex-column gap-2">
                  {scope.readOnly ? (
                    <div className="text-truncate small" title={a.caption}>
                      {a.caption || (
                        <span className="text-muted">Untitled</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <Input
                        className="form-control-sm"
                        placeholder="Image URL"
                        value={a.url}
                        onChange={(e) =>
                          setField(a.id, { url: e.target.value })
                        }
                      />
                      <Input
                        className="form-control-sm"
                        placeholder="Caption"
                        value={a.caption}
                        onChange={(e) =>
                          setField(a.id, { caption: e.target.value })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="align-self-start"
                        onClick={() => remove(a.id)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                        Remove
                      </Button>
                    </>
                  )}
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
