import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faSwatchbook } from "@fortawesome/pro-regular-svg-icons";
import { useEditorStore } from "../store";
import { TEMPLATES, buildTemplatePage, type TemplateCategory } from "../presets";
import { PagePreview } from "../PagePreview";
import { BRAND } from "../brand";

const CATEGORIES: (TemplateCategory | "Blank")[] = [
  "Cover", "Financials", "Property", "Location", "Comparables", "Team", "Blank",
];

export function TemplateGallery({
  open,
  onOpenChange,
  atIndex,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  atIndex?: number;
}) {
  const addPage = useEditorStore((s) => s.addPage);
  const activeListing = useEditorStore((s) => s.activeListing);
  const [active, setActive] = useState<(TemplateCategory | "Blank")>("Cover");

  const templatesInCategory = useMemo(
    () => TEMPLATES.filter((t) => t.category === active),
    [active],
  );

  const pick = (kind: string) => {
    addPage(kind, atIndex);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="xl" scrollable centered>
        <Modal.Header>
          <Modal.Title>
            <FontAwesomeIcon icon={faSwatchbook} className="me-2" />
            Add a page
          </Modal.Title>
          <Modal.Description>
            Start from a designer template — or an on-brand blank page you control.
          </Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex gap-4">
            {/* Category rail */}
            <div className="d-flex flex-column gap-1" style={{ width: 160, flexShrink: 0 }}>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  variant={active === c ? "primary" : "ghost"}
                  size="sm"
                  className="text-start"
                  aria-pressed={active === c}
                  onClick={() => setActive(c)}
                >
                  {c}
                </Button>
              ))}
            </div>

            {/* Template grid */}
            <div className="d-flex flex-wrap gap-3 flex-grow-1">
              {active === "Blank" ? (
                <>
                  <BlankCard
                    icon={faFileLines}
                    title="Blank page"
                    desc="A truly empty page — full manual control."
                    onClick={() => pick("blank")}
                  />
                  <BlankCard
                    icon={faSwatchbook}
                    title="On-brand blank"
                    desc="Freeform, but your brand fonts, colors, and logo are pre-applied."
                    onClick={() => pick("onBrandBlank")}
                  />
                </>
              ) : (
                templatesInCategory.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className="d-flex flex-column gap-2 p-2 border rounded bg-transparent text-start"
                    style={{ width: 200, cursor: "pointer" }}
                    aria-label={`Add ${t.name} page`}
                    onClick={() => pick(t.key)}
                  >
                    <PagePreview page={buildTemplatePage(t.key, activeListing)} width={184} />
                    <span className="fw-semibold" style={{ fontSize: 14 }}>{t.name}</span>
                    <span className="fs-small" style={{ color: BRAND.palette.neutral }}>{t.description}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
}

function BlankCard({
  icon, title, desc, onClick,
}: { icon: typeof faFileLines; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="d-flex flex-column gap-2 p-3 border rounded bg-transparent text-start justify-content-center align-items-center"
      style={{ width: 200, height: 160, cursor: "pointer" }}
      aria-label={`Add ${title}`}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 28, color: BRAND.palette.primary }} />
      <span className="fw-semibold" style={{ fontSize: 14 }}>{title}</span>
      <span className="fs-small text-center" style={{ color: BRAND.palette.neutral }}>{desc}</span>
    </button>
  );
}
