#!/usr/bin/env bash
# Build Nostrail and run it on the iOS Simulator.
#
# Optional env:
#   SIMULATOR_NAME   default: iPhone 17 Pro
#   SIMULATOR_OS     e.g. 26.0 (omit to let Xcode pick a matching runtime)
#   DERIVED_DATA     default: vibe/web/ios-app/.derived

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=simulator-common.sh
source "${script_dir}/simulator-common.sh"

launch_app_in_simulator "Nostrail" "Nostrail.app" "org.trustroots.nostrail"
