import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";

/**
 * The inline reply composer that expands beneath a row (never a modal). It
 * quotes the thread subject and, on send, posts back to the same thread via the
 * parent's dispatch. Cancel collapses it with no side-effect.
 */
export function ReplyComposer({
  subject,
  onSend,
  onCancel,
}: {
  subject?: string;
  onSend: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;
  return (
    <div className="tl-reply">
      {subject && (
        <div className="tl-reply__quote">
          Replying to <span className="fw-semibold">{subject}</span>
        </div>
      )}
      <Textarea
        autoFocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply…"
      />
      <div className="tl-reply__actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!canSend}
          onClick={() => canSend && onSend(text.trim())}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
