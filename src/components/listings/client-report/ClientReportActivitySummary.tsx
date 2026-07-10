import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles, faSpinner } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import {
  buildActivitySummaryText,
  type ClientReportKpis,
} from "#/data/listingClientReport";
import { Section } from "../listingWidgets";

/** Written activity summary with a mock "AI" generate action — no real API call. */
export function ClientReportActivitySummary({
  listing,
  kpis,
}: {
  listing: Listing;
  kpis: ClientReportKpis;
}) {
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  function handleGenerate() {
    setIsGenerating(true);
    setTimeout(() => {
      setSummary(buildActivitySummaryText(listing.name, kpis));
      setIsGenerating(false);
    }, 900);
  }

  return (
    <Section
      title="Activity Summary"
      action={
        <Button
          variant="ghost"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <FontAwesomeIcon
            icon={isGenerating ? faSpinner : faSparkles}
            spin={isGenerating}
          />
          {isGenerating ? "Generating…" : "Generate Activity Summary"}
        </Button>
      }
    >
      <Textarea
        rows={5}
        placeholder="Write a summary of this listing's marketing activity, or generate one automatically."
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
    </Section>
  );
}
