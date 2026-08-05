import { hourBucket, randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// A service calling a downstream one: milliseconds when downstream answers, the
// full client timeout when it does not. So failures pin near the ceiling while
// passes are unaffected — bimodal, split by outcome. Nothing is really called; the
// names carry the story and the elapsed time is real. See README.md.

const DOWNSTREAM_UP_RATE = 80;
const HEALTHY_RESPONSE_MS = 150;
const CLIENT_TIMEOUT_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const clientTimeoutMs = (bucket: string): number =>
  Math.round(
    CLIENT_TIMEOUT_MS *
      (0.97 + (randomPercentage("client-timeout-jitter", bucket) * 0.06) / 100),
  );

async function callDownstream(bucket: string): Promise<string> {
  const downstreamIsUp =
    randomPercentage("downstream", bucket) < DOWNSTREAM_UP_RATE;

  if (downstreamIsUp) {
    await sleep(HEALTHY_RESPONSE_MS);
    return "200 OK";
  }

  const timeout = clientTimeoutMs(bucket);
  await sleep(timeout);
  throw new Error(
    `downstream did not answer; gave up after ${String(timeout)}ms — the demo working`,
  );
}

describe("timeout-inflation", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it(
    "blocks on a timeout only when it fails",
    async () => {
      expect(await callDownstream(hourBucket())).toBe("200 OK");
    },
    // Above the client timeout, or vitest pins the duration at its own limit.
    CLIENT_TIMEOUT_MS + 10_000,
  );

  // Rejects before it would call downstream: same rate, no wait.
  it("fails fast when it fails", () => {
    const requestIsValid =
      randomPercentage("request-validation", hourBucket()) < DOWNSTREAM_UP_RATE;

    expect(
      requestIsValid,
      `rejected before calling downstream, at the same ${String(100 - DOWNSTREAM_UP_RATE)}% ` +
        `rate but in a millisecond — the demo working`,
    ).toBe(true);
  });
});
