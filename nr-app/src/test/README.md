# nr-app Test Utilities

Use the helpers in this folder for Jest and React Native Testing Library tests.

- `renderWithProviders()` renders components with a test Redux store and router spies.
- `createTestStore()` creates a Redux store with the app slices but without production persistence or automatically started sagas.
- `router.ts` controls `expo-router` mocks for `push`, `replace`, `dismissTo`, pathnames, search params, and redirects.
- `secureStoreMock.ts` provides deterministic in-memory `expo-secure-store` behavior.
- `nostrMocks.ts` contains per-test mock factories for relay, subscription, publish, signing, and NIP-05 boundaries.
- `fetch.ts` contains deterministic JSON `fetch` helpers.

Prefer mocking at service/network/native boundaries. Screen tests should still assert user-visible behavior, navigation, and dispatched effects through the shared render helper.

Every mock with mutable state must be reset in `beforeEach`. Global reset hooks live in `jest.setup.ts`; per-test module mocks should expose their own reset or be recreated inside each test.
