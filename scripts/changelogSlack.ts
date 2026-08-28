/**
 * Post a merged PR's changelog entry to Slack — or check that it has one.
 *
 * Both GitHub workflows call this file, so "does this PR have an entry" is
 * answered in exactly one place. It reads `changelogEntries.ts` directly, which
 * is why that module imports nothing: CI can run this with no `bun install` at
 * all, and never needs the private-registry tokens Blueprint and FontAwesome
 * Pro sit behind.
 *
 *   bun --bun run scripts/changelogSlack.ts --pr 185            # print payload
 *   bun --bun run scripts/changelogSlack.ts --pr 185 --check    # gate
 *   bun --bun run scripts/changelogSlack.ts --pr 185 --post     # send
 *
 * Env for --post:
 *   SLACK_BOT_TOKEN          xoxb-… (a secret)
 *   SLACK_CHANGELOG_CHANNEL  a channel id (C…) or a user id (U…) for a DM
 */
import {
  CHANGELOG,
  KIND_ORDER,
  authorName,
  prUrl,
  type ChangeKind,
  type ChangelogEntry,
} from "#/components/changelog/changelogEntries";

/**
 * Slack has no badges, so the page's flat highlight list groups under a header
 * per kind. The emoji carries the kind where the page uses colour — a Slack
 * message is read in a feed, and a list of undifferentiated bullets scrolls past.
 */
const SLACK_KIND: Record<ChangeKind, { emoji: string; label: string }> = {
  feature: { emoji: "✨", label: "New" },
  refinement: { emoji: "🖌", label: "Refined" },
  fix: { emoji: "🐞", label: "Fixed" },
};

type SlackPayload = {
  channel?: string;
  text: string;
  blocks: unknown[];
};

export function buildPayload(entry: ChangelogEntry): SlackPayload {
  const url = prUrl(entry.pr);
  const meta = [entry.area, `<${url}|#${entry.pr}>`, authorName(entry.author)]
    .filter(Boolean)
    .join(" · ");

  const blocks: unknown[] = [
    {
      type: "header",
      // Header blocks are plain_text only — no link, no bold. The title is the
      // one thing that must survive being skimmed in a busy channel.
      text: { type: "plain_text", text: `📋 ${entry.title}`, emoji: true },
    },
    { type: "context", elements: [{ type: "mrkdwn", text: meta }] },
    { type: "section", text: { type: "mrkdwn", text: entry.summary } },
  ];

  for (const kind of KIND_ORDER) {
    const lines = entry.highlights.filter((h) => h.kind === kind);
    if (lines.length === 0) continue;
    const { emoji, label } = SLACK_KIND[kind];
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${emoji} ${label}*\n${lines.map((h) => `• ${h.text}`).join("\n")}`,
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View pull request", emoji: true },
        url,
        action_id: `view_pr_${entry.pr}`,
      },
    ],
  });

  return {
    // The notification fallback — what shows in the sidebar and on a phone.
    // Without it Slack pushes a blank notification for a blocks-only message.
    text: `Changelog — ${entry.title} (#${entry.pr})`,
    blocks,
  };
}

/**
 * Is this destination a person rather than a channel?
 *
 * Slack ids are prefixed by kind: `C` a public channel, `G` a private one, `D`
 * an already-open DM, `U` (or `W` on Enterprise Grid) a person. Only a person
 * needs `conversations.open` first — `chat.postMessage` is inconsistent about
 * accepting a bare user id, and a `D…` is already a conversation.
 */
export function isUserId(destination: string): boolean {
  return /^[UW][A-Z0-9]+$/i.test(destination);
}

type SlackResponse = {
  ok?: boolean;
  error?: string;
  ts?: string;
  channel?: { id?: string };
};

/**
 * Slack answers HTTP 200 with `ok: false` on every application error — an
 * unknown channel, a missing scope, a bot that was never invited. Reading the
 * status would report success for a call that did nothing, so every caller
 * checks the body. Shared so neither call site can forget.
 */
async function slackCall(
  method: string,
  token: string,
  body: unknown,
): Promise<SlackResponse> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as SlackResponse;
}

function parseArgs(argv: string[]) {
  const pr = Number(argv[argv.indexOf("--pr") + 1]);
  return {
    pr,
    check: argv.includes("--check"),
    post: argv.includes("--post"),
  };
}

async function main() {
  const { pr, check, post } = parseArgs(process.argv);

  if (!Number.isInteger(pr) || pr <= 0) {
    console.error("Usage: changelogSlack.ts --pr <number> [--check|--post]");
    process.exit(2);
  }

  const entry = CHANGELOG.find((e) => e.pr === pr);

  if (!entry) {
    // The gate's whole message. It has to say what to do, not just what failed —
    // this is the first thing a contributor sees when their PR goes red.
    console.error(
      [
        `No changelog entry for PR #${pr}.`,
        "",
        "Add one to the top of CHANGELOG in",
        "src/components/changelog/changelogEntries.ts — pr, title, mergedAt,",
        "day (the local calendar day), author, area, a one-line summary, and a",
        "highlight per user-facing change with kind: feature | refinement | fix.",
        "",
        "If this PR has nothing user-facing to announce (docs, chore, test only),",
        "label it 'no-changelog' and this check will skip.",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (check) {
    console.log(
      `PR #${pr} has a changelog entry (${entry.highlights.length} highlight(s)).`,
    );
    return;
  }

  const payload = buildPayload(entry);

  if (!post) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANGELOG_CHANNEL;

  // Neither set means Slack was never wired up. Skip rather than fail, so this
  // can merge before the Slack app exists without leaving a red X on every
  // merge until someone gets round to it — and so a fork or a clone with no
  // Slack of its own is not permanently broken. It starts posting on its own
  // the moment the secret and the variable appear.
  if (!token && !channel) {
    console.log(
      "Slack is not configured (SLACK_BOT_TOKEN and SLACK_CHANGELOG_CHANNEL are both unset) — skipping.",
    );
    return;
  }

  // Exactly one of them set is a real misconfiguration rather than a not-yet,
  // and has to be loud: a token with no destination would post nothing, for
  // ever, while every run stayed green.
  if (!token || !channel) {
    const missing = token ? "SLACK_CHANGELOG_CHANNEL" : "SLACK_BOT_TOKEN";
    console.error(`Slack is half-configured: ${missing} is missing.`);
    process.exit(2);
  }

  // A person needs their DM opened before it can be posted to.
  let destination = channel;
  if (isUserId(destination)) {
    const opened = await slackCall("conversations.open", token, {
      users: destination,
    });
    if (!opened.ok || !opened.channel?.id) {
      console.error(
        `Could not open a DM with ${destination}: ${opened.error ?? "unknown error"}`,
      );
      if (opened.error === "missing_scope") {
        console.error(
          "The app needs the im:write scope. Add it, reinstall the app, and use the new token.",
        );
      }
      if (opened.error === "user_not_found") {
        console.error(
          "That is not a user id in this workspace. Copy it from your Slack profile → ⋯ → Copy member ID.",
        );
      }
      process.exit(1);
    }
    destination = opened.channel.id;
    console.log(`Opened DM ${destination} with ${channel}.`);
  }

  const body = await slackCall("chat.postMessage", token, {
    ...payload,
    channel: destination,
  });
  if (!body.ok) {
    console.error(`Slack rejected the message: ${body.error ?? "unknown error"}`);
    if (body.error === "not_in_channel") {
      console.error("Invite the bot to the channel: /invite @<your app name>");
    }
    if (body.error === "channel_not_found") {
      console.error(
        "SLACK_CHANGELOG_CHANNEL must be an id (C… or U…), not a #name.",
      );
    }
    process.exit(1);
  }

  console.log(`Posted PR #${pr} to ${destination} (ts ${body.ts}).`);
}

// Only when run as a command. Bun sets `import.meta.main`; under Vitest it is
// undefined, which is what lets the test file import buildPayload and isUserId
// without main() firing and exiting the process on a missing --pr.
if ((import.meta as { main?: boolean }).main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
