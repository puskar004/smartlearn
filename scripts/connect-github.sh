#!/usr/bin/env bash
# Run this once to link GitHub → auto-deploy on every push
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1) Login to GitHub CLI..."
gh auth login --web --git-protocol https

echo "2) Create repo + push..."
gh repo create smartlearn --public --source=. --remote=origin --push

echo "3) Connect Vercel to the GitHub repo..."
REPO_URL="$(gh repo view --json url -q .url)"
vercel git connect "$REPO_URL" --yes

echo "Done. Future updates:"
echo "  git add -A && git commit -m 'update' && git push"
echo "Live: https://smartlearn-xi.vercel.app"
