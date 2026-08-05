/**
 * Reading GitHub's unauthenticated rate-limit budget, and spending a little of it.
 *
 * ## The politeness question, answered explicitly
 *
 * The scenario this folder demonstrates is "failures that cluster in time and
 * correlate across tests", and rate limiting is the cleanest real cause of that
 * shape. The naive way to demonstrate it is to hammer an endpoint until it says
 * no. We do not do that.
 *
 * Instead:
 *
 * - `GET /rate_limit` **does not count against the limit it reports** — GitHub
 *   documents this — so the budget can be observed for free, every run.
 * - The burst that actually spends budget is small and configurable, defaulting
 *   to a handful of requests per run against an endpoint that returns a few bytes.
 * - The failures come from the budget being *shared*, not from us exhausting it.
 *   GitHub's unauthenticated limit is 60 requests per hour **per IP**, and CI
 *   runners share IPs with everything else on the platform. So the budget is
 *   routinely low or gone for reasons that have nothing to do with us, which is
 *   exactly the real-world shape worth demonstrating.
 *
 * Raising `APPS_THIRD_PARTY_BURST` is how you make this fire more often, and it is
 * paid for out of somebody else's rate limit. The README says so.
 */

export const RATE_LIMIT_URL = "https://api.github.com/rate_limit";
export const BURST_URL = "https://api.github.com/zen";

const HEADERS = {
  // Identifying the caller is the polite minimum when calling somebody else's
  // API on a schedule.
  "user-agent": "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)",
  accept: "application/vnd.github+json",
} as const;

export interface Budget {
  readonly limit: number;
  readonly remaining: number;
  readonly resetsAt: Date;
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

/** The current unauthenticated budget for this runner's IP. Costs nothing. */
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
  if (typeof core !== "object" || core === null) {
    return { ok: false, reason: "response did not contain a core rate limit" };
  }

  const { limit, remaining, reset } = core as {
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
    value: { limit, remaining, resetsAt: new Date(reset * 1000) },
  };
};

export interface BurstOutcome {
  readonly attempted: number;
  readonly succeeded: number;
  readonly rateLimited: number;
  readonly failed: number;
  readonly firstReason?: string;
}

/**
 * Make `size` small sequential requests.
 *
 * Sequential rather than parallel on purpose. A parallel burst is a spike against
 * somebody else's service, and it also makes the outcome depend on connection
 * scheduling rather than on the budget — which would blur the very signal this
 * scenario is about.
 */
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
      continue;
    }
    if (response.value.status === 403 || response.value.status === 429) {
      rateLimited++;
      firstReason ??= `HTTP ${String(response.value.status)} (rate limited)`;
      continue;
    }
    if (!response.value.ok) {
      failed++;
      firstReason ??= `HTTP ${String(response.value.status)}`;
      continue;
    }
    succeeded++;
  }

  return { attempted: size, succeeded, rateLimited, failed, firstReason };
};

export const burstSize = (): number => {
  const raw = process.env.APPS_THIRD_PARTY_BURST;
  if (raw === undefined || raw.trim() === "") return 6;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_BURST) {
    console.warn(
      `APPS_THIRD_PARTY_BURST="${raw}" is not between 1 and ${String(MAX_BURST)}; using 6`,
    );
    return 6;
  }
  return parsed;
};

/**
 * A hard ceiling, not a suggestion.
 *
 * The unauthenticated budget is 60 per hour. A burst above 20 on an hourly
 * schedule would make this repo a meaningful fraction of a shared IP's budget,
 * which is a cost borne by everybody else on that runner rather than by us.
 */
export const MAX_BURST = 20;
