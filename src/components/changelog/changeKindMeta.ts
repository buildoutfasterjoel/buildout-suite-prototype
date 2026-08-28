import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBug,
  faPaintbrush,
  faSparkles,
} from "@fortawesome/pro-regular-svg-icons";
import type { ChangeKind } from "./changelogEntries";

/**
 * How each change kind presents itself on the page.
 *
 * Split out of `changelogEntries.ts` so that module stays dependency-free.
 * These are the only FontAwesome imports the changelog needs, and FontAwesome
 * Pro lives behind a private registry — so with them here, `scripts/`
 * and CI can read the log with nothing installed but the repo itself.
 * Icons are a presentation concern anyway; they belong beside the badge that
 * draws them, not beside the data.
 */
export const CHANGE_KIND_META: Record<
  ChangeKind,
  { label: string; short: string; icon: IconDefinition; className: string }
> = {
  feature: {
    label: "New features",
    short: "New",
    icon: faSparkles,
    className: "changelog-kind--feature",
  },
  refinement: {
    label: "Refinements",
    short: "Refined",
    icon: faPaintbrush,
    className: "changelog-kind--refinement",
  },
  fix: {
    label: "Bug fixes",
    short: "Fixed",
    icon: faBug,
    className: "changelog-kind--fix",
  },
};
