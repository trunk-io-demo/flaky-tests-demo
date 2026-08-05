import * as z from "zod";

// AWS publishes current events as JSON, but encoded UTF-16 with a byte-order
// mark, so `response.json()` fails on it: the bytes have to be decoded by BOM
// first. That is the whole reason this is not just another status-page reader.

const CURRENT_EVENTS_URL = "https://status.aws.amazon.com/currentevents.json";
const USER_AGENT =
  "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)";
const TIMEOUT_MS = 15_000;

const EventsResponse = z.array(
  z.looseObject({
    service_name: z.string().catch("an AWS service"),
    region_name: z.string().catch(""),
    summary: z.string().catch("no summary"),
  }),
);

export type AwsEvent = {
  readonly service: string;
  readonly region: string;
  readonly summary: string;
};

export type AwsEvents =
  | { readonly ok: true; readonly current: readonly AwsEvent[] }
  | { readonly ok: false; readonly reason: string };

const decode = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const [first, second] = bytes;
  if (first === 0xfe && second === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  if (first === 0xff && second === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
};

export const readCurrentEvents = async (): Promise<AwsEvents> => {
  try {
    const response = await fetch(CURRENT_EVENTS_URL, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${String(response.status)}` };
    }

    const text = decode(await response.arrayBuffer());
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, reason: "the feed did not decode as json" };
    }

    const parsed = EventsResponse.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        reason: `unexpected response shape: ${z.prettifyError(parsed.error).split("\n")[0] ?? "unknown"}`,
      };
    }

    return {
      ok: true,
      current: parsed.data.map((event) => ({
        service: event.service_name,
        region: event.region_name,
        summary: event.summary,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};
