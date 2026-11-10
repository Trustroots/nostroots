# pnpm dependency patches

These patches are applied by pnpm through `patchedDependencies` in `pnpm-workspace.yaml`. Keep them separate from the root `patches/` directory, which is consumed by patch-package.

## decode-uri-component 0.5.1

The 0.5.1 release fixes quadratic processing of malformed input ([GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)) and retains the ESM default export introduced in 0.5.0. React Navigation currently brings in query-string 7, which calls the result of `require('decode-uri-component')` directly. Jest also expects this dependency to be CommonJS.

The patch restores only the CommonJS package type and function export. It keeps the upstream 0.5.1 decoding algorithm unchanged. Remove the patch when the dependency chain supports the upstream ESM export, and run `pnpm test:dependencies` plus the app suite to verify.
