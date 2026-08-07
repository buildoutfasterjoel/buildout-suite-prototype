# A faster iteration loop: triage, artifact lifecycle, and one-word ship

**Date:** 2026-08-07
**Branch:** `joel/cleanup`
**Status:** approved design, not yet implemented
**Scope:** How we work in this repo. No product code changes.

## Problem

The middle of the loop — actually building — is not the bottleneck. Both ends are.

**The front end applies full ceremony to changes that don't earn it.** Brainstorm → spec →
plan is right for a feature and crushing for a tweak. There is no stated rule for which lane a
change takes, so everything defaults to the heavy one.

**The artifacts then accumulate and turn into authority.** `docs/superpowers/` holds 10 specs
and 8 plans, about 388,000 tokens — over a third of a 1M context window, most of it describing
decisions since reversed. Worse than the bulk is the misdirection: supersession is recorded
only on the *new* document. `2026-08-06-space-deal-pages-design.md` says it supersedes
`2026-08-04-space-deals-without-a-page-design.md`, but the 08-04 file still reads
`Status: Approved design (2026-08-04), pending spec review` with no hint it was overturned. A
session that finds the older file first reads a live approved design that is two days dead, and
Joel ends up defending a change against a document that should not exist. Statuses also never
advance after shipping: 08-06 shipped in #128 and #130 and still reads "pending spec review".

**The back end costs Joel mechanical work.** After approving a commit he still pushes the
branch and opens the PR by hand.

## What changes

### 1. Artifact lifecycle: specs are in-flight only

A spec is a working document. It exists while the work is in flight and is **deleted when the
work ships**, together with its plan, in a `chore(docs):` commit that goes out with the branch.

No replacement record file is created. The record is the commit body and the PR description,
which already do this job — PR bodies on this repo run 2,365–8,565 characters with real
structure, and commit bodies carry multi-paragraph reasoning. A third copy would be the bloat
this design exists to remove.

Anything load-bearing that is *not* already in those places gets written into the PR body
before the delete. In practice that means rejected approaches — "we built the suite panel over
the building on 08-03 and reverted it in `b1a04e3` because the panel could not carry deal stage
without duplicating the deal header." Those few lines are the only part of a superseded spec
worth keeping, and they belong somewhere permanent rather than inside a corpse.

Deletion is not information loss. Git preserves the full text, and
`git show <commit>^:docs/superpowers/specs/<file>.md` recovers any of it. Deletion moves the
content from the working tree, where it costs context and misleads, into history, where it
costs nothing. This is already the established practice here — `ea4b411`, `f6b7556`, and
`65d229c` all delete executed plans and superseded specs. This design makes it systematic
rather than occasional.

**The resulting invariant: if a spec is in `docs/superpowers/specs/`, the work is live.**
That single property is what stops dead designs being cited as current constraints.

Why commit bodies are safe to keep long: they live in `.git`, never in the working tree.
Nothing globs or greps them, so they never enter a context window unless someone explicitly
runs `git log`. Spec files are discoverable by accident; commit bodies are not. That asymmetry
is the whole argument.

Why the record lives in git rather than a `DECISIONS.md`: zero repo-context cost, permanent
binding to the actual diff (a file can drift from the code it describes; a commit body cannot),
and no duplicate authoring. The one weakness is discovery — a file is found by ordinary
exploration, a commit body only if you know to look — which is addressed by a pointer in
CLAUDE.md rather than by a new file.

### 2. Triage: when a change earns a spec

The fast lane is the default. A change goes to spec only if it trips one of four wires:

1. **It touches the data model or seed fixtures** — a new entity, a changed shape, anything
   that moves `SEED_VERSION`. Cross-cutting and expensive to unwind.
2. **It adds or moves a route.** Moving a TanStack route silently breaks hardcoded
   `useParams({ from })` and full-reload `<a href>` navigation, and `vite build` does not catch
   either.
3. **It introduces new vocabulary** — a stage, status, or concept other surfaces must agree
   with. The suite-status bug fixed in `e7411fa` was exactly this: two vocabularies for one
   idea.
4. **The shape is genuinely unsettled** — if the approach cannot be stated in a sentence, the
   dialogue earns its cost.

Everything else goes straight to work: bug fixes, copy, styling, single-component changes,
anything with an obvious correct answer. The approach is stated in a sentence or two, then
built.

Two overrides, either direction. Joel can say "just do it" on a change that tripped a wire, or
"spec this first" on one that did not. Both win over the tripwires.

If a fast-lane change turns out mid-flight to be larger than it looked, work stops and Joel is
told — rather than a 600-line spec appearing unrequested.

### 3. `/ship`: one approval, then the mechanics

Joel reviews the commit and says "good to go" — or runs `/ship`. The command then:

1. Confirms the working tree is clean and `HEAD` is not on `main`.
2. Runs the real gates: `bunx tsc --noEmit` and `bun --bun run test`. Not `vite build`, which
   does not type-check.
3. Pushes the branch.
4. Opens the PR via `gh pr create`, with a body assembled from the branch's commit messages.
5. Returns the PR URL.

**`/ship` does not delete anything.** Deleting the spec and plan happens earlier, in the
`chore(docs):` commit that Joel reviews before saying "good to go" — so the deletion is visible
at the moment of approval rather than executed unseen afterwards. This keeps the final say
where Joel asked for it while still removing the mechanical work, and it means `/ship` only
ever pushes and opens.

**It never merges.** Merging stays Joel's, on GitHub.

If a gate fails, the command stops and shows the output rather than shipping anyway.

`/ship` lives at `.claude/commands/ship.md`. This is the repo's first custom command;
`.claude/commands/` does not exist yet.

## Backfill — separate work, not part of this

The 10 specs and 8 plans currently in `docs/superpowers/` are almost all shipped or superseded,
and clearing them is the whole point of the lifecycle rule. **It is deliberately not part of
this implementation.** Deleting 18 files requires reading each one for anything load-bearing
that is not already in a commit or PR body, and that judgment deserves its own reviewable pass
rather than riding along with the rules that motivate it.

It happens after this ships, as its own branch and PR, so individual deletions can be vetoed.
Anything that turns out to be a durable repo-wide constraint — as opposed to a record of one
change — moves into CLAUDE.md instead of being deleted.

`AI-VOICE-PRD.md`, `AI-VOICE-REQUIREMENTS.md`, `AI-VOICE-STATUS.md`, and
`property-listing-form-prd-reference.md` are reference documents, not specs for shipped work,
and AI-VOICE Phase 4 is still unbuilt. **All four are kept and are out of scope for this
backfill.** They describe work that has not shipped, so the lifecycle rule — delete at ship —
has not been reached. Revisit them when Phase 4 ships, not now.

## CLAUDE.md additions

Three short blocks:

- **Where design rationale lives** — commit bodies and PR descriptions, with the retrieval
  commands (`gh pr list --search "<term>"`, `gh pr view <n>`, `git log --grep`). This is what
  buys back the discoverability given up by not having a record file.
- **The triage rule** — the four tripwires and the two overrides, stated compactly.
- **Spec lifecycle** — specs are in-flight only; a spec in `specs/` means live work; specs and
  plans are deleted at ship time.

## Testing

No product code changes, so no Vitest additions. Verification is behavioural:

- Triage: the next small change goes straight to work with no spec written.
- Lifecycle: after the backfill, `docs/superpowers/specs/` contains only in-flight work.
- `/ship`: run once end-to-end on a real branch. It must stop on a deliberately failing
  `tsc --noEmit`, and must not merge.

## Out of scope

Hooks and any enforcement machinery. Every rule here is a judgment call — whether a change
trips a wire, whether a lesson is worth harvesting — and hooks cannot make judgment calls. They
would add brittleness and false confidence without adding correctness.

The `GITHUB_TOKEN` reference still in `.claude/skills/blueprint/SKILL.md`, deliberately left as
generic consuming-app guidance in `fdd4437`.

---

Per its own rules, this spec is deleted when this work ships.
