import { describe, expect, it } from "vitest";

/**
 * The story in this package is the playwright ladder in `retry-ladder.spec.ts`.
 * This file exists for the healthcheck, which every monitor package has: several
 * monitors resolve when a test stops reporting, so a test that always passes is
 * what separates "the monitor resolved" from "the suite stopped running."
 *
 * It is deliberately in vitest rather than in the playwright spec. The spec runs
 * with three retries configured, and a healthcheck that could be retried is not
 * a healthcheck — it would report green after failing twice, which is the exact
 * ambiguity it exists to remove.
 */
describe("pass-on-retry", () => {
  it("healthcheck_always_passes", () => {
    expect(new Date().toISOString()).toMatch(/^\d{4}-/);
  });
});
