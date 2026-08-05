export type Os = "windows" | "linux" | "macos";

const RUNNER_OS: Record<string, Os> = {
  Windows: "windows",
  Linux: "linux",
  macOS: "macos",
};

const PLATFORM: Partial<Record<NodeJS.Platform, Os>> = {
  win32: "windows",
  linux: "linux",
  darwin: "macos",
};

// RUNNER_OS first, because it is what the runner says it is; process.platform is
// the local fallback. Other unixes report as linux, which never happens on a
// GitHub runner and is closer than the alternatives.
//
// Unused so far. It exists for a variant story — the OS is part of test identity,
// so the same test on three runners is three tests.
export const getOs = (): Os =>
  RUNNER_OS[process.env.RUNNER_OS ?? ""] ??
  PLATFORM[process.platform] ??
  "linux";
