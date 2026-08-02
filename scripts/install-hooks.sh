#!/bin/sh
# IES-P0-21: enable the repo's pre-commit secret scan for this clone.
set -e
cd "$(dirname "$0")/.."
git config core.hooksPath scripts/hooks
echo "✔ core.hooksPath = scripts/hooks"
echo "  Pre-commit now runs: node scripts/secret-scan.js --staged"
