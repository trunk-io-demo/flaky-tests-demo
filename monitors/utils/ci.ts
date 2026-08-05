/**
 * Where a run came from, as CI reports it.
 *
 * These read the same signals the uploader reads, so a story that branches on
 * `getBranchClass()` behaves the same way the product will classify it. Getting
 * that wrong produces a test that fails on the wrong runs and a story that says
 * something other than what its name claims.
 */

/** The classes the product groups runs by. `MQ` is the merge queue. */
export type BranchClass = "PR" | "PB" | "MQ" | "NONE";

/** Branch-name fragments that mean a merge-queue run. */
const MERGE_QUEUE_MARKERS = ["gh-readonly-queue/", "trunk-merge/", "/gtmq_"];
const MERGE_QUEUE_PREFIX = "gtmq_";

/** Branch prefixes that imply a pull request with no PR number set. */
const PULL_REQUEST_PREFIXES = ["pull/", "remotes/pull/"];

/**
 * The branch this run is for.
 *
 * `GITHUB_HEAD_REF` is set only on `pull_request` events and holds the *source*
 * branch; `GITHUB_REF_NAME` on such an event would be `123/merge`, which is not
 * a branch anybody configured a monitor against. So head ref wins.
 */
export const getBranch = (): string =>
  firstNonEmpty([
    process.env.MONITORS_BRANCH_OVERRIDE,
    process.env.GITHUB_HEAD_REF,
    process.env.GITHUB_REF_NAME,
  ]) ?? "unknown";

/**
 * The pull request number, if this run is for one.
 *
 * `GITHUB_REF` is `refs/pull/<n>/merge` on a `pull_request` event, which is the
 * one signal that survives without reading the event payload off disk.
 */
export const getPrNumber = (): number | undefined => {
  const override = process.env.MONITORS_PR_NUMBER_OVERRIDE;
  if (override !== undefined && override.trim() !== "") {
    const parsed = Number.parseInt(override, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  const match = /^refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF ?? "");
  if (match?.[1] === undefined) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Branches the org protects. Matched **exactly**, not by glob — `release/*`
 * looking like a protected pattern does not make `release/1.4.2` protected, and
 * that is the usual reason a run intended as `PB` arrives as `NONE`.
 */
export const protectedBranches = (): string[] =>
  (process.env.PROTECTED_BRANCHES ?? "main")
    .split(",")
    .map((branch) => branch.trim())
    .filter((branch) => branch !== "");

/**
 * How the product will classify this run.
 *
 * The precedence is the uploader's, and the order matters: a merge-queue branch
 * is `MQ` even if a PR number is also set, so checking for a PR number first
 * would misclassify every merge-queue run.
 */
export const getBranchClass = (
  branch: string = getBranch(),
  prNumber: number | undefined = getPrNumber(),
  protected_: string[] = protectedBranches(),
): BranchClass => {
  const mergeQueue =
    MERGE_QUEUE_MARKERS.some((marker) => branch.includes(marker)) ||
    branch.startsWith(MERGE_QUEUE_PREFIX);

  if (mergeQueue) return "MQ";
  if (prNumber !== undefined) return "PR";
  if (PULL_REQUEST_PREFIXES.some((prefix) => branch.startsWith(prefix)))
    return "PR";
  if (protected_.includes(branch)) return "PB";
  return "NONE";
};

const firstNonEmpty = (values: (string | undefined)[]): string | undefined =>
  values.find((value) => value !== undefined && value.trim() !== "");
