# UI Components

These are components from [React Native Reusables](https://reactnativereusables.com/), a collection of copy-and-paste React Native components built with NativeWind.

## Installation

You can install individual components using the CLI:

```bash
pnpm dlx @react-native-reusables/cli@latest add button
```

## Documentation

For more components and detailed documentation, visit: https://reactnativereusables.com/

## Post-Installation

After adding a component, verify that imports are correct. The CLI installer may not detect the correct paths for our utility functions. Common fixes needed:

- Update imports (the import process is not compatible with our file naming. conventions)
- Check that `cn` helper and other utilities are imported from the correct location

Always review the generated component file and adjust import paths as needed.
