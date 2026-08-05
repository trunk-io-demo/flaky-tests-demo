import * as z from "zod";

// Google Cloud is not on Statuspage, so it needs its own reader: an array of
// incidents where a null `end` means still open. `looseObject` because the feed
// carries far more per incident than this needs, and dropping the rest is fine.

const INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";
const USER_AGENT =
  "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)";
const TIMEOUT_MS = 10_000;

export const GEMINI_PRODUCT = "Vertex Gemini API";
export const GCP_ANY_PRODUCT = "*";

const IncidentsResponse = z.array(
  z.looseObject({
    end: z.string().nullish(),
    external_desc: z.string().catch("no description"),
    service_name: z.string().catch(""),
    affected_products: z
      .array(z.looseObject({ title: z.string().catch("") }))
      .catch([]),
  }),
);

export type OpenIncident = {
  readonly product: string;
  readonly detail: string;
};

export type Incidents =
  | { readonly ok: true; readonly open: readonly OpenIncident[] }
  | { readonly ok: false; readonly reason: string };

/** `GCP_ANY_PRODUCT` matches every open incident, whichever product it names. */
export const readOpenIncidents = async (
  product: string,
): Promise<Incidents> => {
  try {
    const response = await fetch(INCIDENTS_URL, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${String(response.status)}` };
    }

    const parsed = IncidentsResponse.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        reason: `unexpected response shape: ${z.prettifyError(parsed.error).split("\n")[0] ?? "unknown"}`,
      };
    }

    const open = parsed.data
      .filter((incident) => incident.end == null)
      .filter(
        (incident) =>
          product === GCP_ANY_PRODUCT || productsOf(incident).includes(product),
      )
      .map((incident) => ({
        product:
          product === GCP_ANY_PRODUCT
            ? (productsOf(incident)[0] ?? "Google Cloud")
            : product,
        detail: incident.external_desc,
      }));

    return { ok: true, open };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

type Incident = z.infer<typeof IncidentsResponse>[number];

const productsOf = (incident: Incident): string[] =>
  [
    incident.service_name,
    ...incident.affected_products.map(({ title }) => title),
  ].filter((name) => name !== "");
