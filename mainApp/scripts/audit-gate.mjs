// IES-P0-38 · audit gate for CI.
//
// Fails when `npm audit` reports high/critical findings, EXCEPT the documented
// false positive below. Kept as a separate script so the CI gate is explicit.
//
// GHSA-qwww-vcr4-c8h2 (react-router RSC-mode CSRF, high):
//   Affects only the unstable RSC APIs, which this SPA does not use. The fix was
//   backported to react-router 7.18.2 (PR #15353); our lockfile already installs
//   7.18.2, but npm's advisory range (>=7.12.0, <8.3.0) is stale pending
//   advisory-database PR #8868. Allow it, all other high/critical findings block.
import { execSync } from 'node:child_process';

const ALLOWED = new Set(['GHSA-qwww-vcr4-c8h2']);

let report;
try {
  report = JSON.parse(execSync('npm audit --json', { encoding: 'utf8' }));
} catch (e) {
  // npm audit exits non-zero whenever any finding exists (even allowed ones).
  report = JSON.parse(e.stdout);
}

// Numeric advisory ids in `via` resolve through the top-level `advisories` map;
// direct objects also carry `source` / `url`. `via` entries that are plain
// strings are transitive package names, resolved recursively below.
const ghsaOf = (v) => {
  if (typeof v === 'string') return null;
  const url = v.url || '';
  return url.match(/GHSA-[a-z0-9-]+/i)?.[0] || null;
};

function collectAdvisories(info, seen = new Set()) {
  const out = new Set();
  for (const v of info.via || []) {
    if (typeof v === 'string') {
      if (seen.has(v)) continue;
      seen.add(v);
      const dep = report.vulnerabilities[v];
      if (dep) {
        for (const gh of collectAdvisories(dep, seen)) out.add(gh);
      }
    } else {
      const gh = ghsaOf(v);
      if (gh) out.add(gh);
    }
  }
  return out;
}

const offending = [];
for (const [name, info] of Object.entries(report.vulnerabilities || {})) {
  if (info.severity !== 'high' && info.severity !== 'critical') continue;
  const advisories = [...collectAdvisories(info)];
  const fullyAllowed = advisories.length > 0 && advisories.every((gh) => ALLOWED.has(gh));
  if (!fullyAllowed) offending.push({ name, severity: info.severity, advisories });
}

if (offending.length > 0) {
  console.error('Audit gate failed on high/critical findings:');
  console.error(JSON.stringify(offending, null, 2));
  process.exit(1);
}

console.log('Audit gate passed (any remaining findings are documented allowed advisories).');
