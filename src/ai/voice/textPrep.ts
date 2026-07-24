/**
 * Prepare assistant/owner text for TTS: strip HTML, decode entities to real
 * characters (a naked `&#39;` reads as gibberish otherwise), collapse
 * whitespace, and cap length on a sentence boundary so the voice never trails
 * off mid-word. See voice-foundation design §5.
 */
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&rsquo;": "'", "&lsquo;": "'",
  "&rdquo;": '"', "&ldquo;": '"', "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–",
};

function decodeEntities(s: string): string {
  let out = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  for (const [name, ch] of Object.entries(NAMED_ENTITIES)) out = out.split(name).join(ch);
  return out;
}

export function prepForSpeech(raw: string, maxChars = 650): string {
  const stripped = raw.replace(/<[^>]*>/g, " ");
  const decoded = decodeEntities(stripped);
  const text = decoded.replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "),
  );
  if (lastBoundary > 0) return slice.slice(0, lastBoundary + 1).trim();
  return slice.trim();
}
