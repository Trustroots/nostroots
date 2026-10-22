# pnpm dependency patches

These patches are applied by pnpm through `patchedDependencies` in `pnpm-workspace.yaml`. Keep them separate from the root `patches/` directory, which is consumed by patch-package.

## decode-uri-component 0.5.0

The 0.5.0 release fixes exponential decoding of malformed input ([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)), but switches from a callable CommonJS export to an ESM default export. React Navigation currently brings in query-string 7, which calls the result of `require('decode-uri-component')` directly. Jest also expects this dependency to be CommonJS.

The patch restores only the CommonJS package type and function export. It keeps the upstream 0.5.0 decoding algorithm unchanged. Remove the patch when the dependency chain supports the upstream ESM export, and run `pnpm test:dependencies` plus the app suite to verify.
