/**
 * XSS-safe allow-list sanitizer for the light HTML the strategy generator
 * (§3.9, `STRATEGY_PROMPT`) is constrained to emit: `<strong>`, `<em>`, and
 * `<br>` only.
 *
 * SAFE by construction: it first escapes every HTML special character
 * (`&`, `<`, `>`) in the raw model output, turning ANY markup — including a
 * stray `<script>`, an `<img onerror=…>`, or any other tag/attribute the
 * model might emit despite the prompt — into inert escaped text. Only THEN
 * does it re-enable a fixed set of bare, attribute-free tag strings via
 * exact substring replacement on the now-escaped text. Because the
 * re-enabled tags never carry attributes, there is no way for model output
 * to smuggle an event handler or a `javascript:` URL through this path.
 *
 * Never pass raw model output straight to `dangerouslySetInnerHTML` — always
 * route it through this function first.
 */
export function renderLightHtml(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/&lt;strong&gt;/gi, "<strong>")
    .replace(/&lt;\/strong&gt;/gi, "</strong>")
    .replace(/&lt;em&gt;/gi, "<em>")
    .replace(/&lt;\/em&gt;/gi, "</em>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}
