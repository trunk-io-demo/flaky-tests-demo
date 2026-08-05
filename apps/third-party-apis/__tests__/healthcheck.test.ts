import { describe, expect, it } from "vitest";

// Reads no status page, so it stays green when every one of them is amber. Green
// healthcheck with the rest red is the internet having a bad day, not this suite.

describe("third-party-apis", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });
});
