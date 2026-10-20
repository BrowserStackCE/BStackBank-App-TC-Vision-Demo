#!/usr/bin/env bash
# Trigger the Test Companion exploration directly, without the app build/merge flow.
#
# Usage:
#   ./scripts/run-tc-explore.sh ci    [app] [device] [os_version]   # runs the GitHub workflow (workflow_dispatch)
#   ./scripts/run-tc-explore.sh local [app] [device] [os_version]   # runs tc on THIS machine
#
#   app         bs://<hash>, or a custom id such as BStackBankLatest (default). Custom ids are
#               resolved to the real bs://<hash> first; tc rejects a bare custom id.
#   device      optional, e.g. "Google Pixel 8". Empty = Test Companion chooses.
#   os_version  optional, only used together with a device
#
# Both modes use .github/tc-context/feature-context.md as the exploration prompt.
set -euo pipefail

MODE="${1:-ci}"
APP="${2:-BStackBankLatest}"
DEVICE="${3:-}"
OSV="${4:-}"

TM_PROJECT="PR-79"
TM_FOLDER_NAME="Functional"
TM_FOLDER_ID="60003370"
CTX_FILE=".github/tc-context/feature-context.md"
WORKFLOW="tc-explore.yml"

case "$MODE" in
  ci)
    command -v gh >/dev/null || { echo "gh CLI required"; exit 1; }
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    echo "Dispatching $WORKFLOW (needs the workflow file on the default branch)"
    gh workflow run "$WORKFLOW" -f app="$APP" -f device="$DEVICE" -f os_version="$OSV"
    sleep 4
    gh run list --workflow "$WORKFLOW" --limit 1
    echo "Watch it with: gh run watch \$(gh run list --workflow $WORKFLOW --limit 1 --json databaseId -q '.[0].databaseId')"
    ;;
  local)
    command -v tc >/dev/null || { echo "tc not installed"; exit 1; }
    [ -f "$CTX_FILE" ] || { echo "$CTX_FILE not found (run from the repo root)"; exit 1; }
    : "${BROWSERSTACK_USERNAME:?set BROWSERSTACK_USERNAME (e.g. source .env)}"
    : "${BROWSERSTACK_ACCESS_KEY:?set BROWSERSTACK_ACCESS_KEY (e.g. source .env)}"
    APP="$(node scripts/resolve-bs-app.js "$APP")"
    echo "App: $APP"
    tc auth login >/dev/null
    tc tm use browserstack >/dev/null
    tc tm review --reject --all >/dev/null 2>&1 || true   # no unverified leftovers
    DEVICE_ARGS=()
    [ -n "$DEVICE" ] && DEVICE_ARGS+=(--device "$DEVICE")
    [ -n "$DEVICE" ] && [ -n "$OSV" ] && DEVICE_ARGS+=(--os-version "$OSV")
    CTX="$(cat "$CTX_FILE")"
    INSTRUCTIONS="Save every generated test case to Test Management project ${TM_PROJECT} (Test-Companion-Demo-Vision), inside the existing folder ${TM_FOLDER_NAME} (folder id ${TM_FOLDER_ID}). Do not create a new project and do not use the Automation folders.
Write manual, step-based test cases only (a title, preconditions, numbered steps, and one clear expected result per step). Do not generate automation scripts or file names.
You MUST explore the feature on the real device and base every test case on what you actually observed. If the device session cannot be started or is lost, STOP and report failure. Never write test cases from the description alone and never save unverified cases.

${CTX}"
    tc app generate --app "$APP" --platform android ${DEVICE_ARGS[@]+"${DEVICE_ARGS[@]}"} \
      --auto-grant-permissions --save-to-tm --yolo "$INSTRUCTIONS"
    ;;
  *)
    echo "Usage: $0 ci|local [app] [device] [os_version]"; exit 1;;
esac
