#!/usr/bin/env node
/**
 * Generates a test and coverage summary for GitHub Actions step summaries.
 * Reads coverage/coverage-summary.json and appends a markdown table to
 * GITHUB_STEP_SUMMARY. Safe to run outside GitHub Actions (no-ops).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (!summaryFile) {
  console.log('Not running in GitHub Actions — skipping summary generation.');
  process.exit(0);
}

const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

let summary = '## Test Results\n\n';

if (fs.existsSync(coveragePath)) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const t = coverage.total;

  const pct = (m) => `${m.pct.toFixed(1)}%`;
  const bar = (p) => {
    const filled = Math.round(p / 5);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
  };

  const rating = (p) => {
    if (p >= 80) return '🟢 Excellent';
    if (p >= 60) return '🟡 Good';
    return '🔴 Needs improvement';
  };

  const avgPct = (t.statements.pct + t.branches.pct + t.functions.pct + t.lines.pct) / 4;

  summary += `**Overall coverage:** ${rating(avgPct)} (${avgPct.toFixed(1)}% average)\n\n`;
  summary += '| Metric | Coverage | Visual |\n';
  summary += '|--------|----------|--------|\n';
  summary += `| Statements | ${pct(t.statements)} (${t.statements.covered}/${t.statements.total}) | \`${bar(t.statements.pct)}\` |\n`;
  summary += `| Branches   | ${pct(t.branches)} (${t.branches.covered}/${t.branches.total}) | \`${bar(t.branches.pct)}\` |\n`;
  summary += `| Functions  | ${pct(t.functions)} (${t.functions.covered}/${t.functions.total}) | \`${bar(t.functions.pct)}\` |\n`;
  summary += `| Lines      | ${pct(t.lines)} (${t.lines.covered}/${t.lines.total}) | \`${bar(t.lines.pct)}\` |\n`;
  summary += '\n';

  // Per-file breakdown (skip total)
  const files = Object.entries(coverage).filter(([k]) => k !== 'total');
  if (files.length > 0) {
    summary += '<details><summary>Per-file coverage</summary>\n\n';
    summary += '| File | Stmts | Branches | Funcs | Lines |\n';
    summary += '|------|-------|----------|-------|-------|\n';
    for (const [file, m] of files) {
      const short = file.replace(process.cwd() + '/', '');
      summary += `| \`${short}\` | ${pct(m.statements)} | ${pct(m.branches)} | ${pct(m.functions)} | ${pct(m.lines)} |\n`;
    }
    summary += '\n</details>\n\n';
  }
} else {
  summary += '> ⚠️ Coverage data not found — tests may have failed before coverage was generated.\n\n';
}

summary += `---\n*Environment: Node.js ${process.version} | Zenodo: ${process.env.ZENODO_BASE_URL || 'https://zenodo.org'}*\n`;

fs.appendFileSync(summaryFile, summary);
console.log('Test summary written to GitHub Actions step summary.');
