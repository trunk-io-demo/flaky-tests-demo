// GET /rate_limit does not count against the limit it reports, so the budget is
// observed for free. The burst that spends it is small, sequential, and capped:
// the failures should come from the budget being shared — 60/hour per IP, and CI
// runners share IPs — not from us exhausting it.

const RATE_LIMIT_URL = "https://api.github.com/rate_limit";
const BURST_URL = "https://api.github.com/zen";

const HEADERS = {
  "user-agent": "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)",
  accept: "application/vnd.github+json",
} as const;

export const BURST = 6;

export interface Budget {
  readonly limit: number;
  readonly remaining: number;
  readonly resetsAt: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

const request = async (
  url: string,
  timeoutMs: number,
): Promise<Result<Response>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return {
      ok: true,
      value: await fetch(url, { signal: controller.signal, headers: HEADERS }),
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

export const fetchBudget = async (
  timeoutMs = 10_000,
): Promise<Result<Budget>> => {
  const response = await request(RATE_LIMIT_URL, timeoutMs);
  if (!response.ok) return response;
  if (!response.value.ok) {
    return { ok: false, reason: `HTTP ${String(response.value.status)}` };
  }

  const body: unknown = await response.value.json();
  const core = (body as { resources?: { core?: unknown } }).resources?.core;
  const { limit, remaining, reset } = (core ?? {}) as {
    limit?: unknown;
    remaining?: unknown;
    reset?: unknown;
  };
  if (
    typeof limit !== "number" ||
    typeof remaining !== "number" ||
    typeof reset !== "number"
  ) {
    return { ok: false, reason: "core rate limit was not shaped as expected" };
  }
  return {
    ok: true,
    value: { limit, remaining, resetsAt: new Date(reset * 1000).toISOString() },
  };
};

export interface BurstOutcome {
  readonly attempted: number;
  readonly succeeded: number;
  readonly rateLimited: number;
  readonly failed: number;
  readonly firstReason?: string;
}

// Sequential, not parallel: a parallel burst is a spike against somebody else's
// service, and would make the outcome depend on connection scheduling.
export const spendBurst = async (
  size: number,
  timeoutMs = 10_000,
): Promise<BurstOutcome> => {
  let succeeded = 0;
  let rateLimited = 0;
  let failed = 0;
  let firstReason: string | undefined;

  for (let i = 0; i < size; i++) {
    const response = await request(BURST_URL, timeoutMs);
    if (!response.ok) {
      failed++;
      firstReason ??= response.reason;
    } else if (response.value.status === 403 || response.value.status === 429) {
      rateLimited++;
      firstReason ??= `HTTP ${String(response.value.status)} (rate limited)`;
    } else if (!response.value.ok) {
      failed++;
      firstReason ??= `HTTP ${String(response.value.status)}`;
    } else {
      succeeded++;
    }
  }

  return { attempted: size, succeeded, rateLimited, failed, firstReason };
};
