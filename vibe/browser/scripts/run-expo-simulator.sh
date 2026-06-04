#!/usr/bin/env bash
# Build (when needed) and run Nostroots Browser (Expo) in the iOS Simulator.
#
# Uses `expo run:ios`, which rebuilds native code when the iOS project or pods
# change and otherwise installs/launches the existing debug build.
#
# Optional env:
#   SIMULATOR_NAME   passed to `expo run:ios --device` (default: iPhone 17)
#   CLEAN_BUILD      set to 1 to pass `--no-build-cache` (full native rebuild)
#   SKIP_INSTALL     set to 1 to skip the `pnpm install` check
#   METRO_PORT       Metro port (default: 8081)
#   SKIP_BUNDLER     set to 1 to pass `--no-bundler` (Metro must already be running)

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
browser_dir="$(cd "${script_dir}/.." && pwd)"
expo_dir="${browser_dir}/expo"

simulator_name="${SIMULATOR_NAME:-iPhone 17}"
metro_port="${METRO_PORT:-8081}"

if [[ ! -d "${expo_dir}" ]]; then
  echo "error: ${expo_dir} not found" >&2
  exit 1
fi

if [[ ! -f "${expo_dir}/package.json" ]]; then
  echo "error: ${expo_dir}/package.json not found (is the Expo app checked out?)" >&2
  exit 1
fi

sync_xcode_node_binary() {
  local node_binary ios_env_local
  node_binary="$(command -v node || true)"
  if [[ -z "${node_binary}" ]]; then
    echo "error: node not found on PATH" >&2
    exit 1
  fi
  ios_env_local="${expo_dir}/ios/.xcode.env.local"
  if [[ ! -f "${ios_env_local}" ]] || ! grep -qF "export NODE_BINARY=${node_binary}" "${ios_env_local}" 2>/dev/null; then
    mkdir -p "${expo_dir}/ios"
    printf 'export NODE_BINARY=%s\n' "${node_binary}" >"${ios_env_local}"
    echo "Wrote ${ios_env_local} -> ${node_binary}"
  fi
}

ensure_dependencies() {
  if [[ "${SKIP_INSTALL:-0}" == "1" ]]; then
    return
  fi
  if [[ ! -d "${expo_dir}/node_modules" ]] || [[ "${expo_dir}/package.json" -nt "${expo_dir}/node_modules" ]]; then
    echo "Installing Expo dependencies..."
    (cd "${expo_dir}" && CI=true pnpm install)
  fi
}

sync_xcode_node_binary
ensure_dependencies

expo_args=(run:ios --device "${simulator_name}" --port "${metro_port}")

if [[ "${CLEAN_BUILD:-0}" == "1" ]]; then
  expo_args+=(--no-build-cache)
fi

if [[ "${SKIP_BUNDLER:-0}" == "1" ]]; then
  expo_args+=(--no-bundler)
fi

echo "Running Expo iOS simulator build (${simulator_name})..."
cd "${expo_dir}"
exec pnpm exec expo "${expo_args[@]}"
