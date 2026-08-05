import { describe, expect, it } from "vitest";

import { now } from "@flaky-tests-demo/monitors-utils";

import {
  fetchIncidents,
  fetchStatus,
  isAtLeast,
  overlaps,
} from "../src/status-page";

// ⚠️ Depends on a third party. These fail during a real GitHub incident, on
// purpose — triage by opening https://www.githubstatus.com, the page they read.
// Every failure names its cause: the request did not complete, or GitHub said
// something. Only the second is the story.

const THRESHOLD = "major" as const;
const WINDOW_HOURS = 24;
const TIMEOUT_MS = 20_000;

describe("status page", () => {
  it(
    "github reports no incident at or above major right now",
    async () => {
      const status = await fetchStatus();

      if (!status.ok) {
        throw new Error(
          `third-party dependency failure: could not read GitHub's status page ` +
            `(${status.reason}). Check https://www.githubstatus.com and the runner's ` +
            `network. This depends on a service we do not control.`,
        );
      }

      const { indicator, description } = status.value;
      console.log(`github status: ${indicator} — ${description}`);

      if (isAtLeast(indicator, THRESHOLD)) {
        throw new Error(
          `third-party dependency failure: GitHub reports "${indicator}" — ` +
            `${description}, at or above "${THRESHOLD}". A real incident on ` +
            `somebody else's service. The monitor worked.`,
        );
      }

      expect(isAtLeast(indicator, THRESHOLD)).toBe(false);
    },
    TIMEOUT_MS,
  );

  it(
    `github opened no incident in the last ${String(WINDOW_HOURS)} hours`,
    async () => {
      const incidents = await fetchIncidents();

      if (!incidents.ok) {
        throw new Error(
          `third-party dependency failure: could not read GitHub's incident feed ` +
            `(${incidents.reason}). Check https://www.githubstatus.com/history.`,
        );
      }

      // A full timestamp, not a date: a date-only cutoff would mean "since
      // midnight yesterday", a window between 24 and 48 hours wide.
      const since = now().subtract(WINDOW_HOURS, "hour").toISOString();
      const recent = incidents.value.filter((incident) =>
        overlaps(incident, since),
      );
      console.log(
        `github incidents overlapping since ${since}: ${String(recent.length)}`,
      );

      if (recent.length > 0) {
        const named = recent
          .map(
            (incident) =>
              `"${incident.name}" (${incident.impact}, started ${incident.startedAt}` +
              `${incident.resolvedAt === null ? ", unresolved" : ""})`,
          )
          .join("; ");
        throw new Error(
          `third-party dependency failure: ${String(recent.length)} GitHub ` +
            `incident(s) since ${since}: ${named}. This looks back a full day, so ` +
            `it stays red after the status page has gone green again. The monitor ` +
            `worked.`,
        );
      }

      expect(recent).toHaveLength(0);
    },
    TIMEOUT_MS,
  );
});
