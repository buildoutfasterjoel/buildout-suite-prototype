import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldTextRequest } from "#/ai/fieldText";
import { aiFieldText } from "#/ai/fieldTextRelay";

export interface FieldTextResult {
  /** Everything that arrived, including a partial answer after Stop. */
  text: string;
  /** True when the broker pressed Stop; the partial text is kept, not discarded. */
  stopped: boolean;
  /** Set when the run failed for a reason other than Stop. */
  error?: string;
}

/**
 * One streaming field-text run at a time, keyed by the caller — the composer
 * keys on the tab, so the Note tab can be generating while the broker peeks at
 * the Call tab and finds its bar at rest.
 *
 * Starting a second run aborts the first: two answers racing into one field
 * would interleave their deltas.
 */
export function useFieldText() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page mid-run: don't keep streaming into a field that's gone.
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async (
      key: string,
      req: FieldTextRequest,
      handlers: { onText: (text: string) => void; onDone: (result: FieldTextResult) => void },
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setActiveKey(key);

      let text = "";
      let error: string | undefined;
      try {
        const res = await aiFieldText({ data: req, signal: ac.signal });
        if (!res.ok || !res.body) throw new Error(`Generation failed (${res.status}).`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          handlers.onText(text);
        }
      } catch (e) {
        // An abort is the broker's Stop, not a failure.
        if (!ac.signal.aborted) error = e instanceof Error ? e.message : String(e);
      } finally {
        if (abortRef.current === ac) {
          abortRef.current = null;
          setActiveKey(null);
        }
        handlers.onDone({ text, stopped: ac.signal.aborted, error });
      }
    },
    [],
  );

  return { activeKey, start, stop };
}
