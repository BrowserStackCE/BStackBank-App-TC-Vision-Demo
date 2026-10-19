#!/usr/bin/env bash
# Usage: ./scripts/make-pr.sh "your commit message"
# Commits your current changes to branch pr/workflow as "feat(dev): <message>" and opens a PR to main.
# Safe to run repeatedly: pr/workflow is always rebuilt from the latest origin/main,
# so leftovers from previously merged PRs never conflict.
set -euo pipefail

BRANCH="pr/workflow"
BASE="main"
PREFIX="feat(dev): "

MSG="${*:-}"
if [ -z "$MSG" ]; then
  read -r -p "Commit message: " MSG
fi
[ -z "$MSG" ] && { echo "Commit message required"; exit 1; }
MSG="${MSG#"$PREFIX"}"        # avoid double prefix
TITLE="${PREFIX}${MSG}"

command -v gh >/dev/null || { echo "gh CLI required"; exit 1; }

git fetch origin --prune

# If an OPEN PR already exists for this branch, just add the commit to it.
OPEN_PR=""
if gh pr list --head "$BRANCH" --state open --json url -q '.[0].url' 2>/dev/null | grep -q http; then
  OPEN_PR=$(gh pr list --head "$BRANCH" --state open --json url -q '.[0].url')
fi

if [ -n "$OPEN_PR" ]; then
  # Continue the existing open PR
  CUR=$(git rev-parse --abbrev-ref HEAD)
  [ "$CUR" != "$BRANCH" ] && git checkout "$BRANCH"
  git add -A
  git diff --cached --quiet || git commit -m "$TITLE"
  git push origin "$BRANCH"
  echo "Open PR updated: $OPEN_PR"
  echo "Note: the PR title must still start with '$PREFIX' to trigger the build."
  exit 0
fi

# No open PR: carry current changes onto a fresh branch cut from the latest origin/main.
git add -A
STASHED=0
if ! git diff --cached --quiet; then
  git stash push -q -m "make-pr-wip"
  STASHED=1
fi

git checkout -B "$BRANCH" "origin/$BASE"

if [ "$STASHED" = 1 ]; then
  git stash pop -q || { echo "Conflict applying your changes onto latest $BASE. Resolve, then re-run."; exit 1; }
fi

git add -A
if git diff --cached --quiet; then
  echo "No changes to commit (nothing differs from origin/$BASE)."
  exit 1
fi
git commit -m "$TITLE"

# Branch is rebuilt from main each time, so a force push is intended (only this branch).
git push -u --force-with-lease origin "$BRANCH"

gh pr create --base "$BASE" --head "$BRANCH" --title "$TITLE" --body "$TITLE"
