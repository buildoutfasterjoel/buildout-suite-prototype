/**
 * The record-form shell: groups, clusters, and the long-tail disclosure.
 *
 * For the app's two LONG record forms only — the Listing form
 * (`/listings/:id/listing`) and the Deal form (`/listings/:id/edit`).
 *
 * Do NOT reach for this in a short form. Modals, filter flyouts, and anything
 * under roughly six fields keep plain stacked Blueprint `Field`s: the 164px
 * label gutter and the tile stack pay for themselves across twenty-plus fields
 * and cost more than they return on four.
 */
import type { ReactNode } from "react";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import "./recordForm.scss";

/**
 * One top-level group on the Listing form — Location, The Asset, Marketing.
 *
 * Deliberately NOT the `Section` in `listingWidgets.tsx`: that one is shared
 * with the Deal editor, and this needs its own spacing rhythm without changing
 * how the Deal editor looks. The heading keeps `fs-large` (17px) — the scale is
 * full at 24/20/17/14 and 20px would collide with the page title, so the 72px
 * gap between groups does the separating instead of a size bump.
 */
export function FieldGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconDefinition;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="d-flex align-items-center gap-2 fs-large fw-semibold py-3">
        {icon && <FontAwesomeIcon icon={icon} className="text-primary" />}
        {title}
      </h3>
      {/* Transparent — the panel moved down to each cluster, so a group is now a
          stack of tiles rather than one slab with rules through it. `gap-1` (4px)
          is doing real work at that size: wide enough that each tile reads as its
          own container, tight enough that the run reads as one group. Anything
          looser and the tiles stop belonging to each other. */}
      <div className="d-flex flex-column gap-1">{children}</div>
    </section>
  );
}

/**
 * One cluster of related fields inside a group — its own `bg-body` tile, with
 * the name in a left gutter and fields in the right column.
 *
 * The tile is what separates one cluster from the next; consecutive tiles sit
 * 4px apart. That replaced a hairline rule inside a single shared panel, which
 * drew the boundary but left every cluster looking like more of the same slab.
 * A tile has an edge on all four sides, so a cluster reads as a container that
 * wraps its own content — and at a 4px gap the run still reads as one group.
 *
 * The gutter is the point. Two earlier passes put the label *above* its fields:
 * first as a 17px heading (which competed with the group title), then as a 14px
 * muted line (which read as floating text belonging to nothing). Both failed for
 * the same structural reason — a label stacked above a block is only attached to
 * it by proximity, and proximity was already carrying the field/cluster tiers.
 * In a gutter the label is attached by *position*: it sits beside exactly the
 * fields it names, in a column no field label ever occupies, so it cannot
 * compete and cannot drift. Jobber and Deputy both solve dense record forms this
 * way.
 *
 * It also fixes line length for free. Full-bleed rows ran ~920px, long enough
 * that a column of them reads as an undifferentiated wall; the gutter takes a
 * quarter of that back and caps fields near 700px.
 *
 * `gap-2` (8px) inside the right column stays the *bound* tier: a switch sits
 * tight under the field it governs, and the field it reveals tight under it.
 */
export function SubGroup({
  label,
  description,
  children,
}: {
  label?: string;
  /** One line on what the cluster is for. Gives the gutter label a reason to
   *  exist — a bare noun over a stack of fields reads as arbitrary. */
  description?: string;
  children: ReactNode;
}) {
  // The tile and the grid are separate elements on purpose: `.row` carries
  // negative side margins to cancel its gutters, so padding and a background on
  // the same node would bleed the panel past the column edges.
  return (
    <div className="record-form__subgroup bg-body rounded p-4">
      <div className="row">
        <div className="col-md-3">
          {label && <div className="record-form__subgroup-label">{label}</div>}
          {description && (
            <p className="record-form__subgroup-desc fs-small text-muted">
              {description}
            </p>
          )}
        </div>
        <div className="col-md-9 d-flex gap-2 flex-column">{children}</div>
      </div>
    </div>
  );
}

/**
 * The long-tail disclosure at the end of a group.
 *
 * Replaces the old `<Accordion>` whose trigger was an `<h3>` reading
 * "Show/Hide Additional Fields" — the same heading level as the group titles it
 * competed with, and the same 14px/600 as the field labels it sat between. This
 * is a muted ghost toggle named for its contents.
 *
 * Never put an ingestion-conflict field in here: Blueprint's `Collapsible`
 * passes `keepMounted` to the panel and toggles Bootstrap's `.collapse`/`.show`
 * classes, so a closed panel stays in the DOM (`getElementById` still resolves)
 * but is rendered `display: none`. `?review=ingestion`'s `scrollIntoView` would
 * be a no-op on a hidden element, and the field would be invisible to the
 * broker regardless of whether the scroll "worked."
 */
export function AdditionalFields({
  label,
  children,
}: {
  /** Names the contents, e.g. "Show 19 more building fields". */
  label: string;
  children: ReactNode;
}) {
  return (
    // Its own tile, so the disclosure sits in the stack as a peer of the
    // clusters rather than floating between two panels.
    <Collapsible
      defaultOpen={false}
      className="record-form__more bg-body rounded p-4"
    >
      <Collapsible.Trigger className="record-form__more-toggle">
        <FontAwesomeIcon
          icon={faChevronRight}
          className="record-form__more-chevron"
        />
        {label}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="record-form__more-body">{children}</div>
      </Collapsible.Content>
    </Collapsible>
  );
}
