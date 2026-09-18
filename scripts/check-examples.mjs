#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const EXAMPLES_DIR = "examples";
const REQUIRED_SCRIPTS = ["check", "build", "test", "typecheck", "lint"];
const RANGE_PREFIX = /^[\^~]/;

const problems = [];
const found = [];

for (const name of fs.readdirSync(EXAMPLES_DIR).sort()) {
  const dir = path.join(EXAMPLES_DIR, name);
  const manifest = path.join(dir, "package.json");
  if (!fs.statSync(dir).isDirectory() || !fs.existsSync(manifest)) continue;

  found.push(name);
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const fail = (msg) => problems.push(`${name}: ${msg}`);

  for (const script of REQUIRED_SCRIPTS) {
    if (!pkg.scripts?.[script])
      fail(`missing "${script}" script in package.json`);
  }

  for (const field of ["dependencies", "devDependencies"]) {
    for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
      if (RANGE_PREFIX.test(range)) {
        fail(
          `${field}.${dep} is "${range}" — pin it exactly (see CONTRIBUTING.md)`,
        );
      }
    }
  }

  if (!fs.existsSync(path.join(dir, "package-lock.json"))) {
    fail("no package-lock.json — commit it so `npm ci` works in CI");
  }
  if (!fs.existsSync(path.join(dir, "README.md"))) {
    fail("no README.md — clicking into the example should land somewhere");
  }
}

if (found.length === 0)
  problems.push(`no examples found under ${EXAMPLES_DIR}/`);

console.log(
  `Checked ${found.length} example(s): ${found.join(", ") || "none"}`,
);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("All example conventions satisfied.");
