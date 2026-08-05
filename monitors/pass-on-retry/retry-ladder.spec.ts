import { expect, test } from "@playwright/test";

// A test that failed and then passed on the same commit is the least deniable
// flakiness signal there is: failing on one commit and passing on the next has an
// ordinary explanation, doing both on the same code has none.
//
// This half of the story pairs within a single upload — playwright retries the
// test and `includeRetries` puts every attempt in the report as its own run. The
// other half, pairing across uploads, is in canonical.test.ts.

const LADDER = [
  { name: "passes on the second attempt", attemptsNeeded: 2 },
  { name: "passes on the third attempt", attemptsNeeded: 3 },
  { name: "passes on the fourth attempt", attemptsNeeded: 4 },
] as const;

test("passes on the first attempt", () => {
  expect(1).toBe(1);
});

for (const { name, attemptsNeeded } of LADDER) {
  // The empty destructuring pattern is mandatory; without it, zero tests are found.
  // eslint-disable-next-line no-empty-pattern
  test(name, ({}, testInfo) => {
    const attempt = testInfo.retry + 1;

    expect(
      attempt,
      `fails until attempt ${String(attemptsNeeded)}, pairing the failures with the ` +
        `eventual success on one commit — the demo working`,
    ).toBe(attemptsNeeded);
  });
}

test("never passes however many times it is retried", () => {
  expect(
    "retried and still failing",
    "not a pass-on-retry pair, which is the boundary this test draws — the demo working",
  ).toBe("passing");
});
