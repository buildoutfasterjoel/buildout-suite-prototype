/**
 * Page-level header shared by every listing subpage: a title on the left with
 * optional actions on the right. The listing name itself is the page `h1`
 * (in PropertyDetailHeader), so subpage titles are `h2`.
 */
export function ListingPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3">
      <h2 className="fs-4 mb-0">{title}</h2>
      {actions && (
        <div className="d-flex align-items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
