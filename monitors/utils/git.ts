/**
 * Where a run came from. MQ wins over everything, so it is checked first.
 *
 *   MQ  trunk-merge/… or gh-readonly-queue/…
 *   PB  main, master, develop, release
 *   PR  everything else
 */

export type BranchClass = "PR" | "PB" | "MQ";

const MERGE_QUEUE_PREFIXES = ["trunk-merge/", "gh-readonly-queue/"];
const PROTECTED_BRANCHES = ["main", "master", "develop", "release"];

// GITHUB_HEAD_REF is the source branch on a pull_request event; GITHUB_REF_NAME
// there would be "123/merge", which nobody configures a monitor against.
export const getBranch = (): string =>
  [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME].find(
    (value) => value !== undefined && value.trim() !== "",
  ) ?? "unknown";

export const getPrNumber = (): number | undefined => {
  const match = /^refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF ?? "");
  if (match?.[1] === undefined) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const getBranchClass = (branch: string = getBranch()): BranchClass => {
  if (MERGE_QUEUE_PREFIXES.some((prefix) => branch.startsWith(prefix)))
    return "MQ";
  if (PROTECTED_BRANCHES.includes(branch)) return "PB";
  return "PR";
};
