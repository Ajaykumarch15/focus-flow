#!/usr/bin/env node
// IES-P0-21: pre-commit secret scan.
//
// Scans git-staged content (or the whole working tree with --all) for common
// credential patterns and exits non-zero if anything looks like a live secret.
// It is wired as a pre-commit hook (see scripts/hooks/pre-commit) and can also
// be run manually:
//
//   node scripts/secret-scan.js            # staged files (default)
//   node scripts/secret-scan.js --all      # all tracked files
//
// Lines that are clearly placeholders (YOUR_*, <...>, changeme, example,
// super_secret, xxxx…) are ignored, as are lines marked `secret-scan:allow`.
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const PLACEHOLDER = /\b(YOUR_[A-Z_]+|<[^>]+>|changeme|change_this|example|dummy|fake|placeholder|xxxx+|super_secret|generate_?me|lorem)/i;

// Test fixtures / obvious throwaway values should never block a commit.
const PLACEHOLDER_VALUE = /\b(test|mock|dummy|fake|sample|example|fixture|placeholder|lorem|changeme)\b|-\d+$/i;

const RULES = [
  {
    name: 'private key block',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'AWS access key id',
    re: /\b(AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[0-9A-Z]{16}\b/,
  },
  {
    name: 'AWS secret key',
    re: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/,
  },
  {
    name: 'GitHub token',
    re: /\bghp_[A-Za-z0-9]{36,}\b/,
  },
  {
    name: 'Google API key',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: 'Google OAuth client secret JSON',
    re: /"(?:client_secret|api_key|refresh_token)"\s*:\s*"[A-Za-z0-9_\-]{20,}"/,
  },
  {
    name: 'generic secret assignment',
    re: /(password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?key|auth[_-]?token|refresh[_-]?token)\s*[:=]\s*['"]?([A-Za-z0-9_\-!@#$%^&*+=]{24,})/i,
  },
];

function listFiles(mode) {
  if (mode === 'all') {
    return execSync('git ls-files', { encoding: 'utf8' })
      .split('\n').filter(Boolean);
  }
  return execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

function stagedContent(file) {
  return execSync(`git show :${file}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function scan(content) {
  const findings = [];
  const lines = String(content).split('\n');
  lines.forEach((line, index) => {
    if (line.includes('secret-scan:allow')) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        const match = rule.re.exec(line);
        const value = match && match.length > 1 ? match[2] : null;
        if (rule.name === 'generic secret assignment' && value && PLACEHOLDER_VALUE.test(value)) break;
        if (rule.name === 'generic secret assignment' && PLACEHOLDER.test(line)) break;
        findings.push({ line: index + 1, rule: rule.name, snippet: line.trim().slice(0, 120) });
        break;
      }
    }
  });
  return findings;
}

function main() {
  const mode = process.argv.includes('--all') ? 'all' : 'staged';
  const files = listFiles(mode);
  const offenders = [];
  const binaryish = /\.(png|jpe?g|gif|webp|pdf|docx?|xlsx?|zip|ico|woff2?|eot|ttf)$/i;

  for (const file of files) {
    if (binaryish.test(file)) continue;
    let content;
    try {
      content = stagedContent(file);
    } catch {
      content = ''; // deleted or binary; skip
    }
    if (!content) continue;
    const findings = scan(content);
    for (const f of findings) {
      offenders.push(`${file}:${f.line}  [${f.rule}]  ${f.snippet}`);
    }
  }

  if (offenders.length > 0) {
    console.error('✖ Secret scan failed — looks like credentials are being committed:');
    for (const o of offenders) console.error('   ' + o);
    console.error('');
    console.error('Rotate any exposed secret. Mark a deliberately fake line with `secret-scan:allow`');
    console.error('or, if this is a false positive on a placeholder, rewrite the value to look non-secret.');
    process.exit(1);
  }

  if (mode === 'staged') console.log('✔ Secret scan passed (staged files clean).');
  else console.log(`✔ Secret scan passed (${files.length} files clean).`);
}

main();
