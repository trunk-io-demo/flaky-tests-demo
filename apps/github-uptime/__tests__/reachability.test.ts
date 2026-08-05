import { describe, expect, it } from "vitest";

import {
  downloads,
  GITHUB_URL,
  LATEST_UPLOADER_URL,
  reaches,
} from "../src/reachability";

// ⚠️ Depends on a third party. These are the crudest checks here and the ones
// that separate "GitHub has a problem" from "this runner has a problem": if
// github.com is unreachable, nothing else in this package means anything.

const REACH_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 45_000;

describe("reachability", () => {
  it(
    "github.com answers",
    async () => {
      const reached = await reaches(GITHUB_URL);

      if (!reached.ok) {
        throw new Error(
          `third-party dependency failure: could not reach ${GITHUB_URL} ` +
            `(${reached.reason}). Everything else in this package depends on this, ` +
            `so a failure here explains the rest of the file.`,
        );
      }

      console.log(`${GITHUB_URL}: HTTP ${String(reached.value)}`);
      expect(reached.value).toBe(200);
    },
    REACH_TIMEOUT_MS,
  );

  it(
    "the latest analytics-cli release downloads",
    async () => {
      const downloaded = await downloads(LATEST_UPLOADER_URL);

      if (!downloaded.ok) {
        throw new Error(
          `third-party dependency failure: could not download the latest uploader ` +
            `(${downloaded.reason}). This is the binary every folder here uploads ` +
            `with, so CI cannot upload anything while this is red.`,
        );
      }

      console.log(
        `latest analytics-cli: ${String(downloaded.value)} bytes downloaded`,
      );
      expect(downloaded.value).toBeGreaterThan(0);
    },
    DOWNLOAD_TIMEOUT_MS,
  );
});
