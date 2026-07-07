import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold,
  faItalic,
  faUnderline,
  faStrikethrough,
  faMinus,
  faPlus,
} from "@fortawesome/pro-regular-svg-icons";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import {
  ToggleButtonGroup,
  type ToggleItem,
} from "./controls/ToggleButtonGroup";
import { useSelectedEntities } from "./store";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";

/** execCommand names for the B/I/U/S toggle buttons. */
type FontStyleValue = "bold" | "italic" | "underline" | "strikeThrough";

const FONT_STYLE_ITEMS: ToggleItem<FontStyleValue>[] = [
  { value: "bold", icon: faBold, label: "Bold" },
  { value: "italic", icon: faItalic, label: "Italic" },
  { value: "underline", icon: faUnderline, label: "Underline" },
  { value: "strikeThrough", icon: faStrikethrough, label: "Strikethrough" },
];

/** Font options — the document's brand fonts plus a few web-safe generics. */
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Proxima Nova", value: "Proxima Nova" },
  { label: "PT Serif", value: "PT Serif" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
];

const FONT_SIZE_MIN = 6;
const FONT_SIZE_MAX = 144;
const DEFAULT_FONT_SIZE = 16;

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  fontName: string;
  fontSize: number;
}

const EMPTY_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  fontName: "",
  fontSize: DEFAULT_FONT_SIZE,
};

/** Element hosting a DOM node (the node itself, or its parent for text nodes). */
function hostElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return node.nodeType === Node.TEXT_NODE
    ? node.parentElement
    : (node as HTMLElement);
}

/** Strip quotes/whitespace and match a queryCommandValue font against our options. */
function normalizeFont(raw: string): string {
  const cleaned = raw.replace(/["']/g, "").split(",")[0]?.trim() ?? "";
  const match = FONT_OPTIONS.find(
    (o) => o.value.toLowerCase() === cleaned.toLowerCase(),
  );
  return match?.value ?? "";
}

/** Computed font-size (px) of the current selection's anchor, falling back to the editable. */
function currentFontSizePx(editable: HTMLElement): number {
  const sel = window.getSelection();
  let el = hostElement(sel?.anchorNode ?? null);
  if (!el || !editable.contains(el)) el = editable;
  const px = parseFloat(window.getComputedStyle(el).fontSize);
  return Number.isFinite(px) ? Math.round(px) : DEFAULT_FONT_SIZE;
}

/**
 * Floating rich-text toolbar. Appears when a text node (heading/text block or a
 * static table cell) is selected, sliding down from the top and floating over
 * the canvas. Formatting is applied to the live browser selection via
 * execCommand: a highlighted range is formatted in place, while a collapsed
 * caret formats the whole node (we select-all first). Persistence flows through
 * the contentEditable's own `input` handler (see InlineText).
 */
export function RichTextToolbar() {
  const { block, cell } = useSelectedEntities();

  // Text nodes: heading/text blocks, or a static (non-dynamic) table cell.
  const isTextNode =
    block?.type === "heading" ||
    block?.type === "text" ||
    (block?.type === "table" && cell != null && cell.dynamicKey == null);
  const open = Boolean(isTextNode);

  const [format, setFormat] = useState<FormatState>(EMPTY_FORMAT);
  const [sizeInput, setSizeInput] = useState(String(DEFAULT_FONT_SIZE));
  // Stays mounted through the slide-out animation after `open` flips false.
  const [mounted, setMounted] = useState(false);

  // Last contentEditable the user focused, and the last selection range inside
  // one — used to reapply formatting when focus moved to a toolbar field.
  const lastEditableRef = useRef<HTMLElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const sizeInputRef = useRef<HTMLInputElement | null>(null);

  const blockId = block?.id;

  const getActiveEditable = useCallback((): HTMLElement | null => {
    if (typeof document === "undefined") return null;
    const active = document.activeElement as HTMLElement | null;
    if (active?.isContentEditable) return active;

    const fromSelection = hostElement(
      window.getSelection()?.anchorNode ?? null,
    )?.closest<HTMLElement>('[contenteditable="true"]');
    if (fromSelection) return fromSelection;

    if (blockId) {
      const inBlock = document.querySelector<HTMLElement>(
        `[data-block-id="${blockId}"] [contenteditable="true"]`,
      );
      if (inBlock) return inBlock;
    }
    return lastEditableRef.current;
  }, [blockId]);

  const refreshFormat = useCallback(() => {
    // Don't clobber the size field while the user is typing into it.
    if (sizeInputRef.current && document.activeElement === sizeInputRef.current)
      return;
    const el = getActiveEditable();
    if (!el) return;
    const next: FormatState = {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      fontName: normalizeFont(document.queryCommandValue("fontName")),
      fontSize: currentFontSizePx(el),
    };
    setFormat(next);
    setSizeInput(String(next.fontSize));
  }, [getActiveEditable]);

  // Track the most recently focused editable across the canvas.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable) lastEditableRef.current = t;
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  // Mount as soon as we should open; the slide-out on close unmounts us later
  // (see onAnimationEnd below).
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // While open, keep field states synced and remember the caret/selection so a
  // highlighted range survives clicking into the font/size fields.
  useEffect(() => {
    if (!open) return;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (
          hostElement(range.commonAncestorContainer)?.closest(
            '[contenteditable="true"]',
          )
        ) {
          savedRangeRef.current = range.cloneRange();
        }
      }
      refreshFormat();
    };
    onSelectionChange();
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [open, blockId, refreshFormat]);

  /** Ensure a usable selection inside `el`, then run the command against it. */
  const runCommand = useCallback(
    (cmd: string, arg?: string) => {
      const el = getActiveEditable();
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;

      const liveInside =
        sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode);
      if (!liveInside) {
        // Restore a highlighted range that was lost to a toolbar field...
        const saved = savedRangeRef.current;
        if (
          saved &&
          !saved.collapsed &&
          el.contains(saved.commonAncestorContainer)
        ) {
          sel.removeAllRanges();
          sel.addRange(saved);
        } else {
          // ...otherwise there's no highlight: format the whole node.
          const range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      // Emit native tags (b/i/u/strike, font) rather than CSS spans so the
      // fontSize rewrite below can find its sentinel <font size="7"> nodes.
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand(cmd, false, arg);

      if (cmd === "fontSize") {
        // execCommand fontSize only accepts 1–7; rewrite the sentinel size-7 tags
        // to real px spans so arbitrary sizes work.
        el.querySelectorAll('font[size="7"]').forEach((font) => {
          const span = document.createElement("span");
          span.style.fontSize = `${arg}px`;
          while (font.firstChild) span.appendChild(font.firstChild);
          font.replaceWith(span);
        });
      }

      // Persist through InlineText's onInput. (execCommand dispatches input, but
      // we dispatch again so persistence never depends on that firing.)
      el.dispatchEvent(new Event("input", { bubbles: true }));
      refreshFormat();
    },
    [getActiveEditable, refreshFormat],
  );

  const applyFontSize = useCallback(
    (px: number) => {
      const clamped = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, px));
      runCommand("fontSize", String(clamped));
      setSizeInput(String(clamped));
    },
    [runCommand],
  );

  const activeStyles = [
    format.bold ? ("bold" as const) : null,
    format.italic ? ("italic" as const) : null,
    format.underline ? ("underline" as const) : null,
    format.strikeThrough ? ("strikeThrough" as const) : null,
  ].filter((v): v is FontStyleValue => v !== null);

  // Stay mounted until the slide-out finishes, then unmount.
  if (!mounted) return null;

  return (
    <div className="bo-editor-rt-anchor">
      <div
        className="bo-editor-rt-popover"
        data-state={open ? "open" : "closed"}
        onAnimationEnd={(e) => {
          // Only the container's own slide-out (not a nested control's
          // animation) unmounts the toolbar.
          if (e.target === e.currentTarget && !open) setMounted(false);
        }}
      >
        <div
          className="bo-editor-rt-toolbar d-flex align-items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* preventDefault on mousedown keeps the editable's live selection so
              B/I/U/S format a highlighted range in place. */}
          <span
            className="d-inline-flex"
            onMouseDown={(e) => e.preventDefault()}
          >
            <ToggleButtonGroup
              items={FONT_STYLE_ITEMS}
              active={activeStyles}
              multi
              tooltips
              onToggle={(value) => runCommand(value)}
            />
          </span>

          <Separator
            orientation="vertical"
            className="align-self-stretch h-auto"
          />

          <Select
            value={format.fontName || null}
            onValueChange={(value) =>
              value && runCommand("fontName", String(value))
            }
          >
            <Select.Trigger className="w-auto" style={{ minWidth: 130 }}>
              <Select.Value placeholder="Font" />
            </Select.Trigger>
            <Select.Content>
              {FONT_OPTIONS.map((f) => (
                <Select.Item key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <Separator
            orientation="vertical"
            className="align-self-stretch h-auto"
          />

          <InputGroup className="w-auto">
            <InputGroup.Addon>
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Decrease Font Size"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFontSize(format.fontSize - 1)}
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </Button>
                  }
                />
                <Tooltip.Content side="top">Decrease font size</Tooltip.Content>
              </Tooltip>
            </InputGroup.Addon>
            <Input
              ref={sizeInputRef}
              type="number"
              aria-label="Font size"
              value={sizeInput}
              className="flex-grow-0 flex-shrink-0 text-center"
              style={{ width: 54 }}
              onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const n = parseInt(sizeInput, 10);
                  if (Number.isFinite(n)) applyFontSize(n);
                }
              }}
              onBlur={() => {
                const n = parseInt(sizeInput, 10);
                if (Number.isFinite(n)) applyFontSize(n);
                else setSizeInput(String(format.fontSize));
              }}
            />
            <InputGroup.Addon>
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Increase Font Size"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFontSize(format.fontSize + 1)}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </Button>
                  }
                />
                <Tooltip.Content side="top">Increase font size</Tooltip.Content>
              </Tooltip>
            </InputGroup.Addon>
          </InputGroup>
        </div>
      </div>
    </div>
  );
}
