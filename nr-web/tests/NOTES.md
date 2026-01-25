# Testing Notes

## Module Script Limitations

The `index.html` file contains a `<script type="module">` that imports from CDN:
- `nostr-tools` from `https://cdn.jsdelivr.net/npm/nostr-tools@2.10.3/+esm`

These imports will **fail** in the jsdom test environment because:
1. jsdom cannot fetch external resources
2. ES module imports from CDN require network access

### Impact

Functions defined in the module script (after the imports) will not be available in unit/integration tests because the script fails before defining them.

### Solutions

1. **For unit/integration tests**: Test functions that are defined in non-module scripts, or manually mock the CDN imports
2. **For E2E tests**: These work fine because they run in a real browser that can fetch CDN resources
3. **Future improvement**: Extract functions to separate modules that can be properly mocked

### Current Workaround

The test setup suppresses console errors from failed imports. Functions that are defined before the module script (or in non-module scripts) can be tested. Functions in the module script will need to be tested via E2E tests or extracted to testable modules.

## Testing Strategy

- **Unit tests**: Test utility functions, key management (if available in non-module scripts)
- **Integration tests**: Test DOM interactions, modal behavior
- **E2E tests**: Test full functionality including module script functions
