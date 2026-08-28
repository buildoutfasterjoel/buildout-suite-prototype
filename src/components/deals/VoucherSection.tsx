/**
 * The voucher page's group heading.
 *
 * Its own module because two files render one now — `DealFinancials` and
 * `VoucherPayables` — and having the second import it from the first would
 * close an import cycle, since `DealFinancials` renders the payables section.
 */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <h3 className="fs-large fw-semibold mb-0">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
