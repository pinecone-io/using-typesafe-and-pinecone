import "../lib/env";
import { compare } from "../lib/compare";
import { PRESETS, LOW_CONFIDENCE_THRESHOLD, ftsFromCriteria } from "../lib/presets";
import { formatCost } from "../lib/pricing";
import type { ComparisonResult, Query } from "../lib/types";

function pad(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n);
}

function report(label: string, r: ComparisonResult): void {
  console.log(`\n${"═".repeat(94)}`);
  console.log(label);
  console.log(`  FTS      ${r.query.fts}`);
  console.log(`  criteria ${r.query.criteria}`);
  console.log(`${"═".repeat(94)}`);
  console.log(`  ${r.candidateCount} candidates retrieved in ${r.retrievalMs} ms`);

  const ts = r.typesafe;
  const cl = r.claude;
  console.log(
    `  TypeSafe ${ts.unavailable ?? `${ts.ms} ms · ${formatCost(ts.costUsd)} · ${ts.inputTokens} in`}`,
  );
  console.log(
    `  Claude   ${cl.unavailable ?? `${cl.ms} ms · ${formatCost(cl.costUsd)} · ${cl.inputTokens} in / ${cl.outputTokens} out`}`,
  );

  const top = ts.ranked[0];
  if (top && top.score < LOW_CONFIDENCE_THRESHOLD) {
    console.log(`\n  ⚠ No strong matches (top score ${top.score.toFixed(2)}).`);
  }

  console.log(`\n  ${pad("#", 3)}${pad("BM25 (lexical)", 30)}${pad("TypeSafe", 34)}Claude`);
  console.log(`  ${"─".repeat(90)}`);
  for (let i = 0; i < 10; i++) {
    const bm = r.candidates[i];
    const t = ts.ranked[i];
    const c = cl.ranked[i];
    console.log(
      `  ${pad(String(i + 1), 3)}${pad(bm?.name ?? "—", 30)}${pad(
        t ? `${t.name} (${t.score.toFixed(2)})` : "—",
        34,
      )}${c?.name ?? "—"}`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const criteriaArg = args.filter((a) => !a.startsWith("--")).join(" ");

  let queries: { label: string; query: Query }[];

  if (criteriaArg) {
    queries = [
      {
        label: "CUSTOM",
        query: { fts: ftsFromCriteria(criteriaArg), criteria: criteriaArg },
      },
    ];
  } else {
    const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
    queries = PRESETS.filter((p) => !only || p.id === only).map((p) => ({
      label: `${p.group.toUpperCase()} · ${p.label}`,
      query: { fts: p.fts, criteria: p.criteria },
    }));
  }

  for (const { label, query } of queries) {
    report(label, await compare(query));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
