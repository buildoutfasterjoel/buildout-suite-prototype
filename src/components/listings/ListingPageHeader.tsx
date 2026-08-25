/**
 * Page-level header shared by every listing subpage: a title on the left with
 * optional actions on the right. The listing name itself is the page `h1`
 * (in PropertyDetailHeader), so subpage titles are `h2`.
 *
 * `meta` is for a badge or short line that belongs to the title — the Voucher's
 * status pill, say. It sits under the title rather than in `actions` so the
 * right-hand side stays what it says it is: the things you can *do* here. A
 * status pill wedged against a primary button reads as part of the control.
 */
export function ListingPageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3">
      {/* `gap-1` (4px): the pill belongs to the title, so it sits closer to it
          than the header does to the content below. */}
      <div className="d-flex flex-column align-items-start gap-1">
        <h2 className="fs-6 mb-0 fw-semibold">{title}</h2>
        {meta}
      </div>
      {actions && (
        <div className="d-flex align-items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
