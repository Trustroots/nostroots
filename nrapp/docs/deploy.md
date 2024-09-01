# Deploy

To deploy to EAS run:

```bash
pnpm dlx eas-cli@latest update --branch main
```

This is only possible if you are already logged into eas like:

```bash
pnpm dlx eas-cli@latest login
```

Currently this only works for @chmac, but we could create a shared expo account and use that in the future.
