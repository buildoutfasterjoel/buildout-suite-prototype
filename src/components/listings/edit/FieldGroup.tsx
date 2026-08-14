import type { ReactNode } from "react";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import "./listingForm.scss";

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
    <section className="listing-form__group">
      <h3 className="listing-form__group-title fs-large fw-semibold mb-0 d-flex align-items-center gap-2">
        {icon && <FontAwesomeIcon icon={icon} className="text-primary" />}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

/**
 * One labeled cluster of related fields inside a group.
 *
 * These clusters already existed as separate `<FieldGrid>` blocks — roughly 30
 * of them across the form — but consecutive grids were separated by the same
 * 16px that separates two fields, so the grouping never rendered. This draws it.
 *
 * `label` is optional: a group with a single cluster needs the spacing but not a
 * redundant restatement of the group title.
 */
export function SubGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="listing-form__subgroup">
      {label && (
        <div className="listing-form__subgroup-label text-muted">{label}</div>
      )}
      {children}
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
    <Collapsible defaultOpen={false} className="listing-form__more">
      <Collapsible.Trigger className="listing-form__more-toggle text-muted">
        <FontAwesomeIcon
          icon={faChevronRight}
          className="listing-form__more-chevron"
        />
        {label}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="listing-form__more-body">{children}</div>
      </Collapsible.Content>
    </Collapsible>
  );
}
