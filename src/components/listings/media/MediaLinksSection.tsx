import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import type { MediaScope } from "./mediaScope";
import { LINK_KINDS, linkInScope, upsertLink } from "./mediaLinks";

/**
 * The three named destinations for one scope — one row each, not an add-more list.
 * `upsertLink` is what keeps that true in the data.
 */
export function MediaLinksSection({ scope }: { scope: MediaScope }) {
  const all = scope.marketing.links ?? [];

  return (
    <div className="d-flex flex-column gap-2">
      <h3 className="fs-large fw-semibold mb-0">Links</h3>
      <div className="d-flex flex-column gap-3">
        {LINK_KINDS.map(({ kind, label }) => {
          const current = linkInScope(all, kind, scope.unitId);
          if (scope.readOnly) {
            return (
              <div key={kind} className="d-flex flex-column">
                <span className="small fw-semibold">{label}</span>
                {current?.url ? (
                  <a href={current.url} target="_blank" rel="noreferrer" className="text-truncate">
                    {current.url}
                  </a>
                ) : (
                  <span className="text-muted small">Not set</span>
                )}
              </div>
            );
          }
          return (
            <Field key={kind}>
              <Field.Label>{label}</Field.Label>
              <Input
                placeholder="https://"
                value={current?.url ?? ""}
                onChange={(e) =>
                  scope.patchMarketing({
                    links: upsertLink(all, kind, scope.unitId, e.target.value),
                  })
                }
              />
            </Field>
          );
        })}
      </div>
    </div>
  );
}
