# Shared iOS Keychain Storage

`nr-browser` stores its own key for v1. The native iOS app stores it in this
app's private iOS Keychain item; the Expo prototype uses Expo SecureStore. It
does not read from `nr-app`, because the current `nr-app` key is stored in that
app's private keychain group.

To share one key between `nr-app` and `nr-browser` later:

1. Build both apps with the same Apple Developer Team.
2. Add the same Keychain Access Group entitlement to both apps.
3. Configure both apps to read and write keychain values with the same access
   group. In Expo SecureStore this is the iOS-only `accessGroup` option; in the
   native app this means adding the access group attribute to Keychain queries.
4. Add an `nr-app` migration that reads the existing private keychain item and
   writes the same value into the shared access group.
5. After migration, make both apps prefer the shared access group and keep the
   old private item only as a fallback during rollout.

Apple keychain items belong to one access group. A second app cannot read an
existing private item unless the original app writes that item into a shared
group.
