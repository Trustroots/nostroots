#!/bin/sh

set -eu

artifact_root=${1:?"usage: sanitize-maestro-artifacts.sh <directory>"}

if [ ! -d "$artifact_root" ]; then
  exit 0
fi

# Maestro includes flow names in diagnostic directory names. Flow names contain
# colons, which are valid on Linux and macOS but rejected by upload-artifact.
find "$artifact_root" -depth -name '*:*' -exec sh -c '
  for artifact_path do
    parent=${artifact_path%/*}
    name=${artifact_path##*/}
    safe_name=$(printf "%s" "$name" | tr ":" "-")
    mv "$artifact_path" "$parent/$safe_name"
  done
' sh {} +
