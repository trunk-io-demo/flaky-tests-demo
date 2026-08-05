/**
 * Helpers shared by the monitor stories.
 *
 * Two groups: what CI says about *where* a run came from, and what makes an
 * outcome vary in a way that is still reproducible.
 */

export {
  getBranch,
  getBranchClass,
  getPrNumber,
  protectedBranches,
  type BranchClass,
} from "./ci";

export { getDate, getDay, getEpochDay, isEveryOtherDay, MONDAY } from "./when";

export {
  hourBucket,
  intFromEnv,
  randomPercentage,
  ratePercent,
  seededRandom,
  stableHash,
} from "./random";
