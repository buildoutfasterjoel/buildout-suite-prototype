# Hosting on AWS Amplify

`amplify.yml` at the repo root is the build spec. It covers everything that can
live in the repo. The rest is console settings, listed below.

## Why the build spec is custom

Amplify's build image has Node and npm, but not Bun. So `preBuild` installs Bun
first (`curl -fsSL https://bun.sh/install | bash`), puts it on `PATH`, then runs
the same commands we run locally.

## Why the app must be WEB_COMPUTE, not static

This prototype needs a server. Six modules use `createServerFn`:

| Module | What breaks without a server |
| --- | --- |
| `src/lib/auth.ts` | the `PROTOTYPE_PASSWORD` gate |
| `src/ai/relay.ts` | Otto's answers |
| `src/ai/tts.ts` | Otto's voice |
| `src/ai/generate/generators.ts` | AI generation |
| `src/lib/comps.ts`, `src/lib/properties.ts` | property + comp lookups |

`NITRO_PRESET=aws_amplify` makes Nitro write `.amplify-hosting/` instead of
`.output/`:

```
.amplify-hosting/
  deploy-manifest.json     # routes + compute config Amplify reads
  compute/default/server.js
  static/                  # assets served directly from the CDN
```

That is the layout Amplify's compute platform expects, so we do not hand-write a
deploy manifest. The manifest asks for the `nodejs20.x` runtime and routes
`/*.*` to static with a compute fallback, and everything else to compute.

The generated server listens on **port 3000**, hardcoded — that is the port
Amplify Hosting compute expects, so leave it alone.

## Console settings (cannot be set from the repo)

1. **Platform: `WEB_COMPUTE`.** If it is left on `WEB` (static), the build
   artifacts upload but every server function 404s.
2. **Environment variables.** The two tokens are needed at *build* time; the
   rest at *run* time.

   | Variable | Needed for | Required? |
   | --- | --- | --- |
   | `BLUEPRINT_GH_TOKEN` | installing `@buildoutinc` packages | yes — build fails without it |
   | `FONTAWESOME_PRO_TOKEN` | installing `@fortawesome` Pro packages | yes — build fails without it |
   | `PROTOTYPE_PASSWORD` | the password gate | no — empty means no gate |
   | `ANTHROPIC_API_KEY` | Otto | no — Otto fails without it |
   | `ELEVENLABS_API_KEY` | Otto's voice | no — falls back to browser speech |

   `bunfig.toml` reads the two tokens straight from the environment, so setting
   them in the console is all that is needed. Do not name the GitHub one
   `GITHUB_TOKEN` — see the note in `CLAUDE.md`.

## Verifying a build locally

```bash
NITRO_PRESET=aws_amplify bun --bun run build
node .amplify-hosting/compute/default/server.js   # serves on :3000
```

## Open question: does Otto still stream?

Otto streams its replies over SSE. It is not yet confirmed whether Amplify's
compute platform passes a streamed response through or buffers it. If it
buffers, Otto still answers, but the whole reply appears at once instead of
word by word. Confirm this on the first real deploy.
