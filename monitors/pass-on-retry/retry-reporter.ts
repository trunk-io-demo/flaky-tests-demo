import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import type {
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

/**
 * A JUnit reporter that keeps every attempt.
 *
 * ## Why this exists
 *
 * Playwright's built-in JUnit reporter **collapses retries**. A test that failed
 * twice and then passed is reported as one `<testcase>` with no failure element
 * at all — the earlier attempts survive only as prose inside a `<system-out>`
 * CDATA block. Verified against `@playwright/test` 1.62.
 *
 * That makes pass-on-retry undetectable from its output. A pass-on-retry pair is
 * a passing run and a failing run for the same commit, and if the failing runs
 * are not in the XML as *runs*, there is nothing to pair.
 *
 * The JUnit dialect the parser reads does have elements for exactly this, so the
 * fix is to emit them:
 *
 * | Situation                                    | Elements emitted                              |
 * | -------------------------------------------- | --------------------------------------------- |
 * | Failed some attempts, then passed            | `<flakyFailure>` per failed attempt           |
 * | Failed every attempt                         | `<rerunFailure>` per earlier attempt, plus a final `<failure>` |
 * | Passed first time                            | nothing — a bare `<testcase>`                 |
 *
 * Those get expanded into separate run rows, so a **single upload** contains both
 * halves of every pair. That is what lets the whole story complete inside one
 * run, which it has to: pairs are only formed from runs within a trailing window
 * of a few hours.
 *
 * ## Identity
 *
 * `file` and `classname` are written repository-relative for the same reason the
 * vitest configs set `root` to the repository: identity is derived from
 * repository, file, classname, suite, name, and variant, and a package-relative
 * path both collides with other packages and matches nothing in CODEOWNERS.
 */
/**
 * XML 1.0 forbids most control characters outright, and playwright's snippets
 * carry them inside ANSI colour codes. Written as escapes rather than as literal
 * bytes so this file stays greppable.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
// eslint-disable-next-line no-control-regex
const ANSI_COLOUR_CODES = /\u001b\[[0-9;]*m/g;

export default class RetryPreservingJUnitReporter implements Reporter {
  private suite: Suite | undefined;

  /**
   * The repository root, derived from this file's own location.
   *
   * Not from `config.rootDir` — playwright derives that from `testDir`, so it is
   * the *package* directory here — and not from `process.cwd()`, which depends on
   * where the runner was invoked from. This file's position in the tree is the
   * one fact that does not move.
   */
  private readonly repoRoot = resolve(import.meta.dirname, "../..");
  private readonly outputFile: string;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? "test-results/playwright.junit.xml";
  }

  onBegin(_config: unknown, suite: Suite): void {
    this.suite = suite;
  }

  onEnd(): void {
    const tests = this.suite?.allTests() ?? [];

    // One <testsuite> per spec file, inside a single <testsuites>.
    //
    // The nesting is not optional. A <testcase> placed directly under
    // <testsuites> is silently skipped by the parser — the report validates
    // clean and reports zero test cases, which is the worst possible failure
    // mode because nothing looks wrong.
    const byFile = new Map<string, TestCase[]>();
    for (const test of tests) {
      const file = relative(this.repoRoot, test.location.file);
      byFile.set(file, [...(byFile.get(file) ?? []), test]);
    }

    const suiteName = dirname(this.outputFile).replace(
      /[\\/]test-results$/,
      "",
    );
    const finishedAt = new Date();
    const totals = countOutcomes(tests);

    const body = [...byFile].map(([file, fileTests]) => {
      const fileTotals = countOutcomes(fileTests);
      return [
        `  <testsuite name="${escapeAttribute(file)}" ` +
          `tests="${String(fileTests.length)}" failures="${String(fileTotals.failures)}" ` +
          `errors="0" skipped="${String(fileTotals.skipped)}" ` +
          `time="${seconds(elapsedMs(fileTests))}" ` +
          // The parser warns on reports older than an hour and on cases stamped
          // in the future, so the run is stamped where it actually happened.
          `timestamp="${finishedAt.toISOString()}">`,
        ...fileTests.map((test) => this.renderCase(test, file)),
        "  </testsuite>",
      ].join("\n");
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites name="${escapeAttribute(suiteName)}" ` +
        `tests="${String(tests.length)}" failures="${String(totals.failures)}" ` +
        `errors="0" skipped="${String(totals.skipped)}" ` +
        `time="${seconds(elapsedMs(tests))}">`,
      ...body,
      "</testsuites>",
      "",
    ].join("\n");

    const destination = resolve(this.repoRoot, this.outputFile);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, xml, "utf8");
    console.log(`retry-preserving JUnit report written to ${destination}`);
  }

  private renderCase(test: TestCase, file: string): string {
    const attempts = test.results;
    const final = lastResult(test);
    const earlier = attempts.slice(0, -1);

    const open =
      `    <testcase name="${escapeAttribute(test.title)}" ` +
      `classname="${escapeAttribute(file)}" file="${escapeAttribute(file)}" ` +
      `time="${seconds(final?.duration ?? 0)}">`;

    const children: string[] = [];

    if (final?.status === "skipped") {
      children.push("      <skipped/>");
    } else if (final !== undefined && final.status !== "passed") {
      // Failed every attempt. Retried and still red is *not* a pass-on-retry
      // pair, and emitting the earlier attempts as reruns rather than as flaky
      // failures is what preserves that distinction.
      for (const attempt of earlier) {
        children.push(renderAttempt("rerunFailure", attempt));
      }
      children.push(renderAttempt("failure", final));
    } else {
      // Passed in the end. Each earlier attempt is a flaky failure, which is the
      // half of the pair the monitor needs.
      for (const attempt of earlier) {
        children.push(renderAttempt("flakyFailure", attempt));
      }
    }

    if (children.length === 0) {
      return `${open}</testcase>`;
    }
    return [open, ...children, "    </testcase>"].join("\n");
  }
}

const lastResult = (test: TestCase): TestResult | undefined =>
  test.results.at(-1);

/** Failure and skip counts, for the suite-level attributes. */
function countOutcomes(tests: TestCase[]): {
  failures: number;
  skipped: number;
} {
  let failures = 0;
  let skipped = 0;
  for (const test of tests) {
    const final = lastResult(test);
    if (final === undefined) continue;
    if (final.status === "skipped") skipped++;
    else if (final.status !== "passed") failures++;
  }
  return { failures, skipped };
}

/** Wall time across every attempt of every test. */
const elapsedMs = (tests: TestCase[]): number =>
  tests.reduce(
    (total, test) =>
      total + test.results.reduce((sum, result) => sum + result.duration, 0),
    0,
  );

/** JUnit durations are seconds with millisecond precision. */
function seconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(3);
}

function renderAttempt(tag: string, result: TestResult): string {
  const message = result.error?.message ?? `attempt ended as ${result.status}`;
  const detail = [result.error?.stack, result.error?.snippet]
    .filter((part): part is string => typeof part === "string")
    .join("\n\n");

  const attributes =
    `message="${escapeAttribute(firstLine(message))}" type="Error" ` +
    `time="${seconds(result.duration)}"`;

  if (detail === "") {
    return `      <${tag} ${attributes}/>`;
  }
  return `      <${tag} ${attributes}><![CDATA[${escapeCdata(detail)}]]></${tag}>`;
}

/** Attribute values must be one line; the full text goes in the CDATA body. */
const firstLine = (text: string): string =>
  text.split("\n", 1)[0]?.slice(0, 500) ?? "";

const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    // Control characters are not legal in XML 1.0 at all, and stack traces
    // routinely carry them inside ANSI escape sequences.
    .replaceAll(CONTROL_CHARACTERS, "");

const escapeCdata = (value: string): string =>
  value
    // A CDATA section cannot contain its own terminator, so it is split in two.
    .replaceAll("]]>", "]]]]><![CDATA[>")
    .replaceAll(ANSI_COLOUR_CODES, "")
    .replaceAll(CONTROL_CHARACTERS, "");
