import { defaultExclude, defineConfig } from "vitest/config";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tanstackStart(),
    viteReact(),
  ],
  test: {
    // Agent sessions create git worktrees under .claude/worktrees/, each with
    // its own node_modules. Vitest's default include globs walk into them, so
    // every test file is collected twice — which silently doubles the reported
    // counts, and worse, the duplicate copies resolve `react` from the root
    // while `react-dom` comes from the worktree. Two copies of React means a
    // null dispatcher, so any test that renders a hook fails with "Invalid hook
    // call" even though the test and the code under test are both fine.
    // Removing a stale worktree fixes it once; this keeps the next one from
    // reintroducing it.
    exclude: [...defaultExclude, "**/.claude/**"],
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ["node_modules"],
        silenceDeprecations: [
          "import",
          "global-builtin",
          "color-functions",
          "if-function",
        ],
      },
    },
  },
});

export default config;
