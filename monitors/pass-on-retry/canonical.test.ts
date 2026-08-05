import { describe, expect, it } from "vitest";

/**
 * The story here is the playwright ladder in retry-ladder.spec.ts. This file
 * exists for the healthcheck, and it is in vitest deliberately: the spec runs
 * with retries configured, and a healthcheck that could be retried would report
 * green after failing twice — the exact ambiguity it exists to remove.
 */
describe("pass-on-retry", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });
});
