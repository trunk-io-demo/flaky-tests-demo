/**
 * Where a run came from, as CI reports it.
 *
 * Three classes, and every branch is one of them:
 *
 * | Class | Branch                                   |
 * | ----- | ---------------------------------------- |
 * | `MQ`  | `trunk-merge/…` or `gh-readonly-queue/…` |
 * | `PB`  | `main`, `master`, `develop`, or `release` |
 * | `PR`  | everything else                          |
 *
 * Order matters: a merge-queue branch is `MQ` even when a PR number is also set,
 * so checking for a pull request first would misclassify every merge-queue run.
 */

/** The classes the stories branch on. `MQ` is the merge queue. */
export type BranchClass = "PR" | "PB" | "MQ";

/** Branch prefixes that mean a merge-queue run. */
const MERGE_QUEUE_PREFIXES = ["trunk-merge/", "gh-readonly-queue/"];

/** Branches treated as protected. Matched exactly, not by glob. */
const DEFAULT_PROTECTED_BRANCHES = ["main", "master", "develop", "release"];

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
 * The pull request number, if CI reports one.
 *
 * `GITHUB_REF` is `refs/pull/<n>/merge` on a `pull_request` event, the one signal
 * that survives without reading the event payload off disk. It is absent on a
 * branch classified as `PR` without being a real pull request, which is why the
 * class never depends on it.
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

/** Overridable, for a fork whose trunk branch is named something else. */
export const protectedBranches = (): string[] => {
  const configured = process.env.PROTECTED_BRANCHES;
  if (configured === undefined || configured.trim() === "")
    return DEFAULT_PROTECTED_BRANCHES;
  return configured
    .split(",")
    .map((branch) => branch.trim())
    .filter((branch) => branch !== "");
};

/** How a run is classified. See the table above for the rules. */
export const getBranchClass = (
  branch: string = getBranch(),
  protected_: string[] = protectedBranches(),
): BranchClass => {
  if (MERGE_QUEUE_PREFIXES.some((prefix) => branch.startsWith(prefix)))
    return "MQ";
  if (protected_.includes(branch)) return "PB";
  return "PR";
};

const firstNonEmpty = (values: (string | undefined)[]): string | undefined =>
  values.find((value) => value !== undefined && value.trim() !== "");
