import * as z from "zod";

import { json, type Probe } from "./probe";

const STATUS_URL = "https://www.githubstatus.com/api/v2/status.json";
const INCIDENTS_URL = "https://www.githubstatus.com/api/v2/incidents.json";

const INDICATORS = ["none", "minor", "major", "critical"] as const;

// An unrecognised indicator becomes `none`, and a missing field takes a default,
// so a new severity word upstream does not read as an incident here.
const StatusResponse = z.object({
  status: z.object({
    indicator: z.enum(INDICATORS).catch("none"),
    description: z.string().catch("unknown"),
  }),
});

const IncidentsResponse = z.object({
  incidents: z
    .array(
      z.looseObject({
        name: z.string().catch("unnamed"),
        impact: z.string().catch("unknown"),
        created_at: z.string().catch("unknown"),
        resolved_at: z.string().nullish(),
      }),
    )
    .catch([]),
});

export type Indicator = (typeof INDICATORS)[number];

export type Status = {
  readonly indicator: Indicator;
  readonly description: string;
};

export type Incident = {
  readonly name: string;
  readonly impact: string;
  readonly startedAt: string;
  readonly resolvedAt: string | null;
};

export const fetchStatus = async (): Promise<Probe<Status>> => {
  const probed = await json(STATUS_URL, StatusResponse);
  if (!probed.ok) return probed;

  const { indicator, description } = probed.value.status;
  return { ok: true, value: { indicator, description } };
};

export const fetchIncidents = async (): Promise<Probe<readonly Incident[]>> => {
  const probed = await json(INCIDENTS_URL, IncidentsResponse);
  if (!probed.ok) return probed;

  return {
    ok: true,
    value: probed.value.incidents.map((incident) => ({
      name: incident.name,
      impact: incident.impact,
      startedAt: incident.created_at,
      resolvedAt: incident.resolved_at ?? null,
    })),
  };
};

// An incident overlaps a window if it began inside it, or has not resolved.
export const overlaps = (incident: Incident, sinceIso: string): boolean =>
  incident.resolvedAt === null ||
  incident.startedAt >= sinceIso ||
  incident.resolvedAt >= sinceIso;

const SEVERITY: Record<Indicator, number> = {
  none: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

export const isAtLeast = (
  indicator: Indicator,
  threshold: Indicator,
): boolean =>
  SEVERITY[threshold] > 0 && SEVERITY[indicator] >= SEVERITY[threshold];
