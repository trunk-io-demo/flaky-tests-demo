#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

// Playwright's built-in JUnit reporter writes classname but no file attribute,
// and the uploader needs file to correlate a test with its code owner. With
// testDir at the repository root the classname already *is* the repo-relative
// path, so copying it across is all that is needed.
//
// Runs after `playwright test`, which is why it tolerates a missing report: a
// collection error means the reporter wrote nothing, and that is not this
// script's problem to report.

const TESTCASE = /<testcase\b[^>]*>/g;
const CLASSNAME = /\bclassname="([^"]*)"/;

const addFileAttribute = (xml) =>
  xml.replace(TESTCASE, (tag) => {
    if (/\bfile="/.test(tag)) return tag;
    const classname = CLASSNAME.exec(tag)?.[1];
    if (classname === undefined || classname === "") return tag;
    return tag.replace(
      CLASSNAME,
      (matched) => `${matched} file="${classname}"`,
    );
  });

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: junit-add-file-attribute <report.xml>...");
  process.exit(2);
}

for (const path of paths) {
  let xml;
  try {
    xml = readFileSync(path, "utf8");
  } catch {
    console.log(`junit-add-file-attribute: ${path} not found, skipping`);
    continue;
  }

  const patched = addFileAttribute(xml);
  if (patched === xml) {
    console.log(
      `junit-add-file-attribute: ${path} already had file attributes`,
    );
    continue;
  }

  writeFileSync(path, patched, "utf8");
  const added = (patched.match(/\bfile="/g) ?? []).length;
  console.log(
    `junit-add-file-attribute: added ${added} file attributes to ${path}`,
  );
}
