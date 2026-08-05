const STATUS_URL = "https://www.githubstatus.com/api/v2/status.json";

export type Indicator = "critical" | "major" | "minor" | "none";

export type Fetched =
  | {
      readonly ok: true;
      readonly indicator: Indicator;
      readonly description: string;
    }
  | { readonly ok: false; readonly reason: string };

// "Could not ask" is a distinct outcome from "the service said something": both
// answer "can I depend on GitHub right now", which is what a test depending on
// GitHub implicitly asks every run.
export const fetchStatus = async (timeoutMs = 10_000): Promise<Fetched> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(STATUS_URL, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)",
        accept: "application/json",
      },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${String(response.status)}` };
    }
    const body: unknown = await response.json();
    const status = (
      body as { status?: { indicator?: unknown; description?: unknown } }
    ).status;
    if (typeof status?.indicator !== "string") {
      return { ok: false, reason: "no status indicator in the response" };
    }
    return {
      ok: true,
      indicator: normalize(status.indicator),
      description:
        typeof status.description === "string" ? status.description : "unknown",
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

const normalize = (raw: string): Indicator =>
  raw === "critical" || raw === "major" || raw === "minor" ? raw : "none";

const SEVERITY: Record<Indicator, number> = {
  none: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

export const isDegraded = (
  indicator: Indicator,
  threshold: Indicator,
): boolean =>
  SEVERITY[threshold] > 0 && SEVERITY[indicator] >= SEVERITY[threshold];
