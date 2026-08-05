/**
 * Reading GitHub's public status page.
 *
 * The endpoint is the Statuspage summary JSON, which exists precisely so that
 * things can poll it. It is still somebody else's service, so this is called
 * **once per test run** and never in a loop — see README.md on cadence.
 */

/** Statuspage's overall indicator, worst to best. */
export type Indicator = "critical" | "major" | "minor" | "none";

export interface StatusReading {
  readonly indicator: Indicator;
  readonly description: string;
  readonly updatedAt: string;
}

export const STATUS_URL = "https://www.githubstatus.com/api/v2/status.json";

/**
 * A network failure is not an error condition here — it is the story.
 *
 * So this distinguishes "the service said something" from "we could not ask",
 * rather than throwing, and lets the tests decide what each one means.
 */
export type Fetched =
  | { readonly ok: true; readonly reading: StatusReading }
  | { readonly ok: false; readonly reason: string };

export const fetchStatus = async (
  url: string = STATUS_URL,
  timeoutMs = 10_000,
): Promise<Fetched> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Identifying the caller is the polite minimum when polling somebody
        // else's endpoint on a schedule.
        "user-agent":
          "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)",
        accept: "application/json",
      },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${String(response.status)}` };
    }
    const body: unknown = await response.json();
    const reading = readStatus(body);
    if (reading === undefined) {
      return {
        ok: false,
        reason: "response did not contain a status indicator",
      };
    }
    return { ok: true, reading };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

/** Parsed defensively: this is an external contract nobody promised us. */
const readStatus = (body: unknown): StatusReading | undefined => {
  if (typeof body !== "object" || body === null) return undefined;
  const status = (body as { status?: unknown }).status;
  if (typeof status !== "object" || status === null) return undefined;

  const { indicator, description } = status as {
    indicator?: unknown;
    description?: unknown;
  };
  if (typeof indicator !== "string") return undefined;

  const page = (body as { page?: unknown }).page;
  const updatedAt =
    typeof page === "object" && page !== null
      ? String((page as { updated_at?: unknown }).updated_at ?? "unknown")
      : "unknown";

  return {
    indicator: normalizeIndicator(indicator),
    description: typeof description === "string" ? description : "unknown",
    updatedAt,
  };
};

const normalizeIndicator = (raw: string): Indicator =>
  raw === "critical" || raw === "major" || raw === "minor" ? raw : "none";

/** Whether an indicator counts as degraded, given the configured threshold. */
export const isDegraded = (
  indicator: Indicator,
  threshold: Indicator,
): boolean => {
  const severity: Record<Indicator, number> = {
    none: 0,
    minor: 1,
    major: 2,
    critical: 3,
  };
  return severity[indicator] >= severity[threshold] && severity[threshold] > 0;
};

export const parseThreshold = (raw: string | undefined): Indicator => {
  if (raw === "critical" || raw === "major" || raw === "minor") return raw;
  if (raw !== undefined && raw.trim() !== "") {
    console.warn(
      `APPS_UPTIME_THRESHOLD="${raw}" is not one of minor, major, critical; using major`,
    );
  }
  return "major";
};
