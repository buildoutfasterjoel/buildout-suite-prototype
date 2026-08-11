import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan, faArrowUpRight } from "@fortawesome/pro-regular-svg-icons";
import type { VisualMediaLink, VisualMediaType } from "#/data/types";
import { buildingWide, ownedByUnit } from "#/data/unitScopedMarketing";
import { VISUAL_MEDIA_TYPES } from "./visualMediaTypes";
import type { MediaScope } from "./mediaScope";

/**
 * Visual Media for one scope: repeatable rows of preset embed types.
 *
 * Shares `VISUAL_MEDIA_TYPES` with the listing form's `VisualMediaSection` so the
 * two dropdowns cannot offer different subsets of the same union.
 */
export function VisualMediaGallery({ scope }: { scope: MediaScope }) {
  const all = scope.marketing.visualMedia ?? [];
  const rows = scope.unitId ? ownedByUnit(all, scope.unitId) : buildingWide(all);

  const add = () =>
    scope.patchMarketing({
      visualMedia: [
        ...all,
        {
          // A uuid, not an id derived from `all.length`: a derived index is
          // recomputed from current state each time, so remove-then-add reuses a
          // live id, and both `update` and `remove` match on `l.id`. Determinism
          // is only wanted in the seed fixtures, which are snapshotted; ids minted
          // by a user clicking Add are not. Same reason `addSpaceToDeal` and
          // `emptyVisualMediaLink` use `crypto.randomUUID()`.
          id: crypto.randomUUID(),
          url: "",
          mediaType: VISUAL_MEDIA_TYPES[0],
          unitId: scope.unitId,
        } satisfies VisualMediaLink,
      ],
    });

  const update = (id: string, patch: Partial<VisualMediaLink>) =>
    scope.patchMarketing({
      visualMedia: all.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });

  const remove = (id: string) =>
    scope.patchMarketing({ visualMedia: all.filter((l) => l.id !== id) });

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="fs-large fw-semibold mb-0">Visual Media</h3>
        {!scope.readOnly && (
          <Button variant="ghost" onClick={add}>
            <FontAwesomeIcon icon={faPlus} />
            Add media
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="form-text">No visual media yet.</div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((l) => (
            <div key={l.id} className="d-flex align-items-center gap-2">
              {scope.readOnly ? (
                <>
                  <span className="small fw-semibold" style={{ minWidth: 160 }}>
                    {l.mediaType}
                  </span>
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-truncate">
                      {l.url} <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 12 }} />
                    </a>
                  ) : (
                    <span className="text-muted small">Not set</span>
                  )}
                </>
              ) : (
                <>
                  <Select
                    value={l.mediaType}
                    onValueChange={(v) => v && update(l.id, { mediaType: v as VisualMediaType })}
                  >
                    <Select.Trigger style={{ maxWidth: 200 }}>
                      <Select.Value>{(v) => String(v)}</Select.Value>
                    </Select.Trigger>
                    <Select.Content>
                      {VISUAL_MEDIA_TYPES.map((t) => (
                        <Select.Item key={t} value={t}>
                          {t}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  <Input
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) => update(l.id, { url: e.target.value })}
                  />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => remove(l.id)}>
                    <FontAwesomeIcon icon={faTrashCan} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
