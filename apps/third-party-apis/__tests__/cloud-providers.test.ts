import { describe, expect, it } from "vitest";

import { readCurrentEvents } from "../src/aws";
import {
  GCP_ANY_PRODUCT,
  GEMINI_PRODUCT,
  readOpenIncidents,
} from "../src/google-cloud";

// ⚠️ Depends on three third parties. Neither cloud is on Statuspage, so neither
// reports an indicator — they publish incident feeds, and "is anything open" is
// the closest equivalent question. Different schema, same purpose, own file.
//
// These are also the tests most likely to explain the other file: when a cloud
// region goes, a dozen status pages follow it within minutes.

const TIMEOUT_MS = 25_000;

describe("cloud providers", () => {
  it(
    "google cloud has no open incident",
    async () => {
      const incidents = await readOpenIncidents(GCP_ANY_PRODUCT);

      if (!incidents.ok) {
        throw new Error(
          `third-party dependency failure: could not read Google Cloud's incident ` +
            `feed (${incidents.reason}). Check https://status.cloud.google.com.`,
        );
      }

      console.log(
        `google cloud: ${String(incidents.open.length)} open incident(s)`,
      );

      if (incidents.open.length > 0) {
        throw new Error(
          `third-party dependency failure: ${String(incidents.open.length)} open ` +
            `Google Cloud incident(s) — ` +
            `${incidents.open.map(({ product, detail }) => `${product}: ${detail}`).join("; ")}. ` +
            `Check https://status.cloud.google.com. The monitor worked.`,
        );
      }

      expect(incidents.open).toHaveLength(0);
    },
    TIMEOUT_MS,
  );

  it(
    "the vertex gemini api has no open incident",
    async () => {
      const incidents = await readOpenIncidents(GEMINI_PRODUCT);

      if (!incidents.ok) {
        throw new Error(
          `third-party dependency failure: could not read Google Cloud's incident ` +
            `feed (${incidents.reason}). Check https://status.cloud.google.com.`,
        );
      }

      console.log(
        `${GEMINI_PRODUCT}: ${String(incidents.open.length)} open incident(s)`,
      );

      if (incidents.open.length > 0) {
        throw new Error(
          `third-party dependency failure: ${String(incidents.open.length)} open ` +
            `incident(s) affecting ${GEMINI_PRODUCT} — ` +
            `${incidents.open.map(({ detail }) => detail).join("; ")}. One product ` +
            `inside a very large cloud, so this can be red while Google Cloud as a ` +
            `whole is green. The monitor worked.`,
        );
      }

      expect(incidents.open).toHaveLength(0);
    },
    TIMEOUT_MS,
  );

  it(
    "aws has no current event",
    async () => {
      const events = await readCurrentEvents();

      if (!events.ok) {
        throw new Error(
          `third-party dependency failure: could not read AWS's current events ` +
            `(${events.reason}). The feed is UTF-16 with a byte-order mark, so a ` +
            `decoding change upstream shows up here first. ` +
            `Check https://health.aws.amazon.com/health/status.`,
        );
      }

      console.log(`aws: ${String(events.current.length)} current event(s)`);

      if (events.current.length > 0) {
        throw new Error(
          `third-party dependency failure: ${String(events.current.length)} current ` +
            `AWS event(s) — ` +
            `${events.current
              .map(
                ({ service, region, summary }) =>
                  `${service}${region === "" ? "" : ` (${region})`}: ${summary}`,
              )
              .join(
                "; ",
              )}. Check https://health.aws.amazon.com/health/status. ` +
            `The monitor worked.`,
        );
      }

      expect(events.current).toHaveLength(0);
    },
    TIMEOUT_MS,
  );
});
