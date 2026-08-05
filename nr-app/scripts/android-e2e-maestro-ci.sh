#!/bin/sh
set -eu

if [ "${RUN_FULL_E2E:-false}" = "true" ]; then
  set -- \
    .maestro/smoke.yaml \
    .maestro/welcome-onboarding.yaml \
    .maestro/trustroots-code.yaml \
    .maestro/deep-link-verify.yaml \
    .maestro/main-map-smoke.yaml
else
  set -- .maestro/main-map-smoke.yaml
fi

exec pnpm --dir nr-app run test:maestro:local -- "$@"
