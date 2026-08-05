import * as z from "zod";

// Atlassian Statuspage serves the same `/api/v2/status.json` on every page it
// hosts, which is why one client covers fifteen companies.
//
// An unrecognised indicator becomes `none` rather than a parse failure: a new
// severity word appearing upstream should not read as fifteen services breaking.

const USER_AGENT =
  "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)";
const TIMEOUT_MS = 10_000;

const INDICATORS = [
  "none",
  "minor",
  "major",
  "critical",
  "maintenance",
] as const;

const StatusResponse = z.object({
  status: z.object({
    indicator: z.enum(INDICATORS).catch("none"),
    description: z.string().catch("unknown"),
  }),
});

export type Indicator = (typeof INDICATORS)[number];

export type Reading =
  | {
      readonly ok: true;
      readonly indicator: Indicator;
      readonly detail: string;
    }
  | { readonly ok: false; readonly reason: string };

/** Anything other than `none` counts, maintenance included. */
export const isOperational = (indicator: Indicator): boolean =>
  indicator === "none";

export type Service = { readonly name: string; readonly host: string };

// GitHub is deliberately absent: `apps/github-uptime` already reads that page, at
// a `major` threshold, and polling it twice would be one story in two places.
export const SERVICES: readonly Service[] = [
  { name: "npm", host: "status.npmjs.org" },
  { name: "PyPI", host: "status.python.org" },
  { name: "crates.io", host: "status.crates.io" },
  { name: "RubyGems", host: "status.rubygems.org" },
  { name: "Atlassian", host: "status.atlassian.com" },
  { name: "CircleCI", host: "status.circleci.com" },
  { name: "Cloudflare", host: "www.cloudflarestatus.com" },
  { name: "HashiCorp", host: "status.hashicorp.com" },
  { name: "Sentry", host: "status.sentry.io" },
  { name: "Datadog", host: "status.datadoghq.com" },
  { name: "LaunchDarkly", host: "status.launchdarkly.com" },
  { name: "OpenAI", host: "status.openai.com" },
  { name: "Anthropic", host: "status.claude.com" },
  { name: "Braintrust", host: "status.braintrust.dev" },
  { name: "Langfuse", host: "status.langfuse.com" },
];

export const readStatus = async (host: string): Promise<Reading> => {
  try {
    const response = await fetch(`https://${host}/api/v2/status.json`, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${String(response.status)}` };
    }

    const parsed = StatusResponse.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        reason: `unexpected response shape: ${z.prettifyError(parsed.error).split("\n")[0] ?? "unknown"}`,
      };
    }
    const { indicator, description } = parsed.data.status;
    return { ok: true, indicator, detail: description };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};
