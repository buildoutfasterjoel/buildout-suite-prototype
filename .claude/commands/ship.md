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
   - Cover **every** commit on the branch, including any that are unrelated to the headline
     change. A commit that rides along undescribed ships undocumented.
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
