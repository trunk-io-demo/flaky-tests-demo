import { describe, expect, it } from "vitest";

// The story is the playwright ladder in retry-ladder.spec.ts. The healthcheck
// lives here, in vitest, because that spec runs with retries and a healthcheck
// that could be retried would report green after failing twice.
describe("pass-on-retry", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });
});
