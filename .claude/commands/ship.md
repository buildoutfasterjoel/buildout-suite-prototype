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

2b. **Check `gh` auth before running the gates**, so a 10-minute test run isn't wasted on a
   step that can't finish: `gh auth status`. If it reports logged in, continue.

   If it says "not logged into any GitHub hosts", **do not conclude there is no
   credential** — that exact wording bit us once. `gh` keeps its token in the macOS
   keychain and uses `~/.config/gh/hosts.yml` only as the index of which hosts exist. If
   that file is missing, gh never looks in the keychain and reports not-logged-in while a
   perfectly good token sits there. Check with:

   ```
   security dump-keychain 2>/dev/null | grep -c 'GitHub - https://api.github.com'
   ```

   If that returns 1, the token is intact and only the index is gone. Writing
   `~/.config/gh/hosts.yml` is blocked by the permission classifier (it is
   credentials-adjacent), so give Joel this to run himself with the `!` prefix:

   ```
   ! mkdir -p ~/.config/gh && printf 'github.com:\n    user: buildoutfasterjoel\n    git_protocol: ssh\n' > ~/.config/gh/hosts.yml && gh auth status
   ```

   Only if that still fails is `gh auth login` needed. Tell him to choose **Skip** at the
   "upload your SSH public key" prompt — he already has `buildoutfasterjoel-GitHub` on the
   account, and that step is unrelated to authenticating gh.

   **Do not offer `BLUEPRINT_GH_TOKEN` / `BLUEPRINT_GITHUB_TOKEN` as a substitute.** Those
   are registry PATs with `read:packages` only; they cannot open a PR, and they are
   deliberately not named `GITHUB_TOKEN` so they cannot shadow real gh credentials.

   Useful distinction to state plainly if it comes up: an SSH key authenticates **git
   transport**, which is why `git push` succeeds while `gh` fails. The GitHub API takes a
   token and never a key, so `git push` working is not evidence that `gh` will.

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

6b. **Write the PR's own changelog entry, then push it.** The repo gates every PR on
   having one (`.github/workflows/changelog-check.yml`), and the entry is keyed to the
   PR's *own number* — which does not exist until step 6 has run. So this step is
   necessarily after the PR is open, and the check will be red until it lands.

   **Do not label round it.** `no-changelog` is only for a PR with nothing user-facing
   at all — docs, chore or test-only work. Anything a person would notice earns a card.

   Add the entry to the **top** of `CHANGELOG` in
   `src/components/changelog/changelogEntries.ts`:

   - `pr` — the number from step 6.
   - `title` — the PR title.
   - `mergedAt` — the current UTC time (`date -u +%Y-%m-%dT%H:%M:%SZ`). It is an estimate,
     because the merge has not happened; only ordering depends on it and nothing renders it.
   - `day` — the current **local** calendar day (`date +%Y-%m-%d`), not the UTC one.
   - `author` — the GitHub login. Add it to `AUTHOR_NAMES` if it is not there.
   - `area` — one of the areas already in use. Read the file rather than inventing one.
   - `summary` — one sentence on what the PR was *for*. Not what it touched.
   - `highlights` — one per user-facing change, `kind` being `feature`, `refinement` or
     `fix`. Read the commit bodies, not just the subjects.

   **Write sentences, not commit subjects.** `refine(voucher): every deposit carries a
   reference number` becomes "Every deposit carries a reference number, editable in
   place." That rewriting is the whole reason the page reads as a changelog rather than a
   git log, and it is why this step is not automated away into a script.

   Drop the housekeeping commits — `docs`, `chore`, `test`, `seed` prefixes describe work
   nobody outside the repo can see. A card listing "delete the spec" trains people to stop
   reading the page.

   Then verify and push:

   ```
   bun --bun run scripts/changelogSlack.ts --pr <number> --check
   bunx tsc --noEmit && bun --bun run test
   git add src/components/changelog/changelogEntries.ts && git commit && git push
   ```

   Commit it separately with a `docs(changelog):` subject rather than amending — the PR is
   already open and its commits have been reviewed.

7. **Report the PR URL** back to Joel.

**Never run `gh pr merge`.** Merging is Joel's, on GitHub. If asked to ship something
already merged, say so instead of opening a duplicate.

**Delete nothing.** If a spec or plan for this work still exists, do not remove it here —
it should already have been deleted in a `chore(docs):` commit that Joel reviewed. If it
wasn't, stop and tell him rather than deleting it unreviewed.

**If a Playwright browser was opened during this work, close it** with `browser_close`
before finishing.
