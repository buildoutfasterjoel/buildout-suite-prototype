import { createServerFn } from "@tanstack/react-start";
import { runGenerator } from "./runGenerator";
import { FilterSpec, type FilterSpecT } from "./schemas";
import { FILTER_PROMPT } from "./prompts";
import { filterFallback } from "./fallbacks";

/** §3.1 — plain-English listings query → structured `FilterSpec`, applied to
 * the Listings grid by `filter_listings` (see `src/ai/tools.ts`). */
export const generateFilter = createServerFn({ method: "POST" })
  .validator((d: { query: string }) => d)
  .handler(({ data }): Promise<FilterSpecT> =>
    runGenerator({
      system: FILTER_PROMPT,
      user: data.query,
      schema: FilterSpec,
      fallback: () => filterFallback(data.query),
    }),
  );
