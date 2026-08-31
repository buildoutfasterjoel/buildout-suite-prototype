import { cloneElement, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Marks a span this file produced, so a nested block can't wrap it a second
 * time and fade a word inside an already-fading word.
 */
const WORD_MARKER = "data-otto-word";

/**
 * Wrap each word in its own span so it can fade in on its own.
 *
 * The fade rides on React's mounting, not on a timer: keys are the word's
 * position inside its block, so as a reply grows the words already on screen
 * keep their keys and stay mounted, and only the newly appended ones mount and
 * animate. Nothing has to track which words are "new".
 *
 * Keys only need to be unique among their siblings, so each block starts its
 * own counter — that is why `seq` is passed in rather than shared globally.
 */
function wrapWords(node: ReactNode, seq: { n: number }): ReactNode {
  if (typeof node === "string") {
    // Keep the separators: splitting on the whitespace itself would collapse
    // the spaces between words.
    return node.split(/(\s+)/).map((token) => {
      if (!token) return null;
      if (/^\s+$/.test(token)) return token;
      return (
        <span key={`w${seq.n++}`} className="otto-word" {...{ [WORD_MARKER]: true }}>
          {token}
        </span>
      );
    });
  }

  if (Array.isArray(node)) return node.map((child) => wrapWords(child, seq));

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode; [key: string]: unknown };
    if (props[WORD_MARKER]) return node;
    // Code keeps its exact whitespace, and a fade per token inside a code block
    // reads as noise rather than as typing.
    if (node.type === "code" || node.type === "pre") return node;
    if (props.children === undefined) return node;
    return cloneElement(node, undefined, wrapWords(props.children, seq));
  }

  return node;
}

/**
 * Block-level overrides. Only containers of prose need one: react-markdown has
 * already turned inline `**bold**` into a real `<strong>` element by the time
 * these run, and `wrapWords` recurses through it.
 */
const REVEAL_COMPONENTS: Components = {
  p: ({ children, ...rest }) => <p {...rest}>{wrapWords(children, { n: 0 })}</p>,
  li: ({ children, ...rest }) => <li {...rest}>{wrapWords(children, { n: 0 })}</li>,
  h1: ({ children, ...rest }) => <h1 {...rest}>{wrapWords(children, { n: 0 })}</h1>,
  h2: ({ children, ...rest }) => <h2 {...rest}>{wrapWords(children, { n: 0 })}</h2>,
  h3: ({ children, ...rest }) => <h3 {...rest}>{wrapWords(children, { n: 0 })}</h3>,
  h4: ({ children, ...rest }) => <h4 {...rest}>{wrapWords(children, { n: 0 })}</h4>,
  td: ({ children, ...rest }) => <td {...rest}>{wrapWords(children, { n: 0 })}</td>,
  th: ({ children, ...rest }) => <th {...rest}>{wrapWords(children, { n: 0 })}</th>,
  blockquote: ({ children, ...rest }) => <blockquote {...rest}>{wrapWords(children, { n: 0 })}</blockquote>,
};

/**
 * An assistant turn's prose, in both the shell rail and the editor's Otto panel.
 *
 * Replies stream as GitHub-flavored markdown. react-markdown is safe by default
 * — it does not render raw HTML and it sanitizes URLs — so model output can't
 * inject scripts. Spacing is tuned via the global `.assistant-markdown` styles
 * in main.scss.
 *
 * `revealing` turns on the per-word fade used while a reply is arriving (see
 * `revealText.ts`). It is off for every message already on screen, so the
 * transcript costs no extra spans for history. `revealDone` then freezes the
 * animation, so if the turn is ever remounted it does not fade in all over
 * again.
 */
export function MarkdownMessage({
  content,
  revealing = false,
  revealDone = false,
}: {
  content: string;
  revealing?: boolean;
  revealDone?: boolean;
}) {
  return (
    <div className={`assistant-markdown${revealDone ? " assistant-markdown--revealed" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={revealing ? REVEAL_COMPONENTS : undefined}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
