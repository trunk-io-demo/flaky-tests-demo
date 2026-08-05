import { describe, expect, it } from "vitest";

// Reads no clock and no balance, so it stays green through every closure. It is
// the fastest way to tell "the street is shut today" from "the suite is broken".

describe("parking-meter", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });
});
