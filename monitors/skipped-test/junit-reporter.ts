import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import type {
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

// Playwright's built-in JUnit reporter collapses retries into one testcase with no
// failure element, which makes pass-on-retry undetectable. This emits the rerun
// elements the parser reads, with repository-relative file and classname. Kept
// byte-identical between the packages that copy it — see monitors/CLAUDE.md.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
// eslint-disable-next-line no-control-regex
const ANSI_COLOUR_CODES = /\u001b\[[0-9;]*m/g;

export default class AttemptPreservingJUnitReporter implements Reporter {
  private suite: Suite | undefined;

  // config.rootDir is the package directory; cwd depends on the invocation.
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

    // A <testcase> directly under <testsuites> is silently skipped by the parser.
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
    .replaceAll("]]>", "]]]]><![CDATA[>")
    .replaceAll(ANSI_COLOUR_CODES, "")
    .replaceAll(CONTROL_CHARACTERS, "");
