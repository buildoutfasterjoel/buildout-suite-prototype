// Entrypoint for the Amplify compute resource.
//
// It replaces the one-liner Nitro's aws-amplify preset writes
// (`import("./index.mjs")`) because that one starts the server with no
// environment. Amplify's console environment variables reach the *build*
// container only — AWS does this deliberately, so that secrets used during a
// build cannot leak into a running server:
//
//   "a Next.js server component doesn't have access to those environment
//    variables by default. This behavior is intentional."
//   https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html
//
// Without this file the password gate reads no PROTOTYPE_PASSWORD and lets
// everyone through, and Otto reads no ANTHROPIC_API_KEY and reports itself
// unconfigured. `amplify.yml` writes the allowlisted variables to a `.env`
// beside this file at build time; this loads them before the app starts.
//
// Two things here are load-bearing:
//
// 1. CommonJS, not ESM. Amplify runs `node server.js`, and there is no
//    `package.json` in this directory declaring `type: module`, so a static
//    `import` is a syntax error. A dynamic `import()` is legal in CJS, which
//    is the only reason the preset's own one-liner works.
//
// 2. The failure is logged, never swallowed. `process.loadEnvFile` needs Node
//    >= 20.12; a silent catch here once hid a wrong Node version and looked
//    exactly like a missing key. The compute runtime is pinned to nodejs22.x
//    in vite.config.ts, so this should not fire — and if it ever does, the
//    Amplify log says so instead of the app quietly running wide open.
const { join } = require("node:path");

try {
  process.loadEnvFile(join(__dirname, ".env"));
} catch (err) {
  console.error("[amplify] could not load .env — the gate and Otto will be unconfigured:", err.message);
}

import("./index.mjs");
