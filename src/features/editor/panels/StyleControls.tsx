import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import {
  faBold,
  faItalic,
  faUnderline,
  faAlignLeft,
  faAlignCenter,
  faAlignRight,
  faAlignJustify,
} from "@fortawesome/pro-regular-svg-icons";
import { EditorOption } from "../controls/EditorOption";
import { Slider } from "../controls/Slider";
import { SwatchGrid } from "../controls/SwatchGrid";
import { ToggleButtonGroup, type ToggleItem } from "../controls/ToggleButtonGroup";
import { FauxSelect } from "./FauxSelect";
import type { Block, Cell, ImageBlock, TextStyle } from "../types";
import { blockLabel } from "../blocks/blockMeta";
import { DYNAMIC_FIELD_LABELS } from "../dynamic";
import { useEditorStore } from "../store";
import { CRE_PHOTO_IDS, crePhotoUrl } from "#/components/properties/propertyDisplay";
import { BRAND } from "../brand";

const FONT_STYLE_ITEMS: ToggleItem<"bold" | "italic" | "underline">[] = [
  { value: "bold", icon: faBold, label: "Bold" },
  { value: "italic", icon: faItalic, label: "Italic" },
  { value: "underline", icon: faUnderline, label: "Underline" },
];

const ALIGN_ITEMS: ToggleItem<TextStyle["align"]>[] = [
  { value: "left", icon: faAlignLeft, label: "Align left" },
  { value: "center", icon: faAlignCenter, label: "Align center" },
  { value: "right", icon: faAlignRight, label: "Align right" },
  { value: "justify", icon: faAlignJustify, label: "Justify" },
];

const TRANSFORM_LABELS: Record<TextStyle["transform"], string> = {
  none: "None",
  uppercase: "UPPERCASE",
  lowercase: "lowercase",
  capitalize: "Capitalize",
};

/** Font / color / typography controls shared by text-bearing elements. */
function FontControls({ style }: { style: TextStyle }) {
  const fontStyleActive = [
    style.bold ? ("bold" as const) : null,
    style.italic ? ("italic" as const) : null,
    style.underline ? ("underline" as const) : null,
  ].filter((v): v is "bold" | "italic" | "underline" => v !== null);

  return (
    <div className="d-flex flex-column gap-2">
      <span className="bo-editor-subsection-title">Font</span>
      <div className="d-flex flex-column gap-2">
        <EditorOption label="Font">
          <FauxSelect value={style.fontFamily === BRAND.fonts.heading ? "PT Serif (Brand)" : "Proxima Nova (Brand)"} />
        </EditorOption>
        <EditorOption label="Font Size">
          <FauxSelect value={`${style.fontSize}px`} />
        </EditorOption>
        <EditorOption label="Font Style">
          <ToggleButtonGroup items={FONT_STYLE_ITEMS} active={fontStyleActive} multi />
        </EditorOption>
        <EditorOption label="Letter Spacing">
          <Slider value={style.letterSpacing} min={0} max={20} />
        </EditorOption>
        <EditorOption label="Line Height">
          <Slider value={style.lineHeight} min={0} max={48} />
        </EditorOption>
        <EditorOption label="Alignment">
          <ToggleButtonGroup items={ALIGN_ITEMS} active={[style.align]} />
        </EditorOption>
        <EditorOption label="Transform">
          <FauxSelect value={TRANSFORM_LABELS[style.transform]} />
        </EditorOption>
      </div>

      <span className="bo-editor-subsection-title mt-2">Color</span>
      <div className="d-flex flex-column gap-3">
        <EditorOption label="Text Color" orientation="vertical">
          <SwatchGrid value={style.color} />
        </EditorOption>
        <EditorOption label="Text Background" orientation="vertical">
          <SwatchGrid value={style.background} />
        </EditorOption>
      </div>
    </div>
  );
}

/** Properties for a selected table cell — Table Styles + Cell Styles (Figma). */
function CellStyleControls({ block, cell }: { block: Block; cell: Cell }) {
  const table = block.type === "table" ? block : null;

  return (
    <div className="d-flex flex-column gap-4">
      {table && (
        <>
          <div className="d-flex flex-column gap-3">
            <span className="bo-editor-section-title">Table Styles</span>
            <EditorOption label="Border Width">
              <Slider value={table.style.borderWidth} min={0} max={8} />
            </EditorOption>
            <EditorOption label="Border Style">
              <FauxSelect value={cap(table.style.borderStyle)} />
            </EditorOption>
            <EditorOption label="Border Color" orientation="vertical">
              <SwatchGrid value={table.style.borderColor} />
            </EditorOption>
          </div>
          <Separator />
        </>
      )}

      <div className="d-flex flex-column gap-3">
        <span className="bo-editor-section-title">Cell Styles</span>
        <FontControls style={cell.style} />

        <span className="bo-editor-subsection-title mt-2">Border Bottom</span>
        <div className="d-flex flex-column gap-3">
          <EditorOption label="Border Bottom Width">
            <Slider value={cell.style.borderBottomWidth} min={0} max={8} />
          </EditorOption>
          <EditorOption label="Border Bottom Style">
            <FauxSelect value={cap(cell.style.borderBottomStyle)} />
          </EditorOption>
          <EditorOption label="Border Bottom Color" orientation="vertical">
            <SwatchGrid value={cell.style.borderBottomColor} />
          </EditorOption>
        </div>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Image block controls — swap the image source without moving/removing it. */
function ImageStyleControls({ block }: { block: ImageBlock }) {
  const setImageSrc = useEditorStore((s) => s.setImageSrc);
  return (
    <div className="d-flex flex-column gap-3">
      <span className="bo-editor-section-title">Image</span>
      <p className="fs-small" style={{ color: "#506079" }}>
        Choose a replacement image.
      </p>
      <div className="d-flex flex-wrap" style={{ gap: 8 }}>
        {CRE_PHOTO_IDS.map((photoId) => {
          const selected = block.src.includes(photoId);
          return (
            <img
              key={photoId}
              src={crePhotoUrl(photoId, 120, 120)}
              alt=""
              onClick={() => setImageSrc(block.id, crePhotoUrl(photoId, 736, 300))}
              style={{
                width: 78,
                height: 78,
                objectFit: "cover",
                borderRadius: 6,
                border: `2px solid ${selected ? "#7422ce" : "#d5dae2"}`,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Contextual style controls for the current selection. A selected table cell
 * shows the full Table + Cell styles; heading/text blocks show font controls.
 */
export function StyleControls({ block, cell }: { block: Block; cell: Cell | null }) {
  if (cell) return <CellStyleControls block={block} cell={cell} />;

  if (block.type === "heading" || block.type === "text") {
    return (
      <div className="d-flex flex-column gap-3">
        <span className="bo-editor-section-title">
          {block.type === "heading" ? "Heading Styles" : "Text Styles"}
        </span>
        <FontControls style={block.style} />
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div className="d-flex flex-column gap-3">
        <span className="bo-editor-section-title">Table Styles</span>
        <EditorOption label="Border Width">
          <Slider value={block.style.borderWidth} min={0} max={8} />
        </EditorOption>
        <EditorOption label="Border Style">
          <FauxSelect value={cap(block.style.borderStyle)} />
        </EditorOption>
        <EditorOption label="Border Color" orientation="vertical">
          <SwatchGrid value={block.style.borderColor} />
        </EditorOption>
      </div>
    );
  }

  if (block.type === "image") {
    return <ImageStyleControls block={block} />;
  }

  if (block.type === "dynamic") {
    return (
      <div className="d-flex flex-column gap-3">
        <span className="bo-editor-section-title">Dynamic Field</span>
        <EditorOption label="Field">
          <FauxSelect value={DYNAMIC_FIELD_LABELS[block.dynamicKey] ?? "Deal Name"} />
        </EditorOption>
        <FontControls style={block.style} />
      </div>
    );
  }

  // Spacer / Divider / Columns / Section / Image — placement-only for now.
  return (
    <div className="d-flex flex-column gap-3">
      <span className="bo-editor-section-title">{blockLabel(block)}</span>
      <p className="fs-small" style={{ color: "#506079" }}>
        This block has no editable styles yet — drag blocks to arrange it on the page.
      </p>
    </div>
  );
}
