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
 * Playwright's built-in one collapses retries: a test that failed twice and then
 * passed becomes a single `<testcase>` with no failure element, the earlier
 * attempts surviving only as prose in a `<system-out>` CDATA block. Verified
 * against @playwright/test 1.62. Pass-on-retry is undetectable from that — if the
 * failing attempts are not in the XML as runs, there is nothing to pair.
 *
 * | Situation                         | Emitted                                   |
 * | --------------------------------- | ----------------------------------------- |
 * | Failed some attempts, then passed | `<flakyFailure>` per failed attempt       |
 * | Failed every attempt              | `<rerunFailure>` each, plus a `<failure>` |
 * | Skipped, or never started         | `<skipped/>`                              |
 * | Passed first time                 | a bare `<testcase>`                       |
 *
 * `file` and `classname` are repository-relative, because both feed test identity
 * and a package-relative path collides across packages and matches nothing in
 * CODEOWNERS.
 *
 * Deliberately duplicated per package rather than shared — see monitors/CLAUDE.md.
 */

// XML 1.0 forbids most control characters, and playwright's snippets carry them
// inside ANSI colour codes. Written as escapes so this file stays greppable.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
// eslint-disable-next-line no-control-regex
const ANSI_COLOUR_CODES = /\u001b\[[0-9;]*m/g;

export default class AttemptPreservingJUnitReporter implements Reporter {
  private suite: Suite | undefined;

  /**
   * Derived from this file's own location. Not `config.rootDir`, which playwright
   * derives from `testDir` and is therefore the package directory, and not
   * `process.cwd()`, which depends on where the runner was invoked.
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

    // One <testsuite> per spec file. The nesting is not optional: a <testcase>
    // directly under <testsuites> is silently skipped by the parser, which then
    // validates clean and reports zero test cases.
    const byFile = new Map<string, TestCase[]>();
    for (const test of tests) {
      const file = relative(this.repoRoot, test.location.file);
      byFile.set(file, [...(byFile.get(file) ?? []), test]);
    }

    const suiteName = dirname(this.outputFile).replace(
      /[\\/]test-results$/,
      "",
    );
    const finishedAt = new Date().toISOString();
    const totals = countOutcomes(tests);

    const body = [...byFile].map(([file, fileTests]) => {
      const fileTotals = countOutcomes(fileTests);
      return [
        `  <testsuite name="${escapeAttribute(file)}" ` +
          `tests="${String(fileTests.length)}" failures="${String(fileTotals.failures)}" ` +
          `errors="0" skipped="${String(fileTotals.skipped)}" ` +
          `time="${seconds(elapsedMs(fileTests))}" timestamp="${finishedAt}">`,
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
    console.log(`JUnit report written to ${destination}`);
  }

  private renderCase(test: TestCase, file: string): string {
    const final = lastResult(test);
    const earlier = test.results.slice(0, -1);

    const open =
      `    <testcase name="${escapeAttribute(test.title)}" ` +
      `classname="${escapeAttribute(file)}" file="${escapeAttribute(file)}" ` +
      `time="${seconds(final?.duration ?? 0)}">`;

    const children: string[] = [];

    if (final === undefined || final.status === "skipped") {
      children.push("      <skipped/>");
    } else if (final.status !== "passed") {
      // Earlier attempts are reruns rather than flaky failures, which is what
      // preserves "retried and still red is not a pair".
      for (const attempt of earlier) {
        children.push(renderAttempt("rerunFailure", attempt));
      }
      children.push(renderAttempt("failure", final));
    } else {
      for (const attempt of earlier) {
        children.push(renderAttempt("flakyFailure", attempt));
      }
    }

    if (children.length === 0) return `${open}</testcase>`;
    return [open, ...children, "    </testcase>"].join("\n");
  }
}

const lastResult = (test: TestCase): TestResult | undefined =>
  test.results.at(-1);

function countOutcomes(tests: TestCase[]): {
  failures: number;
  skipped: number;
} {
  let failures = 0;
  let skipped = 0;
  for (const test of tests) {
    const final = lastResult(test);
    if (final === undefined || final.status === "skipped") skipped++;
    else if (final.status !== "passed") failures++;
  }
  return { failures, skipped };
}

const elapsedMs = (tests: TestCase[]): number =>
  tests.reduce(
    (total, test) =>
      total + test.results.reduce((sum, result) => sum + result.duration, 0),
    0,
  );

/** JUnit durations are seconds with millisecond precision. */
const seconds = (milliseconds: number): string =>
  (milliseconds / 1000).toFixed(3);

function renderAttempt(tag: string, result: TestResult): string {
  const message = result.error?.message ?? `attempt ended as ${result.status}`;
  const detail = [result.error?.stack, result.error?.snippet]
    .filter((part): part is string => typeof part === "string")
    .join("\n\n");

  const attributes =
    `message="${escapeAttribute(firstLine(message))}" type="Error" ` +
    `time="${seconds(result.duration)}"`;

  if (detail === "") return `      <${tag} ${attributes}/>`;
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
    .replaceAll(CONTROL_CHARACTERS, "");

const escapeCdata = (value: string): string =>
  value
    // A CDATA section cannot contain its own terminator, so it is split in two.
    .replaceAll("]]>", "]]]]><![CDATA[>")
    .replaceAll(ANSI_COLOUR_CODES, "")
    .replaceAll(CONTROL_CHARACTERS, "");
