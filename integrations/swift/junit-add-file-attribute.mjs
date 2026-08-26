#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

// Swift Testing writes classname but no file attribute, and the uploader needs
// file to correlate a test with its code owner. Playwright's copy-the-classname
// trick does not work here: Swift's classname is "Module.TypeName", not a path.
// So resolve the type name against the declarations in Tests/ instead.
//
// Paths come out relative to the repository root, which is what the uploader
// wants and what keeps a test's identity stable no matter where this is run.
//
// It also stamps a timestamp, which Swift Testing omits entirely and the
// uploader warns about. The report's mtime is when the run finished, so the
// suite's own duration is subtracted to approximate when it started.

const TESTCASE = /<testcase\b[^>]*>/g;
const CLASSNAME = /\bclassname="([^"]*)"/;
const TESTSUITE = /<testsuite\b[^>]*>/g;
const SUITE_TIME = /\btime="([^"]*)"/;
// Deliberately not anchored to the start of a line: a suite type is usually
// declared after its attribute, as in `@Suite("name") struct Thing {`.
const DECLARATION =
  /(?:^|[\s)])(?:struct|class|enum|actor)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

const repoRoot = (from) => {
  let dir = resolve(from);
  for (;;) {
    try {
      if (statSync(join(dir, ".git"))) return dir;
    } catch {
      /* keep walking */
    }
    const parent = dirname(dir);
    if (parent === dir) return resolve(from);
    dir = parent;
  }
};

const swiftFiles = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...swiftFiles(path));
    else if (entry.name.endsWith(".swift")) found.push(path);
  }
  return found;
};

// TypeName -> repo-relative path. A name declared in two files is ambiguous, so
// drop it rather than attribute a test to whichever file was walked first.
const declarationIndex = (dir, root) => {
  const index = new Map();
  const ambiguous = new Set();
  for (const path of swiftFiles(dir)) {
    const relativePath = relative(root, path).split(sep).join("/");
    const source = readFileSync(path, "utf8");
    for (const [, name] of source.matchAll(DECLARATION)) {
      if (index.has(name) && index.get(name) !== relativePath)
        ambiguous.add(name);
      index.set(name, relativePath);
    }
  }
  for (const name of ambiguous) index.delete(name);
  return index;
};

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: junit-add-file-attribute <report.xml>...");
  process.exit(2);
}

const root = repoRoot(process.cwd());
const index = declarationIndex(resolve("Tests"), root);
const unresolved = new Set();

for (const path of paths) {
  let xml;
  try {
    xml = readFileSync(path, "utf8");
  } catch {
    console.log(`junit-add-file-attribute: ${path} not found, skipping`);
    continue;
  }

  const finishedAt = statSync(path).mtime.getTime();

  const withFiles = xml.replace(TESTCASE, (tag) => {
    if (/\bfile="/.test(tag)) return tag;
    const classname = CLASSNAME.exec(tag)?.[1];
    if (!classname) return tag;
    const file = index.get(classname.split(".").at(-1));
    if (file === undefined) {
      unresolved.add(classname);
      return tag;
    }
    return tag.replace(CLASSNAME, (matched) => `${matched} file="${file}"`);
  });

  const patched = withFiles.replace(TESTSUITE, (tag) => {
    if (/\btimestamp="/.test(tag)) return tag;
    const seconds = Number.parseFloat(SUITE_TIME.exec(tag)?.[1] ?? "0");
    const startedAt = new Date(
      finishedAt - (Number.isFinite(seconds) ? seconds : 0) * 1000,
    );
    return tag.replace(
      /^<testsuite\b/,
      `<testsuite timestamp="${startedAt.toISOString()}"`,
    );
  });

  if (patched === xml) {
    console.log(`junit-add-file-attribute: ${path} unchanged`);
    continue;
  }

  writeFileSync(path, patched, "utf8");
  const added = (patched.match(/\bfile="/g) ?? []).length;
  const stamped = (patched.match(/<testsuite\b[^>]*\btimestamp="/g) ?? [])
    .length;
  console.log(
    `junit-add-file-attribute: ${path} — ${added} file attributes, ${stamped} suite timestamps`,
  );
}

// Loud, because a test uploaded without `file` silently loses its code owner.
if (unresolved.size > 0) {
  console.error(
    `junit-add-file-attribute: no source file found for ${[...unresolved].join(", ")}`,
  );
  process.exit(1);
}
