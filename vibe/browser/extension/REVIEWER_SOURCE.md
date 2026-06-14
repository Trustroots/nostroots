# Reviewer Source Notes

This Firefox add-on is built from TypeScript with esbuild.

To reproduce the submitted Firefox package:

```bash
pnpm install
pnpm package:firefox
```

The generated Firefox package is written to:

```text
packages/nostroots-extension-firefox-0.1.0.zip
```

The Firefox manifest is generated from `src/manifest.json` by `scripts/build.mjs`.
