import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * An assistant turn's prose, in both the shell rail and the editor's Otto panel.
 *
 * Replies stream as GitHub-flavored markdown. react-markdown is safe by default
 * — it does not render raw HTML and it sanitizes URLs — so model output can't
 * inject scripts. Spacing is tuned via the global `.assistant-markdown` styles
 * in main.scss.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
