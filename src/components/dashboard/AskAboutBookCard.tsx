import { useState } from "react";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles, faSpinner } from "@fortawesome/pro-regular-svg-icons";
import { generateStrategy } from "#/ai/generate";
import { composeBookSnapshot } from "#/ai/bookSnapshot";
import { renderLightHtml } from "#/ai/renderLightHtml";

/**
 * "Ask about my book" (§3.9) — the in-context counterpart to the
 * `analyze_book` agent tool, sharing the same `composeBookSnapshot` +
 * `generateStrategy` plumbing (`src/ai/tools.ts`). A free-text portfolio
 * question in, a grounded written answer out.
 */
export function AskAboutBookCard() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const result = await generateStrategy({ data: { book: composeBookSnapshot(), question: q } });
      setAnswer(result.answer);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Header className="d-flex align-items-center gap-2">
        <Card.Title className="fs-large d-inline-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faSparkles} />
          Ask about my book
        </Card.Title>
      </Card.Header>

      <CardBody className="d-flex flex-column gap-3">
        <form
          className="d-flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Who can I close in the next 90 days?"
            aria-label="Ask about your book"
          />
          <Button type="submit" variant="primary" disabled={loading || !question.trim()}>
            <FontAwesomeIcon icon={loading ? faSpinner : faSparkles} spin={loading} />
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </form>

        {answer && (
          <div
            className="border-top pt-3"
            dangerouslySetInnerHTML={{ __html: renderLightHtml(answer) }}
          />
        )}
      </CardBody>
    </Card>
  );
}
