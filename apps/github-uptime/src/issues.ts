import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";

import { TIMEOUT_MS, USER_AGENT, type Probe } from "./probe";

export type Repo = "actions/runner" | "github/gh-stack" | "github/docs";

// This is the one client here that has to come back with a number rather than an
// excuse, so it backs off instead of giving up: the plugins wait out a limit of
// up to MAX_WAIT_S and retry, and `rateLimited` marks an answer that still never
// arrived so a caller can leave it out rather than call it a failure.
// A search window is a minute wide, so anything less than that would give up on a
// limit it could simply have waited out.
const MAX_WAIT_S = 70;
const MAX_RETRIES = 2;

const keepWaiting = (retryAfterS: number, retryCount: number): boolean =>
  retryAfterS <= MAX_WAIT_S && retryCount < MAX_RETRIES;

const Client = Octokit.plugin(throttling, retry);

const octokit = new Client({
  // A token is a CI fact rather than configuration, and absent locally. It lifts
  // the search API from 10 requests a minute to 30.
  auth: process.env.GITHUB_TOKEN,
  userAgent: USER_AGENT,
  throttle: {
    onRateLimit: (retryAfterS, _options, _octokit, retryCount) =>
      keepWaiting(retryAfterS, retryCount),
    onSecondaryRateLimit: (retryAfterS, _options, _octokit, retryCount) =>
      keepWaiting(retryAfterS, retryCount),
  },
});

export const searchBudget = async (): Promise<Probe<number>> => {
  try {
    const { data } = await octokit.rest.rateLimit.get({
      request: { signal: AbortSignal.timeout(TIMEOUT_MS) },
    });
    return { ok: true, value: data.resources.search?.remaining ?? 0 };
  } catch (error) {
    return failure(error);
  }
};

export const countIssuesOpenedSince = async (
  repo: Repo,
  sinceIso: string,
): Promise<Probe<number>> => {
  try {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `repo:${repo} type:issue created:>=${sinceIso}`,
      per_page: 1,
      // The default is the retired search backend, which GitHub is removing.
      advanced_search: "true",
      request: { signal: AbortSignal.timeout(TIMEOUT_MS) },
    });
    return { ok: true, value: data.total_count };
  } catch (error) {
    return failure(error);
  }
};

const failure = (error: unknown): Probe<number> => {
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") {
    const limited = status === 403 || status === 429;
    return {
      ok: false,
      rateLimited: limited,
      reason: limited
        ? `rate limited even after backing off (HTTP ${String(status)})`
        : `HTTP ${String(status)}`,
    };
  }
  return {
    ok: false,
    rateLimited: false,
    reason: error instanceof Error ? error.message : String(error),
  };
};
