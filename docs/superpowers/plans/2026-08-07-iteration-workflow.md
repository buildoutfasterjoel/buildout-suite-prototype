# Iteration Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make small changes skip spec ceremony, stop dead specs being cited as current design, and reduce shipping to one approval.

**Architecture:** Three rule blocks added to `CLAUDE.md` (read at the start of every session, which is when triage and lookup decisions get made), plus one new slash command at `.claude/commands/ship.md` that runs the gates, pushes, and opens the PR. No hooks, no product code, no new dependencies.

**Tech Stack:** Markdown only. The command shells out to `git`, `gh` (v2.97.0, already authenticated), `bunx tsc`, and `bun --bun run test`.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include these.

- **No product code changes.** This is workflow and documentation only.
- **Hooks are out of scope.** Every rule here is a judgment call; hooks cannot make judgment calls and would add brittleness and false confidence without adding correctness.
- **Type-check with `bunx tsc --noEmit`, never `vite build`.** `vite build` does not type-check.
- **`/ship` never merges.** Merging stays Joel's, on GitHub.
- **`/ship` deletes nothing.** The `chore(docs):` cleanup lands in the commit Joel reviews before approving.
- **The backfill of the existing 18 documents is NOT part of this plan.** It ships later on its own branch so individual deletions can be vetoed.
- **`AI-VOICE-PRD.md`, `AI-VOICE-REQUIREMENTS.md`, `AI-VOICE-STATUS.md`, and `property-listing-form-prd-reference.md` are kept.** They describe unshipped work; the delete-at-ship rule has not been reached.
- **Do not add `fixedWidth` to any FontAwesome icon** — deprecated, and not relevant here since no components are touched.

## File Structure

| File | Responsibility |
|---|---|
| `.claude/commands/ship.md` | **Create.** The `/ship` command: gates → push → PR. Self-contained; owns the whole back half. |
| `CLAUDE.md` | **Modify.** Three rule blocks. Session-start context, so it owns decisions made *before* work starts (triage) and lookups made *during* it (where rationale lives). |
| `docs/superpowers/specs/2026-08-07-iteration-workflow-design.md` | **Delete in Task 3.** Per the lifecycle rule this spec dies when the work ships. |
| `docs/superpowers/plans/2026-08-07-iteration-workflow.md` | **Delete in Task 3.** This plan, likewise. |

`.claude/commands/` does not exist yet — this is the repo's first custom command.

The two deliverables are independent: `ship.md` is a procedure, the CLAUDE.md blocks are rules. Neither imports the other. A reviewer could reject one and keep the other, which is why they are separate tasks.

---

### Task 1: The three CLAUDE.md rule blocks

**Files:**
- Modify: `CLAUDE.md` — insert a new `## How we work` section after the `## Purpose` section (currently ends at line 7, before `## Important — browser verification` at line 9)

**Interfaces:**
- Consumes: nothing.
- Produces: the triage vocabulary — "fast lane", "tripwire", "spec lane" — reused by Task 2's command description and by Task 3's commit message.

- [ ] **Step 1: Read the current file to locate the insertion point**

Run: `sed -n '1,12p' CLAUDE.md`

Expected: `## Purpose` at line 5, its paragraph at line 7, blank line 8, `## Important — browser verification` at line 9. Insert between lines 8 and 9.

- [ ] **Step 2: Insert the section**

Insert this block immediately before the `## Important — browser verification` heading:

```markdown
## How we work

### Which lane a change takes

Default to the **fast lane**: state the approach in a sentence or two, then build. Bug
fixes, copy, styling, single-component changes, and anything with an obvious correct
answer go straight to work with no spec.

A change earns a **spec** only if it trips one of four wires:

1. **It touches the data model or seed fixtures** — a new entity, a changed shape, anything
   that moves `SEED_VERSION`.
2. **It adds or moves a route.** Moving a TanStack route silently breaks hardcoded
   `useParams({ from })` and full-reload `<a href>` navigation, and `vite build` catches
   neither.
3. **It introduces new vocabulary** — a stage, status, or concept other surfaces must agree
   with.
4. **The shape is genuinely unsettled** — if the approach can't be stated in a sentence, the
   design dialogue earns its cost.

Joel overrides either direction: "just do it" on a change that tripped a wire, "spec this
first" on one that didn't. If a fast-lane change turns out mid-flight to be bigger than it
looked, stop and say so — don't quietly write a spec nobody asked for.

### Specs are in-flight only

**If a spec is in `docs/superpowers/specs/`, the work is live.** A spec is a working
document, not a standing record. When the work ships, the spec and its plan are deleted in a
`chore(docs):` commit that goes out with the branch.

Anything worth keeping that isn't already in a commit or PR body — chiefly "we tried X and
reverted it" — gets written into the PR body *before* the delete. Deleting loses nothing
else: `git show <commit>^:docs/superpowers/specs/<file>.md` recovers any of it.

Never cite a spec as a current constraint without checking it's still there. A design from
last week may have been reversed this week.

### Where design rationale lives

In commit bodies and PR descriptions — not in a decisions file. They're already written,
they're permanently bound to the diff they describe, and they cost nothing at runtime
because they never enter the working tree.

To find why something is the way it is:

```bash
gh pr list --search "space deal" --state merged   # find the PR
gh pr view 130                                    # read the reasoning
git log --grep "suite status"                     # search commit bodies
git log -S "spaceAvailability" --oneline          # find when a symbol changed
```
```

- [ ] **Step 3: Verify the file still reads correctly and nothing was clobbered**

Run: `grep -n "^## " CLAUDE.md`

Expected, in order: `## Purpose`, `## How we work`, `## Important — browser verification`, `## Commands`, `## Environment Setup`, `## Architecture`, `## Prototype index`, `## Design System`, `## Icons`, `## Skills`.

If `## Important — browser verification` is missing or out of order, the insertion landed wrong — `git checkout CLAUDE.md` and redo Step 2.

- [ ] **Step 4: Confirm no other doc now contradicts these rules**

Run: `grep -rn "spec" CLAUDE.md | grep -iv "specific\|## How we work" | head`

Expected: only the lines just added. If an older line elsewhere in CLAUDE.md describes a different spec workflow, reconcile it now rather than leaving two rules in one file.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: state which lane a change takes, and where rationale lives

Three rules that were previously unwritten, which is why everything defaulted to
the heavy path. Triage sends changes to the fast lane unless they touch the data
model, move a route, introduce vocabulary, or have an unsettled shape.

Specs become in-flight only: if one is in specs/, the work is live. That single
invariant is what stops a reversed design being quoted back as a current
constraint, which is the failure that motivated this.

Rationale lives in commit bodies and PR descriptions, with the retrieval commands
written down so a session looks there instead of trusting a stale file."
```

---

### Task 2: The `/ship` command

**Files:**
- Create: `.claude/commands/ship.md`

**Interfaces:**
- Consumes: the triage vocabulary from Task 1 (referenced in the command's description).
- Produces: the `/ship` command. Task 3 invokes it.

**Note on frontmatter:** the documented fields are `description`, `argument-hint`, `allowed-tools`, and `model`. This repo has no existing command to copy, so Step 3 verifies the file actually loads rather than assuming the schema is right.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p .claude/commands
```

- [ ] **Step 2: Write the command file**

Create `.claude/commands/ship.md` with exactly this content:

````markdown
---
description: Run the gates, push the branch, and open the PR. Never merges.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(bunx:*), Bash(bun:*), Read
---

Ship the current branch. Joel has already reviewed and approved the commits — this
command does the mechanical part only.

Run these in order and **stop at the first failure**, showing the output rather than
continuing:

1. **Preconditions.** `git status --porcelain` must be empty and
   `git rev-parse --abbrev-ref HEAD` must not be `main`. If the tree is dirty, stop and
   show what's uncommitted — do not commit it yourself. If on `main`, stop and say so.

2. **Confirm there is something to ship.** `git log origin/main..HEAD --oneline`. If empty,
   stop: there are no commits to open a PR for.

3. **Type-check.** `bunx tsc --noEmit`. Must exit 0. Do NOT substitute `vite build` — it
   does not type-check.

4. **Test.** `bun --bun run test`. Must exit 0. Ignore the known-harmless biome output and
   the react/module Vitest stderr line; neither is a gate.

5. **Push.** `git push -u origin HEAD`.

6. **Open the PR.** `gh pr create --base main --title "<title>" --body "<body>"`.
   - Title: a plain sentence describing the change, matching the repo's style. Lowercase
     `type(scope):` prefixes belong on commits, not PR titles — look at recent PR titles
     with `gh pr list --state merged --limit 5` and match them.
   - Body: assembled from the commit messages on the branch
     (`git log origin/main..HEAD --format='%B'`). Lead with what changed and why. Keep the
     reasoning — recent PR bodies here run 2,000–8,500 characters and that length is
     deliberate, because the PR body is the durable record once the spec is deleted.
   - If the branch reverted or abandoned an approach, say so in the body. That lesson is
     the one thing a deleted spec takes with it.

7. **Report the PR URL** back to Joel.

**Never run `gh pr merge`.** Merging is Joel's, on GitHub. If asked to ship something
already merged, say so instead of opening a duplicate.

**Delete nothing.** If a spec or plan for this work still exists, do not remove it here —
it should already have been deleted in a `chore(docs):` commit that Joel reviewed. If it
wasn't, stop and tell him rather than deleting it unreviewed.

**If a Playwright browser was opened during this work, close it** with `browser_close`
before finishing.
````

- [ ] **Step 3: Verify the command loads**

The frontmatter schema is the one unverified assumption in this task. Confirm it parses:

Run: `ls -la .claude/commands/ship.md && head -5 .claude/commands/ship.md`

Then in the Claude Code session, check `/ship` appears in the command list. If it does not appear, or appears without its description, the frontmatter is wrong — remove the `allowed-tools` line first (it's the most likely culprit and the command still works without it, just with more permission prompts) and re-check.

Expected: `/ship` listed with description "Run the gates, push the branch, and open the PR. Never merges."

- [ ] **Step 4: Dry-check the gates actually work in this repo**

Before trusting the command, confirm both gates run clean right now:

Run: `bunx tsc --noEmit; echo "tsc exit: $?"`
Expected: `tsc exit: 0`

Run: `bun --bun run test 2>&1 | tail -5; echo "test exit: ${PIPESTATUS[0]}"`
Expected: `test exit: 0`

If either fails on unmodified `main`-equivalent code, the gate is wrong for this repo and the command must be corrected before Task 3 — do not weaken the gate to make it pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/ship.md
git commit -m "feat: add /ship — gates, push, PR, never merge

The back half of the loop was manual: after approving a commit Joel still pushed
the branch and opened the PR by hand. /ship takes that over from a single
'good to go'.

It gates on \`bunx tsc --noEmit\` and \`bun --bun run test\` — not \`vite build\`,
which does not type-check — and stops at the first failure rather than shipping
anyway.

Two things it deliberately does not do. It never merges; that stays Joel's. And it
deletes nothing: the chore(docs) cleanup belongs in the commit he reviews, so a
deletion is visible at the moment of consent rather than executed unseen."
```

---

### Task 3: Ship this work using the rules it just wrote

**Files:**
- Delete: `docs/superpowers/specs/2026-08-07-iteration-workflow-design.md`
- Delete: `docs/superpowers/plans/2026-08-07-iteration-workflow.md`

**Interfaces:**
- Consumes: `/ship` from Task 2, the lifecycle rule from Task 1.
- Produces: nothing. Terminal task.

This task is the end-to-end verification. Shipping the workflow change *through* the new workflow exercises every rule: the lifecycle delete, the reviewed-deletion constraint, and the command itself.

- [ ] **Step 1: Verify `/ship` refuses a dirty tree**

Prove the precondition works before relying on it:

```bash
echo "scratch" >> /tmp/nothing && touch .claude/commands/.scratch
```

Run `/ship`. Expected: it stops at step 1 and reports the untracked file. It must NOT push.

Then clean up: `rm .claude/commands/.scratch`

If `/ship` pushed anyway, the precondition check is broken — fix it in `.claude/commands/ship.md` before continuing.

- [ ] **Step 2: Verify `/ship` refuses a failing type-check**

Introduce a deliberate type error:

```bash
printf 'const x: number = "not a number"\n' > src/__shipcheck.ts
```

Run `/ship`. Expected: it stops at step 3 showing the `tsc` error, and does NOT push.

Then remove it: `rm src/__shipcheck.ts`

Run `bunx tsc --noEmit; echo "exit: $?"` and confirm `exit: 0` before continuing. If the scratch file is left behind it will break the real ship.

- [ ] **Step 3: Delete the spec and plan, in a commit Joel reviews**

Per the lifecycle rule, this happens *here* — in a reviewed commit — not inside `/ship`.

First re-read both documents for anything load-bearing not already captured in a commit body:

Run: `git log origin/main..HEAD --format='%B' | head -60`

Compare against the spec's reasoning. The spec's substance is already in commit `8c907d3`'s body. If anything is missing — particularly a rejected approach — add it to the PR body in Step 5 rather than keeping the file.

Then:

```bash
git rm docs/superpowers/specs/2026-08-07-iteration-workflow-design.md \
       docs/superpowers/plans/2026-08-07-iteration-workflow.md
git commit -m "chore(docs): delete the iteration-workflow spec and plan

The lifecycle rule this branch introduces says a spec is a working document that
dies when the work ships. This is that rule applied to itself.

The reasoning survives in 8c907d3's body and in this PR. Recover the full text with
\`git show 8c907d3^:docs/superpowers/specs/2026-08-07-iteration-workflow-design.md\`
if it is ever needed."
```

- [ ] **Step 4: Show Joel the full branch for approval**

Run: `git log origin/main..HEAD --oneline && git diff origin/main..HEAD --stat`

Expected: **six** commits, in this order —

1. `fdd4437` — the registry-token rename and the Playwright `browser_close` gotcha
2. `8c907d3` — this design spec
3. `728f676` — this plan
4. Task 1 — the CLAUDE.md rules
5. Task 2 — the `/ship` command
6. Task 3 Step 3 — the docs deletion

`fdd4437` predates this design and is unrelated to it: it renamed `GITHUB_TOKEN` to `BLUEPRINT_GH_TOKEN` so the npm token stops shadowing the `gh` CLI. It rides along because both belong to the `joel/cleanup` branch. **The PR body must cover it too** — do not describe the PR as only the workflow change, or the token rename ships undocumented.

Present this and **wait for "good to go"**. Do not proceed without it; the single approval gate is the whole point of the design.

- [ ] **Step 5: Ship it**

Run `/ship`.

Expected: both gates pass, the branch pushes, a PR opens against `main`, and the URL comes back. The PR body must explain the staleness problem that motivated this — that is the record once the spec is gone.

- [ ] **Step 6: Verify the end state**

```bash
ls docs/superpowers/specs/ | grep iteration-workflow || echo "spec gone — correct"
ls docs/superpowers/plans/ | grep iteration-workflow || echo "plan gone — correct"
gh pr view --json state,title --jq '"\(.state)  \(.title)"'
echo "commits: $(git log origin/main..HEAD --oneline | wc -l | tr -d ' ')"
ls src/__shipcheck.ts 2>/dev/null && echo "!!! scratch file left behind — delete it"
```

Expected: spec gone, plan gone, PR state `OPEN` (never `MERGED` — `/ship` must not have merged), `commits: 6`, and no `__shipcheck.ts`.

Also confirm the four reference documents survived, since they were explicitly out of scope:

```bash
ls docs/superpowers/specs/ | grep -vE '^20' | wc -l
```

Expected: `4` — `AI-VOICE-PRD.md`, `AI-VOICE-REQUIREMENTS.md`, `AI-VOICE-STATUS.md`, `property-listing-form-prd-reference.md`. If this reads `0`, the backfill was performed by mistake; it is not part of this plan.

Leave the PR open. Joel merges.

---

## Notes for the implementer

**There are no unit tests in this plan, and that is correct.** Both deliverables are markdown — a rules block and a procedure. There is nothing to import and assert against, and writing a Vitest case that greps `CLAUDE.md` for a string would test the test, not the behaviour. Verification is instead behavioural and lives in Task 3: `/ship` must refuse a dirty tree, must refuse a failing type-check, and must not merge. Those are the three ways it could actually cause harm, and each has an explicit step that proves it.

**Do not weaken a gate to make it pass.** If `bunx tsc --noEmit` fails on untouched code, that is a real finding about the repo — report it rather than removing the gate.

**Task 3 Step 2 writes a file into `src/`.** Make sure `src/__shipcheck.ts` is deleted before the real ship. It will fail the type-check by design, so a leftover copy blocks shipping rather than corrupting anything — but clean it up regardless.
