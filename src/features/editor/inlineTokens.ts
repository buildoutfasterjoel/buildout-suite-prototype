import {
  DYNAMIC_FIELD_LABELS,
  INLINE_FIELD_FORMAT,
  isEmptyValue,
  resolveField,
  resolveFieldValue,
  type DocumentData,
} from "./dynamic";
import type { DynamicKey } from "./types";

/**
 * Inline dynamic fields — the liquid tokens a text block can carry mid-sentence.
 *
 * Two representations, one source of truth:
 *
 * - **Stored:** the block's `text` keeps the token literally —
 *   `A building in {{property.city}} with <b>24,000 SF</b>`. Nothing about a
 *   resolved value is ever persisted, so re-pointing a document at another
 *   listing re-resolves everything (the same "derive, don't store" rule the
 *   `contents` and `map` blocks follow).
 * - **Displayed:** the canvas shows a chip — an atomic `contenteditable=false`
 *   span carrying `data-token-key` and the live value as its text — so the
 *   token reads as one thing to both the eye and the caret.
 *
 * `hydrateTokens` goes stored → displayed, `serializeTokens` comes back. The
 * round trip is what lets a contentEditable whose DOM holds resolved values
 * persist tokens instead.
 */

/** Marker attribute every chip carries; also how the serializer finds them. */
export const TOKEN_ATTR = "data-token-key";

/** Matches one `{{ path }}`, tolerating liquid's optional inner whitespace. */
const TOKEN_RE = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

const PROPERTY_PREFIX = "property.";
const MARKETING_PREFIX = "marketing.";

/**
 * The token path for a key. `DynamicKey` already namespaces marketing copy, so
 * only property facts need a prefix added — `city` → `property.city`, while
 * `marketing.saleTitle` is already its own path.
 */
export function tokenPath(key: DynamicKey): string {
  return key.startsWith(MARKETING_PREFIX) ? key : `${PROPERTY_PREFIX}${key}`;
}

/** The full token as it is stored. */
export function tokenSyntax(key: DynamicKey): string {
  return `{{${tokenPath(key)}}}`;
}

/**
 * A token path back to a `DynamicKey`. Unknown field names inside a known
 * namespace are accepted rather than rejected — `resolveFieldValue` already
 * returns `undefined` for them, which renders as an unset chip the user can
 * see and delete. An unnamespaced path (`{{city}}`) is not a token: bare braces
 * are more likely prose than a binding.
 */
export function keyFromTokenPath(path: string): DynamicKey | null {
  if (path.startsWith(MARKETING_PREFIX)) {
    return path.length > MARKETING_PREFIX.length ? (path as DynamicKey) : null;
  }
  if (path.startsWith(PROPERTY_PREFIX)) {
    const field = path.slice(PROPERTY_PREFIX.length);
    return field ? (field as DynamicKey) : null;
  }
  return null;
}

/** Whether a stored string carries at least one inline token. */
export function hasTokens(stored: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(stored);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The label shown when a token resolves to nothing. */
export function fieldLabel(key: DynamicKey): string {
  return DYNAMIC_FIELD_LABELS[key] ?? key;
}

/**
 * A chip's display text. An empty value shows the field's name rather than
 * `resolveField`'s em dash: "a building in — with 24,000 SF" reads like a typo
 * mid-sentence, where "a building in City" reads like a field awaiting data.
 */
export function tokenDisplayText(key: DynamicKey, data: DocumentData): string {
  if (isEmptyValue(resolveFieldValue(key, data))) return fieldLabel(key);
  return resolveField(key, INLINE_FIELD_FORMAT[key], data);
}

/**
 * One chip's markup. `contenteditable=false` is what makes it atomic — the
 * caret steps over it instead of into it, and typing can't split it.
 */
export function tokenChipHtml(
  key: DynamicKey,
  data: DocumentData,
  extraAttrs = "",
): string {
  const unset = isEmptyValue(resolveFieldValue(key, data));
  return (
    `<span class="bo-editor-token"` +
    ` ${TOKEN_ATTR}="${escapeHtml(tokenPath(key))}"` +
    (unset ? ` data-token-unset="true"` : "") +
    (extraAttrs ? ` ${extraAttrs}` : "") +
    ` contenteditable="false"` +
    `>${escapeHtml(tokenDisplayText(key, data))}</span>`
  );
}

/**
 * Stored HTML → display HTML. Deliberately a string rewrite rather than a DOM
 * walk: it runs unchanged on the server and in a plain-node test, and our
 * stored HTML never carries braces inside an attribute for the pattern to
 * mistake for a token.
 */
export function hydrateTokens(stored: string, data: DocumentData): string {
  return stored.replace(TOKEN_RE, (match, path: string) => {
    const key = keyFromTokenPath(path);
    return key ? tokenChipHtml(key, data) : match;
  });
}

/**
 * Display DOM → stored HTML. Works on a clone so the live DOM (and the caret
 * inside it) is untouched, and swaps chips via `querySelectorAll` so a chip
 * nested inside formatting the user applied across it — `<b><span
 * data-token-key>…</span></b>`, or a `<b>` the browser dropped *inside* the
 * chip — is found at any depth. Reading `innerHTML` off the clone then hands
 * tag and entity escaping back to the browser.
 */
export function serializeTokens(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>(`[${TOKEN_ATTR}]`).forEach((chip) => {
    const path = chip.getAttribute(TOKEN_ATTR) ?? "";
    const key = keyFromTokenPath(path);
    chip.replaceWith(
      chip.ownerDocument.createTextNode(key ? tokenSyntax(key) : ""),
    );
  });
  return clone.innerHTML;
}

/** Whether a node is a token chip. */
export function isTokenChip(node: Node | null | undefined): node is HTMLElement {
  return (
    node != null &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute(TOKEN_ATTR)
  );
}

/**
 * Pasted markup, normalized. Round-tripping through the store form re-resolves
 * every chip against *this* document's data, so a chip copied from a document
 * bound to another listing doesn't paste in showing that listing's value.
 */
export function normalizePastedHtml(html: string, data: DocumentData): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  return hydrateTokens(serializeTokens(host), data);
}

/**
 * A short plain-text preview of stored HTML — for the layers list, breadcrumb,
 * and drag preview, which want a name rather than markup. Tokens become their
 * field label, so a heading that is entirely one token still reads as
 * "Deal Name" instead of `{{property.name}}`.
 */
export function plainTextPreview(stored: string): string {
  return stored
    .replace(TOKEN_RE, (match, path: string) => {
      const key = keyFromTokenPath(path);
      return key ? fieldLabel(key) : match;
    })
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
