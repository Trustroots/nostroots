# Proposed Tests for nr-web

This document outlines suggested tests to add, organized by category and test type.

## Unit Tests

### Key Management (`tests/unit/key-management.test.js`)

**Priority: High** - Core functionality, many edge cases

1. **generateKeyPair()**
   - Generates a valid 64-character hex private key
   - Stores key in localStorage
   - Derives correct public key
   - Disables NIP-07 when generating new key
   - Shows success status message

2. **importNsec()**
   - Successfully imports valid nsec format
   - Rejects invalid nsec (wrong prefix, malformed)
   - Clears input field on success
   - Disables NIP-07 when importing
   - Shows appropriate error messages
   - Handles empty input

3. **exportNsec()**
   - Exports nsec in correct format (starts with nsec1)
   - Only works when private key exists
   - Shows error when no key available
   - Copies to clipboard (mock clipboard API)

4. **deleteNsec()**
   - Removes key from localStorage
   - Clears current key variables
   - Shows confirmation dialog (mock)
   - Updates UI state after deletion
   - Handles cancellation

5. **loadKeys()**
   - Loads key from localStorage on init
   - Derives public key correctly
   - Updates UI display
   - Handles missing key gracefully

6. **copyPublicKey()**
   - Copies npub to clipboard
   - Shows visual feedback (checkmark)
   - Resets feedback after timeout
   - Handles clipboard errors

### Relay Management (`tests/unit/relay-management.test.js`)

**Priority: Medium** - Settings functionality

1. **saveRelays()**
   - Saves relay URLs to localStorage
   - Parses newline-separated URLs
   - Validates URL format
   - Handles empty input
   - Shows success/error messages

2. **getRelayUrls()**
   - Returns default relays when none saved
   - Returns saved relays from localStorage
   - Filters out invalid URLs
   - Handles malformed data

### Utility Functions (`tests/unit/utils.test.js`)

**Priority: Medium** - Supporting functionality

1. **Plus Code Operations**
   - Plus code encoding/decoding
   - Grid calculations
   - Prefix matching

2. **Event Processing**
   - Event validation
   - Tag parsing
   - Content extraction

## Integration Tests

### Modal Behavior (`tests/integration/modals.test.js`)

**Priority: High** - Core UI interactions

1. **Settings Modal**
   - Opens when settings button clicked
   - Closes when close button clicked
   - Closes when clicking outside modal
   - Closes on ESC key
   - Maintains state when reopened

2. **Onboarding Modal**
   - Shows on first visit (no key)
   - Hides after key is generated/imported
   - Cannot be closed with ESC (must complete onboarding)
   - Shows NIP-07 option when extension available

3. **Note Modals**
   - View note modal opens/closes correctly
   - Plus code notes modal behavior
   - Add note modal form interactions

### Form Interactions (`tests/integration/forms.test.js`)

**Priority: High** - User input handling

1. **Key Import Form**
   - Input validation
   - Submit button behavior
   - Error message display
   - Success feedback

2. **Relay Settings Form**
   - Textarea input handling
   - Save button functionality
   - Validation feedback

3. **Username Linking Form**
   - Input handling
   - Enter key submission
   - Validation messages

### Status Messages (`tests/integration/status.test.js`)

**Priority: Medium** - User feedback

1. **Status Display**
   - Shows success messages
   - Shows error messages
   - Shows info messages
   - Auto-hides after timeout
   - Multiple messages handling

## E2E Tests

### Onboarding Flow (`tests/e2e/onboarding.spec.js`)

**Priority: High** - First user experience

1. **Generate Key Flow**
   - Page loads, shows onboarding modal
   - Click "Generate New Key"
   - Modal closes
   - Settings show public key
   - Can export/delete key

2. **Import Key Flow**
   - Enter valid nsec
   - Click "Import nsec"
   - Modal closes
   - Settings show public key
   - Invalid nsec shows error

3. **Extension Connection Flow** (if extension available)
   - Click "Connect Browser Extension"
   - Extension prompt appears
   - Connection succeeds
   - Settings show NIP-07 status

### Note Posting (`tests/e2e/note-posting.spec.js`)

**Priority: High** - Core feature

1. **Basic Note Posting**
   - Right-click on map
   - Add note modal appears
   - Fill in note content
   - Select plus code
   - Click publish
   - Note appears on map
   - Note saved to localStorage

2. **Note Viewing**
   - Click on map marker
   - Note details modal opens
   - Shows note content
   - Shows author info
   - Can close modal

3. **Note Expiration**
   - Set expiration time
   - Publish note
   - Verify expiration handling

### Settings Management (`tests/e2e/settings.spec.js`)

**Priority: Medium** - Configuration

1. **Relay Configuration**
   - Open settings
   - Modify relay URLs
   - Save changes
   - Verify saved in localStorage
   - Reload page, verify persistence

2. **Key Management in Settings**
   - Export nsec
   - Verify clipboard content
   - Delete key (with confirmation)
   - Verify key removed
   - Onboarding appears again

3. **Profile Linking**
   - Enter username
   - Click "Link Profile"
   - Verify validation
   - Mock successful link
   - Verify username saved

### Map Interactions (`tests/e2e/map.spec.js`)

**Priority: Medium** - Map functionality

1. **Map Rendering**
   - Map loads and displays
   - Initial viewport correct
   - Map controls visible

2. **Map Interactions**
   - Pan map
   - Zoom in/out
   - Click on markers
   - Right-click to add note

3. **Plus Code Grid**
   - Grid displays on map
   - Grid updates with zoom level
   - Grid shows note counts

## Test Implementation Priority

### Phase 1: Critical Path (Start Here)
1. ✅ Basic setup (DONE)
2. Key management unit tests (generate, import, export, delete)
3. Onboarding E2E flow
4. Note posting E2E flow
5. Modal integration tests

### Phase 2: Core Features
1. Relay management tests
2. Settings form tests
3. Status message tests
4. Map interaction E2E tests

### Phase 3: Edge Cases & Polish
1. Error handling tests
2. Validation tests
3. Utility function tests
4. Performance/load tests

## Notes

- **Module Script Limitation**: Functions defined in the module script (with CDN imports) can only be tested via E2E tests, not unit/integration tests
- **Mocking Strategy**: 
  - Unit tests: Mock localStorage, clipboard, crypto
  - Integration tests: Real DOM, mock external APIs
  - E2E tests: Real browser, mock relay WebSocket connections
- **Test Data**: Create fixtures for:
  - Valid/invalid nsec keys
  - Sample Nostr events
  - Test relay URLs
  - Mock map coordinates

## Suggested Next Steps

1. Start with **key management unit tests** - they're pure functions, easy to test
2. Add **onboarding E2E test** - critical user flow
3. Add **modal integration tests** - quick wins, high value
4. Expand to **note posting E2E** - core feature
5. Fill in remaining tests as needed
