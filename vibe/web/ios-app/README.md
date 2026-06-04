# nr-web Native iOS Workspace

This folder contains the native iOS implementation track described in:

- `vibe/docs/iOS-plan.md`
- `vibe/docs/iOS-nostrail-location-sharing-app.md`

## Structure

- `SharedCore/`: shared key, relay/auth, payload, storage, and location-sharing logic
- `NostrailApp/`: focused temporary location-sharing app target
- `SwiftrootsApp/`: broader product shell target aligned with the iOS plan (Xcode scheme **Swiftroots**)
- `NostrootsNativeTests/`: shared-core unit/integration tests
- `scripts/generate_xcodeproj.rb`: project generator for a two-target Xcode project

## Generate Project

```bash
cd vibe/web/ios-app
ruby scripts/generate_xcodeproj.rb
```

The generated project links the pinned `nostr-sdk-ios` Swift package by default. In constrained environments where Xcode cannot resolve Swift packages, regenerate with the package disabled to run source/project compile checks against the explicit unavailable-provider fallback:

```bash
NR_USE_NOSTR_SDK_PACKAGE=0 ruby scripts/generate_xcodeproj.rb
```

## Build Targets

```bash
xcodebuild -project NostrootsNative.xcodeproj -scheme Nostrail -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -project NostrootsNative.xcodeproj -scheme Swiftroots -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## Run Tests

```bash
xcodebuild -project NostrootsNative.xcodeproj -scheme NostrootsNativeTests -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## Current Sprint Notes

- NIP-42 auth event generation is implemented.
- Key import is centralized through `KeyImportParser` and supports hex, checksum-validated bech32 `nsec`, and repo-compatible BIP-39 recovery phrases.
- NIP-05 resolver now performs real `.well-known/nostr.json` lookups with response/pubkey validation.
- NIP-01 canonical event-id generation/validation is enforced in shared core and relay wire decoding.
- Relay wire decoding now applies sanity limits (future timestamp skew, max content size, and tag shape/value bounds) before accepting events.
- Default crypto now uses `nostr-sdk-ios` pinned to revision `e5855cbd3bdabf44075fd2abdf76f63bac4cbd5f` for secp256k1 pubkey derivation, Schnorr event signing, and NIP-44 v2 payload encryption.
- The project generator can temporarily omit the Swift package with `NR_USE_NOSTR_SDK_PACKAGE=0`; that mode compiles against a deliberate throwing fallback and is only for local wiring checks.
- Shared crypto still uses the explicit `NostrCryptoProviding` provider boundary, with compatibility crypto retained only for legacy local decrypt/test paths.
- `NIP44Box` emits standard NIP-44 v2 payloads by default and still decrypts prior `NIP44COMPAT:v2/v3` payloads.
- Tests include guarded official NIP-44 decrypt vector coverage for the pinned SDK path, including SDK-provider decrypt, `NIP44Box` routing, and tamper rejection around the verified checksum sample; package-free local builds also assert unavailable-SDK encrypt/decrypt paths fail closed instead of silently using compatibility crypto.
- Default relay transport now uses a real WebSocket relay client with NIP-42 challenge/auth handling and publish ACK support.
- Relay publish/auth ACK handling now includes explicit timeout failure handling to avoid hanging requests.
- Failed relay connection checks now reset shared connection state and show friendly "Could not connect" status instead of leaving partial connection state behind.
- Relay pool connection now fails immediately with a user-facing "could not reach any enabled relay" error when every enabled relay is unreachable, while still allowing partial relay availability.
- Relay pool support is now wired (`RelayPoolClient`) across default Trustroots/Nomadwiki relay endpoints with reconnect + subscription replay.
- Relay read/write preferences are now persisted via `UserDefaultsRelayPreferencesStore` and loaded on pool initialization.
- Relay pool read/write direction controls now fail explicitly when no readable/writable relay is enabled and avoid sending operations to disabled relays.
- Relay/connect/publish failures now map technical diagnostics to plain recovery copy in app UI while tests keep diagnostic coverage.
- Relay publish/stop/invite failures now clear cached relay-ready state through one shared service helper so the next user action reconnects instead of trusting a stale session.
- Relay send/stop failures now also clear persisted recent-check history, so stale "relays reachable" text disappears until relays are checked again.
- Active sharing now pauses automatic periodic publishes after a background send failure, shows Nostrail map copy that updates are paused, and resumes the timer after a successful reconnect or manual location update.
- Partial invite/share fanout failures now keep successful recipients active while showing concise "updated/started, reconnect then retry N people" status instead of collapsing partial success into a total send failure.
- Nostrail and Swiftroots recipient-sheet reconnect buttons now share the same short "Try Again Soon" cooldown after failed reconnects as the map/settings relay actions; Swiftroots relay checks also clear their running state after successful checks.
- Relay receive-loop endings now clear cached relay-ready state and show plain reconnect guidance instead of leaving the app looking connected after subscriptions stop.
- Swiftroots Home/Settings now turn that stopped-receiving state into "Reconnect" status, helper text, and button copy so users have an obvious next action.
- Swiftroots Home/Settings now also turn send/connect relay failures into reconnect status, helper text, and sharing-prep blocking copy instead of showing stale ready-to-share guidance.
- Multi-recipient invite/share reporting now preserves successful relay fanout recipients and returns failed recipients for row-level retry when one publish fails after another succeeds.
- All-failed multi-recipient relay fanout now also returns row-level retry state instead of collapsing into a generic throw in the reporting APIs.
- Nostrail now keeps lookup failures and relay-send failures separate in recipient results, showing bad inputs as `Check` rows and connection/send failures as `Retry` rows with "when your connection is back" copy.
- Nostrail invite retry actions now use retry-specific button/status copy, so relay-send failures read as a retry flow instead of a fresh invite send.
- Nostrail share retry actions now also use retry-specific map CTA/status copy for failed sharing starts and failed location updates.
- Nostrail now shows a plain Reconnect action in the map status panel after stale relay streams or send/connect failures, letting people restore relay readiness before retrying pending invites or location updates without exposing relay-auth wording.
- Nostrail map and Relay Settings reconnect actions now show a short Try Again Soon cooldown after failed relay reconnects, reducing repeated taps while the relay path is still failing.
- Nostrail recipient-sheet relay failures now mark affected invite rows as retryable and use direct "Reconnect, then retry" copy instead of leaving users on a generic send error.
- Nostrail share/update relay failures now use the same retry-row recovery path as invites, while relay settings problems such as sharing being turned off still surface as settings/action copy instead of a misleading retry.
- Nostrail recipient rows with `Check` or `Retry` state now include a short second-line hint, so people know whether to edit/remove a bad recipient or reconnect before retrying.
- Nostrail `Check` rows now include a visible edit action that moves the bad recipient back into the input field and focuses it for correction.
- Nostrail recipient sheets now show a direct Reconnect button whenever invite rows are marked `Retry`, then hide it and switch the pinned helper/status to retry rows marked `Retry` after reconnect succeeds.
- Nostrail recipient sheets now keep retry rows in explicit "Reconnect/check first, then retry rows marked Retry" guidance after Relay Settings edits until a real relay check restores the sharing path.
- Nostrail recipient sheets now promote the invite retry button above sharing after a successful reconnect, so the recovered path points at the next action instead of another sharing start/update.
- Nostrail recipient sheets now keep invite retry styling scoped to invite failures, so share/update retry rows reconnect and then point back to the sharing action instead of relabeling the invite button as a retry.
- Nostrail recipient sheets now use retry-specific sharing labels for share/update retry rows, including `Retry Sharing Start` and `Retry Location Update`.
- Nostrail `Retry` row hint text now changes after sheet-level reconnect succeeds, replacing "Reconnect, then retry" with a direct retry hint.
- Nostrail recipient input edits now clear stale banner copy without removing visible `Check`/`Retry` row state, so pending corrections and relay retries remain actionable while people type.
- Nostrail empty-clipboard paste feedback now clears as soon as the user starts typing a recipient.
- Nostrail duplicate-only and invalid-only add/paste attempts now clear stale top failure notices while preserving row-level Check/Retry state.
- Nostrail recipient copied/removed/edit prompts now clear when the user starts typing the next recipient, avoiding stale last-action copy in the sheet.
- Nostrail paste-and-add feedback now lives in shared formatter logic with tests for added, duplicate, and invalid recipient batches, compacts noisy duplicate/invalid lists, and duplicate-only feedback clears as soon as the user edits again.
- Nostrail recipient-sheet transient banner clearing is now shared formatter logic with coverage for retry/check copy, keeping the view from owning fragile string matching.
- Nostrail recipient sheet now keeps Share and Invite actions pinned in a bottom safe-area bar, so the primary actions stay reachable on small screens and when the keyboard is open.
- Nostrail main sharing controls now show explicit next-step helper copy before a location fix, while waiting for iOS location, after retryable location failures, and when no recipient is selected; retryable failures relabel the main action to Try Location Again without clearing selected people, stale retryable location copy clears after a fresh location or recipient change, and canceling a pending location wait stops the request, keeps selected people, and prevents a late location callback from starting sharing.
- Nostrail current-location control now shows in-flight progress and ignores repeated taps while iOS is resolving location.
- Nostrail location permission/status copy is now shared formatter logic with tests, including the exact state that should show the Open Settings recovery action.
- Nostrail share retries now show helper text when only pending rows will receive a sharing start or location update, including reassurance that already-current recipients will not get duplicate sends.
- Nostrail share retry controls now show an all-current disabled state with a next-step hint when every visible recipient already received the current sharing start/location update.
- Nostrail recipient-sheet sharing controls now use that same all-current disabled state and pending-update helper copy, preventing a no-op Share Current Area tap after all visible recipients already have the latest update.
- Nostrail recipient-sheet Start Sharing helper copy now lives in shared formatter logic with test coverage for empty, invite-sending, and ready states.
- Nostrail recipient-sheet share action now switches between Start Sharing and the friendlier Share Current Area with matching helper copy when a session is already active.
- Nostrail share retry state now keeps already-updated visible recipients marked current after failed rows are removed, so the share button does not ask for a duplicate retry.
- Successful Nostrail share/update sends now keep visible recipients marked current during the active session, while stopping sharing clears that transient current-state guard.
- Nostrail now clears that current-recipient guard only when iOS reports a different snapped area during active sharing, so real movement re-enables Share Current Area without GPS jitter causing duplicate prompts; the status copy explains that periodic updates will still happen automatically.
- Nostrail recipient removal now prunes stale Sent/Check/Retry state and returns the invite sheet to a plain empty state when the last recipient is removed.
- Nostrail's disabled invite action now explains that at least one recipient is needed.
- Nostrail all-failed invite/share fanout is now retry-tested end to end: the failed rows stay actionable, relay readiness is reacquired automatically, and the next send can succeed without re-entering recipients.
- Failed initial share publishes now roll back active session state so the app does not claim sharing started when no update was sent; failed stop publishes pause periodic updates while keeping the session retryable with stop-specific reconnect/retry copy.
- Swiftroots Settings now shows plain relay availability, including all-off, receiving-off, and sharing-off states, includes per-relay Receive/Share toggles with plain per-relay descriptions and last-check feedback backed by persisted relay preferences, clears stale check results when relay toggles really change while preserving recent relay-check confidence on no-op toggle requests, and asks for confirmation before turning off the last receiving or sharing path.
- Swiftroots Home/Settings connection status now uses user-facing copy for connected, ready, no-relays, all-off, receiving-off, and sharing-off relay states.
- Swiftroots Home now replaces placeholder map/session rows with real identity, relay, active-sharing, restored recipient context, active-session current-area updates that distinguish restored vs newly added people while preserving the full active recipient set after additive updates, opening Start Sharing with an initial current-area prompt when no location is ready, keeping successful update confirmations visible in the sheet with an explicit Done completion state, clearing that completion state when recipients are edited again or a pending location request starts/fails, offering in-sheet Settings recovery when location permission is off, relabeling retryable location failures as Try Location Again without clearing selected people, and letting people cancel a pending location request without losing selected people or auto-sharing after a late location callback; late fresh-location callbacks now replace stale cancel/error copy with current-area-ready status, plus session-expiry, fresh-location, and standalone status summaries, direct copy-handle, Trustroots profile, Check Relays, and Stop Sharing actions; the Chat tab now uses a clear coming-next empty state tied to verified identity, shows the messaging Trustroots handle, and can copy it with local feedback instead of showing raw placeholders.
- Swiftroots Start Sharing now keeps its result and helper copy aligned with the action, distinguishing a new sharing session from sharing the current area with added people and covering current-area partial/all-failed retry states in shared formatter tests.
- Swiftroots Start Sharing now returns people from relay-settings recovery back to the sheet after Check Relays succeeds, preserving pending retry rows instead of losing the flow in Settings.
- Swiftroots Start Sharing relay-settings recovery now keeps failed relay checks in Settings with concrete no-sharing-path guidance, uses explicit Retry Start Sharing copy when entering Settings, returns with explicit Retry Start Sharing copy after successful checks, and tells blocked retry sheets to retry rows marked Retry instead of generic retry wording.
- Swiftroots relay rows now point blocked Start Sharing retries at failed Share relays or reachable receive-only relays that can be made writable.
- Swiftroots Relay Settings now keeps blocked Start Sharing retries visible with top-level recovery copy for empty/all-off relay states as well as row-level relay fixes.
- Nostrail and Swiftroots Relay Settings now let people add custom relays in-app, normalizing bare host names to `wss://` and persisting custom endpoints alongside built-in relay toggles.
- Nostrail and Swiftroots Relay Settings now let people remove custom relays while leaving built-in relays as Receive/Share toggle-only defaults.
- Nostrail and Swiftroots Relay Settings now include Restore Default Relays to remove custom relays and reset built-in Receive/Share defaults in one recovery step.
- Nostrail and Swiftroots Relay Settings now confirm custom relay removal and default-restore actions before changing the relay list.
- Nostrail and Swiftroots Relay Settings failures now use shared action-specific recovery copy, including Add Relay retry guidance, duplicate-relay guidance, Remove Relay retry/refresh guidance, bundled-relay fallback copy, and built-in relay removal guidance that points people to Receive/Share toggles.
- Nostrail and Swiftroots relay summaries and Relay Settings now show Receive/Share-specific recovery copy on failed per-relay checks, including after routine reconnect checks and repeated failures, so people know when a relay keeps failing and whether to turn it off or add another relay for that direction. Per-relay failure counters persist across fresh relay pool instances and clear after successful checks or relay/key resets; reconnect/check cooldowns now use those repeated failure counts when available and explain longer waits in helper text.
- Nostrail and Swiftroots recent relay-check summaries now switch to day-based age text and prompt a fresh Check Relays pass once the saved result is stale, so old "relays reachable" copy does not look current or keep driving active-sharing decisions.
- Relay add, toggle, removal, and restore-default changes now reset stale relay auth/subscription runtime, preventing old receive subscriptions from replaying after settings change, and their status copy points people to Reconnect or Check Relays before sharing again.
- Relay preferences now recover from malformed, duplicated, or legacy bare-host saved relay records by loading usable defaults/custom relays and repairing the saved snapshot for the next launch.
- Persisted relay failure counters now get the same cleanup path: malformed counters are cleared, duplicate or legacy URLs are normalized, and counters for removed relays are pruned before they can affect retry cooldowns.
- Relay setting edits now clear persisted per-relay failure counters across toggle/add/remove/restore paths, so a fixed relay setup gets a fresh reconnect cooldown instead of inheriting stale repeated-failure backoff.
- Relay retry helper copy now switches from the countdown to an explicit "Try again now." state once the cooldown expires, keeping Reconnect and Check Relays recovery clearer after repaired failure-counter state.
- Restored active sharing copy now points people through the full recovery path: reconnect relays first, then use Share Current Area to send the latest approximate area immediately.
- Restored active sharing now clears any persisted relay-check summary during relaunch, so Home/Settings and map panels do not show stale "relays ready" confidence while the restored session still needs reconnecting.
- Failed reconnects from restored active sharing now keep the restored-session recovery path visible, telling people to reconnect relays before using Share Current Area instead of falling back to generic connection failure copy.
- Partial reconnects from restored active sharing now distinguish Receive-only vs Share-capable relay access, sending people to Relay Settings before Share Current Area when sharing has no reachable relay.
- Active sharing panels now surface that same relay warning beside session controls, so Share Current Area is paired with a Relay Settings next step whenever the latest relay check says sharing cannot reach a relay.
- Active sharing sheets now carry that warning into Nostrail Recipients and Swiftroots Start Sharing, disabling Share Current Area and offering Relay Settings when the current relay path cannot publish; relay settings edits suppress stale active-sharing warnings until relays are checked again, and the shared sheet-blocking rule is covered by native formatter tests.
- Stop Sharing recovery now relabels the action as Retry Stop Sharing and explains whether relays should be reconnected first or are already reconnected, keeping active sessions clear after a failed stop publish.
- Stop Sharing recovery now also notices relay settings edits after a failed stop publish, replacing stale retry guidance with Reconnect/Check Relays first copy before Retry Stop Sharing; Nostrail and Swiftroots Relay Settings status/action copy now stays stop-retry-specific while that recovery is pending.
- Stop Sharing retry state now survives relay availability status refreshes after settings edits, so the action stays labeled Retry Stop Sharing until the stop notice succeeds or the session is cleared.
- Shared onboarding now preserves that same Stop Sharing retry state before key replacement, so setup screens do not imply a key can change while the old session still needs a stop retry.
- Shared onboarding now uses the same Stop Sharing recovery wording as the main apps, including Retry Stop Sharing after failed stop publishes and Clear Expired Sharing for expired Swiftroots sessions before key replacement.
- Swiftroots now disables the Check Relays action when all relays are off or none are configured, and shows direct "turn on" vs "add" next-step copy.
- Swiftroots Check Relays now summarizes reachable vs failed relays after each check, while per-relay rows keep the detailed last-check state.
- Swiftroots failed relay checks now apply a short visible retry pause with "Try Again Soon" copy, avoiding rapid repeated reconnect attempts.
- The shared location service now stores the most recent relay-check summary after automatic or manual relay connection attempts; Swiftroots shows it in Home/Settings and Nostrail shows it in the map status panel, and the summary clears when relay settings or the local key change.
- Key import, generation, and clear now also reset relay auth/subscription runtime, stale per-relay reachability rows, and persisted relay failure counters, so a new local identity does not inherit old relay-check details or receive paths.
- Key storage default is now Keychain-backed (`KeychainKeyStore`) with in-memory fallback available for tests, friendly Keychain failure copy, and explicit storage status for UI.
- Key status copy now distinguishes real device storage from local simulator test storage with test coverage, so unsigned simulator runs do not sound like production Keychain storage.
- Key import now normalizes accepted `nsec`, hex, or recovery phrase input to private-key hex before crossing the `KeyStore` boundary, so storage never receives raw mnemonic/nsec text from the app service.
- Key storage supports explicit clear/reset with confirmation before deleting Keychain state and resetting app runtime state; active sharing blocks key clearing until the session is stopped.
- Nostrail clear-key confirmation copy now lives in the shared key lifecycle helper with test coverage, matching the other destructive key-removal guard copy.
- Clear-key now uses the same full runtime reset path as key import/replacement, including cached location, relay/session tasks, received-location storage, persisted relay failure counters, and app-level relay recovery sheets/confirmation state.
- Received-location storage now has a bounded `UserDefaults` implementation for native app relaunches, with replace-by-id, expiration pruning, per-peer stop cleanup, and clear-all behavior covered by native tests.
- Active Nostrail sharing sessions now persist session id, expiry, encrypted recipients, recipient display values, stop recipients, and latest approximate coordinate, restoring valid sessions after relaunch with automatic updates paused until relays reconnect, visible recipient context plus restored-state map copy, Share Current Area updates without re-entering recipients, and expired-session cleanup on startup.
- Importing or generating a replacement key now resets relay/session runtime state and clears old received-location markers so stale data from the previous identity cannot remain visible; active sharing blocks key replacement until the session is stopped.
- Stopping without an active sharing session now reports the same plain no-session state used by update attempts instead of silently returning.
- Recipient-targeted location updates now check for an active sharing session before resolving recipients, so a stopped session reports "Start a sharing session first." without misleading recipient lookup errors.
- Stop actions now also detect locally expired sessions before relay work, clear the stale session state, and avoid publishing unnecessary stop events.
- Nostrail action error copy now preserves the explicit "Sharing session expired." status in the UI instead of collapsing expired sessions into generic no-session copy.
- Nostrail clears share/update row-current state and stale share retry notices when sharing ends or expires, so selected people are available for the next Start Sharing flow instead of staying marked "Updated"; invite-sent state is preserved.
- Shared SwiftUI onboarding now gates both app targets before main UI appears, with generate/import modes, one-tap paste-and-import, nsec backup confirmation, npub-vs-nsec guidance, and keyboard-safe forms.
- Generated-key creation failures now use shared onboarding recovery copy with a direct Generate Key retry instruction instead of raw local error text.
- Shared native onboarding now uses tested status-clearing logic, so empty-clipboard, Trustroots helper, copied-nsec/npub, opening-link prompts, paste/import, paste/verify, Save Key, Clear Key, and parent recovery notices clear as soon as the user starts the next setup action instead of lingering; switching between Generate and Import also clears the hidden draft/input for the abandoned setup path, and generated-key drafts are cleared from view state immediately after a confirmed save.
- Swiftroots adds a lightweight Trustroots username/NIP-05 verification step before showing the app tabs, accepting bare usernames, `@username`, `username@trustroots.org`, or pasted Trustroots profile URLs with a one-tap paste-and-verify action, binds the verified username to the current pubkey so stale links cannot unlock a new key, gives direct npub-to-Trustroots recovery hints when the username is missing or points to another key, maps verification/network failures to plain retry copy, offers a confirmed "use a different key" recovery path before verification, shows labeled selectable identity/relay/sharing details on Home/Profile/Chat/Settings with middle-truncated public addresses for scanning, links to the existing Trustroots profile from Home/Profile/Settings with local opening feedback, shows/copies the Trustroots handle plus public address from Home/Profile/Chat/Settings with tab-scoped status feedback, and replaces the Profile placeholder with a verified-identity readiness state while editing/contacts/claims are pending.
- Swiftroots onboarding now clears the stored linked pubkey immediately when the user chooses a different key, uses shared tested defaults normalization to trim/remove blank saved username/pubkey state, and shows a recovery notice when a stale Trustroots link is reset while preserving more specific key-clear success copy.
- Swiftroots Settings clear-key confirmation now explicitly says the local Trustroots link will be removed before returning to setup, active-share blocking copy explains that stopping first lets Swiftroots tell people the session ended, and save/stop/clear failures now keep users oriented that the key and local Trustroots link remain as-is until they retry; Clear Key failures also use this same recovery copy from Settings, while relay-add failures keep plain relay input errors.
- Shared onboarding Stop Sharing failures now make the active-session recovery explicit before key replacement, confirming the key remains as-is and, in Swiftroots, that the local Trustroots link remains as-is until Retry Stop Sharing succeeds.
- Swiftroots relay recovery now treats Stop Sharing failures as their own path, so Home/Settings say to reconnect and retry Stop Sharing instead of pointing at pending invites or location updates.
- Swiftroots Settings includes a plain "Check Relays" action with user-facing feedback, keeping relay readiness visible without exposing relay-auth mechanics and explaining when relays must be added or turned on first.
- Nostrail UI is now map-first after onboarding with an initial current-area prompt, a current-location control, clearer Add People map entry point and Add People to Share empty CTA, recipient sheet with a visible Start Sharing section, multi-recipient invite/share support, no placeholder location sharing before a real location fix, visible/cancelable pending-share state while waiting for iOS location, permission-denial cancellation with an Open Settings action, a visible fixed session end time while sharing, copy-public-address access from the gear menu, clear-key and key-replacement blocking during active/stopping shares, pending-share cancellation before key clear confirmation, and better key-import feedback.
- Incoming peer stop events now remove that peer's active map marker immediately instead of waiting for the location event to expire.
- Received location markers are pruned on a lightweight service timer too, so expired shares can disappear even when no new relay event arrives.
- Recipient input accepts bare Trustroots usernames, `@username`, pasted Trustroots profile URLs, `name@domain` NIP-05 handles, `npub1...`, and raw pubkey hex, with matching field/error copy, one-at-a-time entry or comma/space/newline-separated bulk paste, paste-and-add, partial-success feedback, service-level profile-link resolution coverage, and duplicate canonicalization before invites are sent.
- Recipient resolution now deduplicates both canonical input aliases and resolved pubkeys before invite/share fanout, keeping relay work and user-facing counts aligned.
- Nostrail invite sends now support partial success: valid recipients still receive invites, unresolved recipients remain in the sheet with a clear correction message.
- Nostrail share start/update actions now use the same partial-success behavior, publishing to resolved recipients and reopening the recipient sheet for unresolved entries with concise check/retry guidance; all-failed invite/share attempts now mark every attempted row as checkable or retryable instead of leaving the user on a generic error; a retry sends only unresolved or newly added rows for that share update, while earlier invite "Sent" state does not suppress later location sharing.
- Nostrail partial-failure and recipient lookup errors now use shorter user-facing copy, avoiding relay/protocol wording in normal flows and suppressing duplicate format help for malformed recipient input.
- Nostrail recipient sheets now keep successful and unresolved entries visible after partial invite/share success, marking successful invite rows as "Sent", successful share-update rows as "Updated", bad-input rows as "Check", and relay-send rows as "Retry" with retry-specific primary button copy.
- Nostrail recipient sheet rows now shorten long public keys/npubs for small screens while keeping the full recipient available to accessibility and copy.
- Nostrail recipient sheet notices now summarize `Check`/`Retry` failures without repeating long recipient names already shown in the rows.
- Nostrail invite retries now show helper text explaining that only pending invite rows will be sent, reassure that already-invited recipients will not get duplicate invites, and all-sent sheets explain that everyone selected has already been invited.
- Retrying invites from the recipient sheet now sends only unresolved or newly added rows, avoiding duplicate sends to rows already marked "Sent".
- Recipient retry state is now a shared tested core type, covering invite retries, share-update retries, and state clearing after successful updates.
- Nostrail recipient sheets now show actionable empty-state copy with supported Trustroots handle/profile-link/key formats, count-aware send labels, block dismissal/editing while sends are running, report removals, and clear stale correctable errors as users edit.
- Nostrail main-screen recipient summaries now stay compact, showing the first selected people and a `+N more` count while shortening long public keys.
- Nostrail share/update/stop controls now show in-flight state and disable competing actions while relay work is running.
- Nostrail's manual "Update Shared Location" action now publishes an immediate encrypted location event to the currently visible recipient list instead of only updating local coordinates for the next periodic send.
- Nostrail stop events now fan out to every recipient that received an update during the active session, even if the visible recipient list changed before stopping.
- Location snap area identifiers now use Open Location Code / Plus Code format (`8`-digit neighborhood precision) instead of custom area strings.
