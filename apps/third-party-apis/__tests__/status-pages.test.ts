import { describe, expect, it } from "vitest";

import { isOperational, readStatus, SERVICES } from "../src/status-page";

// ⚠️ Depends on fifteen third parties. Anything other than "operational" is red,
// maintenance included: a service under maintenance is one you cannot rely on
// right now, which is the question these ask.
//
// The shape here is correlation. Most of the time a handful are amber for their
// own unrelated reasons, and then a shared dependency goes — a CDN, a cloud
// region — and eight turn together in one run and recover together. No per-test
// rate models that, because the cause is outside every one of them.
//
// Read once, in parallel, before any test body runs: fifteen hosts sampled at the
// same instant is what makes "together" mean anything.

const readings = new Map(
  await Promise.all(
    SERVICES.map(
      async ({ name, host }) => [name, await readStatus(host)] as const,
    ),
  ),
);

const degraded = SERVICES.filter(({ name }) => {
  const reading = readings.get(name);
  return reading?.ok === true && !isOperational(reading.indicator);
});
console.log(
  `status pages: ${String(degraded.length)}/${String(SERVICES.length)} not operational` +
    (degraded.length > 0
      ? ` — ${degraded.map(({ name }) => name).join(", ")}`
      : ""),
);

describe("status pages", () => {
  it.each(SERVICES.map(({ name, host }) => [name, host] as const))(
    "%s is operational",
    (name, host) => {
      const reading = readings.get(name);

      if (reading === undefined || !reading.ok) {
        throw new Error(
          `third-party dependency failure: could not read ${name}'s status page ` +
            `at ${host} (${reading?.reason ?? "not read"}). A status page that ` +
            `will not answer is its own kind of bad news, but it is not the same ` +
            `as the service being down.`,
        );
      }

      const { indicator, detail } = reading;
      if (!isOperational(indicator)) {
        const note =
          indicator === "maintenance"
            ? "Maintenance counts: it is still a service you cannot rely on right now. "
            : "";
        throw new Error(
          `third-party dependency failure: ${name} reports "${indicator}" — ` +
            `${detail}. ${note}Check https://${host}. The monitor worked.`,
        );
      }

      expect(isOperational(indicator)).toBe(true);
    },
  );
});
