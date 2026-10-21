#!/usr/bin/env bash
# Trigger the Test Companion exploration directly, without the app build/merge flow.
#
# Usage:
#   ./scripts/run-tc-workflow.sh ci    [app] [device] [os_version]   # runs the GitHub workflow (workflow_dispatch)
#   ./scripts/run-tc-workflow.sh local [app] [device] [os_version]   # runs tc on THIS machine
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
DEVICE="${3:-Google Pixel 9}"