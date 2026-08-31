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
deploy manifest. It routes `/*.*` to static with a compute fallback, and
everything else to compute.

## Node runtime: pinned to 22, on purpose

AWS's deployment spec allows exactly three values:

```ts
type ComputeRuntime = 'nodejs20.x' | 'nodejs22.x' | 'nodejs24.x';
```

Nitro defaults to `nodejs20.x`, which reached end of life in April 2026 — no
more security patches. So `vite.config.ts` pins it:

```ts
nitro({ awsAmplify: { runtime: "nodejs22.x" }, ... })
```

22 rather than 24 because it is the version we develop on, so what gets verified
locally is what runs in production. 24 is available and is a one-word change if
a longer support window matters more later.

The option is read only by the `aws-amplify` preset. The default `bun --bun run
build` ignores it and still writes `.output/` with no manifest — verified.

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

## Streaming: the server side is confirmed good

Otto streams its replies over SSE. Two things were checked.

### `awsLambda.streaming` does not apply here — do not set it

Nitro's AWS docs describe a `awsLambda: { streaming: true }` option. It looks
like the fix for streaming, but it belongs to a **different preset** and is
silently ignored by ours.

It works by swapping the build entry file (`_presets.mjs:178`):

```js
entry: "./aws-lambda/runtime/aws-lambda",
awsLambda: { streaming: false },
hooks: { "rollup:before": (nitro, rollupConfig) => {
  if (nitro.options.awsLambda?.streaming) rollupConfig.input += "-streaming";
}}
```

There is an `aws-lambda-streaming.mjs` to swap to. There is no
`aws-amplify-streaming.mjs`. Setting the flag in `vite.config.ts` produces no
error, no warning, and no change in output — so it reads like a fix that isn't
one.

It is also unnecessary. The flag exists because a raw Lambda handler buffers by
default and needs AWS's `streamifyResponse` wrapper. The `aws-amplify` preset
does not build a Lambda handler at all — it builds a plain Node web server:

```js
const server = new Server(toNodeHandler(nitroApp.fetch));
server.listen(3e3, ...)
```

`node:http` streams by default. There is nothing to switch on.

### Measured locally: it streams

Verified against a real `NITRO_PRESET=aws_amplify` build, driving the real Otto
rail in a browser and timestamping each SSE chunk as it arrived:

| Measure | Result |
| --- | --- |
| Response content type | `text/event-stream` |
| Chunks | 14 |
| Arrival times | 1, 2, 456, 1008, 1546, 2097, 2655, 3200, 3737, 4285, 4828, 5889 ms |
| Spread | 5.9 s, every chunk at a distinct time |
| Console errors | none |

Chunks arriving ~550 ms apart is streaming. A buffered response would deliver
all 14 at once at the end.

### What is still unknown

Only the part that cannot be tested from a laptop: whether Amplify's own
compute proxy and CloudFront pass the stream through, or buffer it before
sending it on. No Nitro setting can change that — by then our server has
already done the right thing.

So if Otto stops streaming after deploy, the cause is Amplify's edge, not this
repo. Do not go looking for a Nitro flag.
