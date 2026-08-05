import { request, type Probe } from "./probe";

export const GITHUB_URL = "https://github.com";
export const LATEST_UPLOADER_URL =
  "https://github.com/trunk-io/analytics-cli/releases/latest/download/trunk-analytics-cli-x86_64-unknown-linux.tar.gz";

export const reaches = async (url: string): Promise<Probe<number>> => {
  const probed = await request(url, { method: "GET" });
  if (!probed.ok) return probed;
  if (!probed.value.ok) {
    return { ok: false, reason: `HTTP ${String(probed.value.status)}` };
  }
  return { ok: true, value: probed.value.status };
};

// Reading the body matters: a release URL redirects to object storage, and only
// a completed download proves the asset is actually retrievable.
export const downloads = async (url: string): Promise<Probe<number>> => {
  const probed = await request(url, { method: "GET" }, 30_000);
  if (!probed.ok) return probed;
  if (!probed.value.ok) {
    return { ok: false, reason: `HTTP ${String(probed.value.status)}` };
  }
  const bytes = (await probed.value.arrayBuffer()).byteLength;
  return bytes > 0
    ? { ok: true, value: bytes }
    : { ok: false, reason: "the asset downloaded as zero bytes" };
};
