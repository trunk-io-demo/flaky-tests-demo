// "Could not ask" is a distinct outcome from "the service answered", and both
// answer "can I depend on GitHub right now". Every probe here returns the
// difference rather than throwing, so a test can say which happened.

import * as z from "zod";

export type Probe<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: string;
      // Only `issues.ts` acts on this: it is the client that has to come back
      // with a number, so a limit it could not wait out is not a failure there.
      readonly rateLimited?: boolean;
    };

export const TIMEOUT_MS = 10_000;

export const USER_AGENT =
  "flaky-tests-demo (github.com/trunk-io-demo/flaky-tests-demo)";

export const request = async (
  url: string,
  init: RequestInit = {},
  timeoutMs: number = TIMEOUT_MS,
): Promise<Probe<Response>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set("user-agent", USER_AGENT);

    // A token lifts the search API from 10 requests a minute to 30. It is a CI
    // fact, not configuration, and absent locally.
    const token = process.env.GITHUB_TOKEN;
    if (token !== undefined && token !== "") {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
    return { ok: true, value: response };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

export const json = async <T>(
  url: string,
  schema: z.ZodType<T>,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Probe<T>> => {
  const probed = await request(
    url,
    { headers: { accept: "application/json" } },
    timeoutMs,
  );
  if (!probed.ok) return probed;

  const { value: response } = probed;
  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      reason: `rate limited (HTTP ${String(response.status)})`,
    };
  }
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${String(response.status)}` };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return {
      ok: false,
      reason: `unreadable json (${error instanceof Error ? error.message : String(error)})`,
    };
  }

  const parsed = schema.safeParse(body);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        reason: `unexpected response shape: ${z.prettifyError(parsed.error).split("\n")[0] ?? "unknown"}`,
      };
};
