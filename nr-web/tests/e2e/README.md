# E2E Tests - Relay Publishing

## Setup

To run the relay publishing tests, you need to set up a test account:

1. **Copy the example.env file:**
   ```bash
   cp example.env .env
   ```

2. **Fill in the test account credentials in `.env`:**
   ```bash
   TEST_NSEC=nsec1your_test_account_nsec_here
   TEST_TRUSTROOTS_USERNAME=your-test-username
   ```

3. **Create a test account:**
   - Generate or use an existing Nostr key
   - Link it to a Trustroots username with NIP-5 validation
   - Make sure the username is verified on Trustroots

4. **Run the tests:**
   ```bash
   # In Docker (recommended)
   make test-e2e
   
   # Or run just the relay publishing tests
   docker-compose run --rm tests pnpm test:local:e2e tests/e2e/relay-publishing.spec.js
   ```

## Test Account Requirements

- The test account should have a valid nsec key
- The Trustroots username should be linked to the pubkey (NIP-5 validated)
- The account should be able to publish to the default relays

## What the Tests Do

1. **publish note to actual relay**: 
   - Imports the test nsec key
   - Sets the Trustroots username
   - Publishes a test note to the relay
   - Verifies the note appears on the relay

2. **verify test account setup**:
   - Verifies the test account credentials are valid
   - Checks that the key can be imported
   - Verifies Trustroots username linking

## Notes

- Tests are skipped automatically if `.env` is not configured
- The tests publish real events to real relays - use a test account only!
- Events published by tests will have unique timestamps to avoid conflicts
