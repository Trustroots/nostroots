# Native iOS App Plan

## Summary

Build a new native SwiftUI iOS app for Nostroots, using `nr-web` as the product and behavior source of truth. The app should live under `nr-web/ios-app` and target iOS 17+ for TestFlight first.

This is not a WebView wrapper and not a direct continuation of `nr-app`. The goal is a native iPhone app that preserves the breadth of `nr-web` while borrowing the useful mobile-native product choices already explored in `nr-app`.

V1 should include the core `nr-web` user flows except Pixel:

- Map and Trustroots map notes
- Key generation, manual key import, and backup flow
- Trustroots NIP-05 identity linking
- Relay settings with NIP-42 support
- Note posting, intents, expiration, deletion, and relay-scope warnings
- Chat
- Public profile, self profile, profile editing, contacts, and claims
- Native push notifications
- Local cache/offline-friendly app state

Pixel is explicitly out of scope for v1.

## Implementation Status (2026-05-15)

Implemented in `nr-web/ios-app`:

- Two native targets in one project: `Nostrail` and `Swiftroots`.
- Shared core modules for key import/signing, NIP-42 auth event creation, NIP-44 encrypted payload flow, relay publish/subscribe wiring, and local storage wiring.
- Shared core NIP-05 resolution now uses live `.well-known/nostr.json` lookup + response/pubkey validation.
- Shared crypto is now routed through an explicit provider interface (`NostrCryptoProviding`) backed by `nostr-sdk-ios` revision `e5855cbd3bdabf44075fd2abdf76f63bac4cbd5f` for secp256k1 pubkey derivation, Schnorr signing, and NIP-44 v2 encryption.
- NIP-44 coverage now includes guarded official decrypt vector coverage for the pinned SDK path, including SDK-provider decrypt, `NIP44Box` routing, and tamper rejection around the verified checksum sample; package-free local builds also assert unavailable-SDK encrypt/decrypt paths fail closed instead of silently using compatibility crypto.
- Location snapping area IDs are now emitted as Open Location Codes (Plus Codes) at neighborhood precision, aligning with existing repo location indexing conventions.
- Relay read/write preference persistence is now wired via `UserDefaultsRelayPreferencesStore`, including runtime toggle updates in `RelayPoolClient`.
- NIP-01 event-id canonicalization and validation are now enforced in shared native code (`NIP01` helper + wire decode validation), with tests for tamper rejection.
- Relay wire decode hardening now enforces sanity bounds for timestamps/content/tags before events enter app state.
- Location-sharing publish path now fans out one encrypted event per recipient (single-recipient `p` tag per event), avoiding multi-recipient encryption mismatch.
- Incoming Nostrail stop events now clear matching peer location records immediately, so stopped sessions disappear from the map before passive expiration.
- Received Nostrail location markers are also pruned on a lightweight service timer, so expired shares disappear even if no new relay event arrives.
- `Nostrail` UI is now map-first: initial current-area prompt, current-location map button, no placeholder location sharing before a real location fix, pending share start after the first successful location fix, visible/cancelable waiting-for-location share state that clears on permission denial with an Open Settings action, visible fixed session end time while sharing, copy-public-address access from the gear menu, clear-key and key-replacement blocking during active/stopping shares, pending-share cancellation before key clear confirmation, immediate encrypted publish to the currently visible recipient list when manually updating shared location, stop fanout to every recipient that received an update during the active session, map invite sheet, multiple recipients, compact main-screen recipient summaries, username/`@username`/Trustroots profile URL/NIP-05/npub/pubkey recipient input with matching field/error copy, one-at-a-time or bulk paste-and-add, actionable recipient-sheet empty copy, partial-success paste feedback, duplicate-recipient canonicalization before and after NIP-05 resolution, partial-success invite/share publishing that keeps successful and unresolved recipients visible with `Sent`/`Updated`/`Check`/`Retry` row states and concise retry guidance, shortened recipient sheet rows with full-value accessibility/copy support, summarized recipient sheet notices that avoid repeating long row values, all-failed invite/share attempts that mark every attempted row as checkable or retryable instead of leaving the user on a generic error, invite retry that skips already-sent rows, uses retry-specific button/status copy, and explains when only pending rows will be sent or when no recipient exists yet, share retry that skips rows already updated for that specific share attempt without letting invite state suppress later sharing, uses retry-specific map CTA/status copy, explains when only pending rows will be sent, and shows an all-current disabled state once every visible recipient has the current share/update, shared test-covered recipient retry state, shorter user-facing recipient lookup errors, invite-sheet send/removal state polish that prunes stale row state after removals, automatic relay readiness, in-flight share/stop button states, and clearer key-import failure feedback.
- Working vertical slice in `Nostrail` UI: key import -> add recipients -> invite publish -> 2-hour session start -> periodic approximate location publishes -> stop session.
- `Swiftroots` shell target with onboarding/settings/profile/chat navigation plus a useful Home summary sharing the same core services, including labeled selectable Home/Profile/Chat/Settings identity with middle-truncated public addresses plus Home/Settings relay/sharing state, tab-scoped Home/Profile/Chat/Settings status feedback, Home/Profile/Chat/Settings copy-handle and Home/Profile/Settings copy-public-address actions, Home/Profile/Settings links to the existing Trustroots profile with opening feedback, Home/Settings Check Relays actions with user-facing feedback and unavailable-relay next-step helpers, clearer Profile readiness and Chat coming-next empty states tied to verified identity, Settings identity display, visible public address, key status, clear-key actions, and direct stop-sharing actions when active sharing blocks key clearing/replacement.
- Compile gate passing for both app targets, plus test-target build compile (including relay preference persistence tests).

Current constraints:

- Compatibility HMAC/AES crypto remains available only as a fallback provider and for decrypting prior `NIP44COMPAT:v2/v3` local test payloads.
- Xcode package resolution is currently blocked in this sandbox because SwiftPM cannot write its manifest diagnostics cache / apply its package sandbox; the selected `nostr-sdk-ios` revision itself was verified with `swift build --disable-sandbox`.
- Local package-free compile checks are available via `NR_USE_NOSTR_SDK_PACKAGE=0 ruby scripts/generate_xcodeproj.rb`; that mode uses an explicit throwing fallback and is not a production runtime mode.
- Relay ACK handling now has timeout-based failures to avoid indefinite publish/auth hangs.
- Failed relay connection checks now reset shared connection state and expose friendly "Could not connect" status instead of leaving partial connection state behind.
- Relay flow is now real WebSocket + NIP-42 challenge/auth, with relay pooling and reconnect/subscription replay baseline now implemented.
- Relay pool connection now fails immediately with a user-facing "could not reach any enabled relay" error when all enabled relays are unreachable, while still allowing partial relay availability.
- Relay pool now rejects no-readable subscriptions explicitly and only subscribes/publishes against relays enabled for that direction, with tests for read/write disabled behavior.
- Relay/connect/publish failures now map technical relay diagnostics to plain recovery copy in app UI, while tests keep the detailed diagnostic path covered.
- Relay publish/stop/invite failures now clear cached relay-ready state through one shared service helper so the next user action reconnects instead of trusting a stale session.
- Relay send/stop failures now also clear persisted recent-check history, so stale "relays reachable" text disappears until relays are checked again.
- Active sharing now pauses automatic periodic publishes after a background send failure, shows Nostrail map copy that updates are paused, and resumes the timer after a successful reconnect or manual location update.
- Partial invite/share fanout failures now keep successful recipients active while showing concise "updated/started, reconnect then retry N people" status instead of collapsing partial success into a total send failure.
- Nostrail and Swiftroots reconnect buttons now share bounded backoff and "Try Again Soon" wait copy across map/settings/sheet recovery flows, with shared core timing/wait-text coverage; Swiftroots relay checks also clear their running state after successful checks.
- Relay receive-loop endings now clear cached relay-ready state and show plain reconnect guidance instead of leaving the app looking connected after subscriptions stop.
- Swiftroots Home/Settings now turn that stopped-receiving state into "Reconnect" status, helper text, and button copy so users have an obvious next action.
- Swiftroots Home/Settings now also turn send/connect relay failures into reconnect status, helper text, and sharing-prep blocking copy instead of showing stale ready-to-share guidance.
- Multi-recipient invite/share reporting now preserves successful relay fanout recipients and returns failed recipients for row-level retry when one publish fails after another succeeds.
- All-failed multi-recipient relay fanout now also returns row-level retry state instead of collapsing into a generic throw in the reporting APIs.
- Nostrail now keeps lookup failures and relay-send failures separate in recipient results, showing bad inputs as `Check` rows and connection/send failures as `Retry` rows with "when your connection is back" copy.
- Nostrail invite retry actions now use retry-specific button/status/helper copy, so relay-send failures read as a retry flow instead of a fresh invite send and already-invited recipients are clearly protected from duplicate invites.
- Nostrail share retry actions now also use retry-specific map CTA/status copy for failed sharing starts and failed location updates.
- Nostrail now shows a plain Reconnect action in the map status panel after stale relay streams or send/connect failures, letting people restore relay readiness before retrying pending invites or location updates without exposing relay-auth wording.
- Nostrail Reconnect success copy now matches the prior relay problem, so stopped receiving, send failures, and initial connection failures each return a clearer next step.
- Nostrail Reconnect success copy now also uses the shared receive/share relay-path guidance after partial recovery, avoiding overclaiming that both directions are usable.
- Nostrail map and Relay Settings reconnect actions now show a short Try Again Soon cooldown after failed relay reconnects, reducing repeated taps while the relay path is still failing.
- Nostrail recipient-sheet relay failures now mark affected invite rows as retryable and use direct "Reconnect, then retry" copy instead of leaving users on a generic send error.
- Nostrail share/update relay failures now use the same retry-row recovery path as invites, while relay settings problems such as sharing being turned off still surface as settings/action copy instead of a misleading retry.
- Nostrail recipient rows with `Check` or `Retry` state now include a short second-line hint, so people know whether to edit/remove a bad recipient or reconnect before retrying.
- Nostrail `Check` rows now include a visible edit action that moves the bad recipient back into the input field and focuses it for correction.
- Nostrail recipient sheets now show a direct Reconnect button whenever invite rows are marked `Retry`, then hide it and switch the pinned helper/status to retry rows marked `Retry` after reconnect succeeds.
- Nostrail recipient-sheet reconnect now waits for the actual relay reconnect result and can show the same limited receive/share relay-path guidance as the map status.
- Nostrail recipient sheets now keep retry-send actions disabled after reconnect when sharing still has no reachable relay, while leaving the reconnect action available and offering a direct Relay Settings path.
- Nostrail now exposes Relay Settings from its gear menu and from blocked recipient retries, with per-relay Receive/Share toggles, last-check feedback, and the same last receiving/sharing confirmation guard as Swiftroots.
- Nostrail now returns people from blocked retry recovery back to the recipient sheet after Relay Settings closes, and changed relay settings keep retry rows in explicit "Reconnect/check first, then retry rows marked Retry" guidance until a real relay check restores the sharing path.
- Nostrail now surfaces sharing-off relay settings directly in the map status panel with an Open Relay Settings action, and blocks ready-to-send sharing attempts before they become relay errors.
- Nostrail Relay Settings now highlights relays whose Share toggle can restore sending, so sharing-off recovery is visible at the exact row people need to change.
- Nostrail Relay Settings now marks relay toggles as changed and prompts a reconnect/check before treating older reachability text as current.
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
- Nostrail share retry controls now show an all-current disabled state when every visible recipient already received the current sharing start/location update, including after failed rows are removed from a partial retry.
- Nostrail recipient-sheet sharing controls now use that same all-current disabled state and pending-update helper copy, preventing a no-op Share Current Area tap after all visible recipients already have the latest update.
- Successful Nostrail share/update sends now keep visible recipients marked current during the active session, while stopping sharing clears that transient current-state guard.
- Nostrail now clears that current-recipient guard only when iOS reports a different snapped area during active sharing, so real movement re-enables Share Current Area without GPS jitter causing duplicate prompts; the status copy explains that periodic updates will still happen automatically.
- Nostrail's map recipient control now uses clearer Add People/count copy so opening the recipient sheet does not look like an immediate send.
- Nostrail's empty share CTA now says Add People to Share, matching the map recipient control.
- Nostrail recipient removal now prunes stale Sent/Check/Retry state and returns the invite sheet to a plain empty state when the last recipient is removed.
- Nostrail's disabled invite action now explains that at least one recipient is needed.
- Nostrail all-failed invite/share fanout is now retry-tested end to end: failed rows stay actionable, relay readiness is reacquired automatically, and the next send can succeed without re-entering recipients.
- Failed initial share publishes now roll back active session state so the app does not claim sharing started when no update was sent; failed stop publishes pause periodic updates while keeping the session retryable with stop-specific reconnect/retry copy.
- Recipient-targeted location updates now fail fast with the plain no-session message before doing recipient resolution when no sharing session is active.
- Stop actions now detect locally expired sessions before relay work, clear stale sharing state, and avoid publishing unnecessary stop events.
- Nostrail action error copy now preserves the explicit "Sharing session expired." status in the UI instead of collapsing expired sessions into generic no-session copy.
- Nostrail clears share/update row-current state and stale share retry notices when sharing ends or expires, so selected people are available for the next Start Sharing flow instead of staying marked `Updated`; invite-sent state is preserved.
- Swiftroots Settings now shows plain relay availability, including all-off, receiving-off, and sharing-off states, includes per-relay Receive/Share toggles with plain per-relay descriptions and last-check feedback backed by persisted relay preferences, clears stale check results when relay toggles really change while preserving recent relay-check confidence on no-op toggle requests, and asks for confirmation before turning off the last receiving or sharing path.
- Swiftroots Home/Settings connection status now uses user-facing copy for connected, ready, no-relays, all-off, receiving-off, and sharing-off relay states.
- Swiftroots Home/Settings now render that connection status through one shared view, keeping relay check buttons, changed-settings prompts, and helper text aligned.
- Swiftroots Home now replaces placeholder map/session rows with real identity, relay, active-sharing, restored recipient context, active-session current-area updates that distinguish restored vs newly added people while preserving the full active recipient set after additive updates, opening Start Sharing with an initial current-area prompt when no location is ready, keeping successful update confirmations visible in the sheet with an explicit Done completion state, clearing that completion state when recipients are edited again or a pending location request starts/fails, offering in-sheet Settings recovery when location permission is off, relabeling retryable location failures as Try Location Again without clearing selected people, and letting people cancel a pending location request without losing selected people or auto-sharing after a late location callback; late fresh-location callbacks now replace stale cancel/error copy with current-area-ready status, plus session-expiry, fresh-location, and standalone status summaries, direct copy-handle, Trustroots profile, Check Relays, and Stop Sharing actions; Profile now shows a verified-identity readiness state while editing/contacts/claims remain pending; Chat now uses a clear coming-next empty state, shows the verified messaging identity, and can copy that handle while full messaging remains pending.
- Swiftroots Home now distinguishes active, ending-soon, and expired sharing sessions and changes the stop action to "Clear Expired Sharing" when the stored session has already ended.
- Swiftroots Stop Sharing recovery copy now separates expired-session cleanup, already-stopped sessions, and relay failures so Home/Settings point to the right next step, including reconnecting and retrying Stop Sharing after stop publish failures.
- Swiftroots Home/Settings now show sharing readiness based on relay settings, changed relay preferences, and the last relay check, so people see "fix/check relays first" guidance before sharing.
- Swiftroots Home and Settings now share one sharing-status view, keeping session state, readiness, received-location count, and Stop Sharing recovery aligned.
- Swiftroots Home and Settings now have an honest Prepare/Start Sharing action that routes people to relay fixes first and only reports the recipient flow as coming next once relays are ready.
- Swiftroots Start Sharing now opens a native people picker, accepts the same Trustroots handle/profile-link/NIP-05/npub/pubkey formats as Nostrail, requests a current approximate area before publishing, and reports per-person check/retry states for partial sharing failures.
- Swiftroots Start Sharing retry rows now offer an in-sheet Reconnect action and a direct jump to Settings when relay checks still show no sharing path.
- Swiftroots Start Sharing now remembers relay-settings recovery from retry rows and returns people to the sheet after a successful Check Relays pass, keeping pending retries visible.
- Swiftroots Start Sharing relay-settings recovery now separates "check relays first" from "sharing still has no reachable relay" copy, so entering Settings, failed checks, successful return-to-sheet flows, and blocked retry-sheet helper copy all point at the explicit retry action.
- Swiftroots relay rows now add retry-recovery hints for failed Share relays and reachable receive-only relays, pointing people to the exact row that can restore Start Sharing.
- Swiftroots Relay Settings now shows a retry-specific Start Sharing recovery hint when people arrive from blocked retry rows, including empty/all-off relay states that have no row-level fix to highlight.
- Nostrail and Swiftroots Relay Settings now include an Add Relay field backed by shared URL normalization and persisted custom relay storage, so empty or weak relay setups can be fixed in-app.
- Nostrail and Swiftroots Relay Settings now let people remove custom relays while protecting built-in relays as toggle-only, making typo/dead-relay cleanup possible without clearing all settings.
- Nostrail and Swiftroots Relay Settings now include a Restore Default Relays action that removes custom relays, restores built-in Receive/Share defaults, and marks reachability stale until the next check.
- Nostrail and Swiftroots Relay Settings now confirm custom relay removal and default-restore actions before applying destructive relay-list changes.
- Nostrail and Swiftroots Relay Settings failures now use shared action-specific recovery copy, including Add Relay retry guidance, duplicate-relay guidance, Remove Relay retry/refresh guidance, bundled-relay fallback copy, and built-in relay removal guidance that points people to Receive/Share toggles.
- Nostrail and Swiftroots relay summaries and Relay Settings now show Receive/Share-specific recovery copy on failed per-relay checks, including after routine reconnect checks and repeated failures, so people know when a relay keeps failing and whether to turn it off or add another relay for that direction. Per-relay failure counters persist across fresh relay pool instances and clear after successful checks or relay/key resets; reconnect/check cooldowns now use those repeated failure counts when available and explain longer waits in helper text.
- Nostrail and Swiftroots recent relay-check summaries now switch to day-based age text and prompt a fresh Check Relays pass once the saved result is stale, so old "relays reachable" copy does not look current or keep driving active-sharing decisions.
- Relay add, toggle, removal, and restore-default changes now reset stale relay auth/subscription runtime, preventing old receive subscriptions from replaying after settings change.
- Relay setting edits now clear persisted per-relay failure counters across toggle/add/remove/restore paths, so a fixed relay setup gets a fresh reconnect cooldown instead of inheriting stale repeated-failure backoff.
- Swiftroots Start Sharing button/helper/retry decisions now live in shared formatter logic with native test coverage.
- Swiftroots Start Sharing result and helper copy now distinguish a new sharing session from sharing the current area with added people, including location-waiting, all-current, partial, and all-failed retry states.
- Swiftroots now disables the Check Relays action when all relays are off or none are configured, and shows direct "turn on" vs "add" next-step copy.
- Swiftroots Check Relays now summarizes reachable vs failed relays after each check, while per-relay rows keep the detailed last-check state.
- Swiftroots Home/Settings now mark relay toggles as changed and prompt a fresh relay check before treating older reachability text as current.
- Swiftroots relay rows now point people to the specific Receive or Share toggle needed to restore location updates.
- Swiftroots reconnect checks now return reconnect-specific success/failure copy after relays stopped receiving, instead of making the recovery look like a routine relay check.
- The shared relay-check history now preserves that reconnect context too, so Home/Settings recent-check summaries do not regress to routine check wording after recovery.
- Partial relay checks now carry each relay's receive/share role into the summary, so Swiftroots can say when receiving still works but sharing has no reachable relay, or the reverse.
- Swiftroots failed relay checks now apply a short visible retry pause with "Try Again Soon" copy, avoiding rapid repeated reconnect attempts.
- The shared location service now stores the most recent relay-check summary after automatic or manual relay connection attempts; Swiftroots shows it in Home/Settings and Nostrail shows it in the map status panel, and the summary clears when relay settings or the local key change.
- Key import, generation, and clear now also reset relay auth/subscription runtime, stale per-relay reachability rows, and persisted relay failure counters, so a new local identity does not inherit old relay-check details or receive paths.
- Received-location storage now has a bounded `UserDefaults` implementation for native app relaunches, with replace-by-id, expiration pruning, per-peer stop cleanup, and clear-all behavior covered by native tests.
- Active Nostrail sharing sessions now persist session id, expiry, encrypted recipients, recipient display values, stop recipients, and latest approximate coordinate, restoring valid sessions after relaunch with automatic updates paused until relays reconnect, visible recipient context plus restored-state map copy, Share Current Area updates without re-entering recipients, and expired-session cleanup on startup.
- Restored active sharing now clears any persisted relay-check summary during relaunch, so Home/Settings and map panels do not show stale "relays ready" confidence while the restored session still needs reconnecting.
- Failed reconnects from restored active sharing now keep the restored-session recovery path visible, telling people to reconnect relays before using Share Current Area instead of falling back to generic connection failure copy.
- Partial reconnects from restored active sharing now distinguish Receive-only vs Share-capable relay access, sending people to Relay Settings before Share Current Area when sharing has no reachable relay.
- Active sharing panels now surface that same relay warning beside session controls, so Share Current Area is paired with a Relay Settings next step whenever the latest relay check says sharing cannot reach a relay.
- Active sharing sheets now carry that warning into Nostrail Recipients and Swiftroots Start Sharing, disabling Share Current Area and offering Relay Settings when the current relay path cannot publish; relay settings edits suppress stale active-sharing warnings until relays are checked again, and the shared sheet-blocking rule is covered by native formatter tests.
- Stop Sharing recovery now notices relay settings edits after a failed stop publish, replacing stale retry guidance with Reconnect/Check Relays first copy before Retry Stop Sharing; Nostrail and Swiftroots Relay Settings status/action copy now stays stop-retry-specific while that recovery is pending.
- Stop Sharing retry state now survives relay availability status refreshes after settings edits, so the action stays labeled Retry Stop Sharing until the stop notice succeeds or the session is cleared.
- Shared onboarding now preserves that same Stop Sharing retry state before key replacement, so setup screens do not imply a key can change while the old session still needs a stop retry.
- Key storage now has an explicit confirmed clear path across the shared `KeyStore` boundary, including Keychain deletion and app runtime reset state for logout/reset flows.
- Key status copy now distinguishes real device storage from local simulator test storage with test coverage, so unsigned simulator runs do not sound like production Keychain storage.
- Nostrail clear-key confirmation copy now lives in the shared key lifecycle helper with test coverage, matching the other destructive key-removal guard copy.
- Clear-key now uses the same full runtime reset path as key import/replacement, including cached location, relay/session tasks, received-location storage, and app-level relay recovery sheets/confirmation state.
- Importing, generating, or clearing keys now respects active sharing state: replacement resets relay/session runtime and clears prior received-location markers when allowed, while active sharing blocks clearing/replacement until the session is stopped.
- App-build key storage uses iOS Keychain with device-only accessibility for imported Nostr secret material; simulator-only fallback storage is limited to unsigned local runs when Keychain access is unavailable.
- Accepted key imports are normalized to private-key hex before reaching the `KeyStore` boundary, so raw mnemonic/nsec text is not handed to storage.
- Keychain save/update/delete failures now include safer recovery copy that says whether no key was stored, an existing key was unchanged, or a key may still be on the device, while preserving OSStatus diagnostics.
- `Swiftroots` now gates the app behind first-run onboarding until a key and Trustroots username verified for that exact pubkey are present, with shared native generate/import paths, one-tap paste-and-import, repo-compatible mnemonic import, username normalization that also accepts pasted Trustroots profile URLs, a one-tap paste-and-verify action for the username/link step, direct npub-to-Trustroots recovery copy when the username is missing or points to another key, plain retry copy for verification/network failures, nsec backup confirmation, npub/nsec guidance, stale-link clearing after key changes, a confirmed "use a different key" recovery path during linking, and automatic return to onboarding after key clear.
- Swiftroots onboarding now clears the stored linked pubkey immediately when the user chooses a different key, uses shared tested defaults normalization to trim/remove blank saved username/pubkey state, and shows a recovery notice when a stale Trustroots link is reset while preserving more specific key-clear success copy.
- Swiftroots Settings clear-key confirmation now explicitly says the local Trustroots link will be removed before returning to setup, active-share blocking copy explains that stopping first lets Swiftroots tell people the session ended, and save/stop/clear failures now keep users oriented that the key and local Trustroots link remain as-is until they retry; Clear Key failures also use this same recovery copy from Settings, while relay-add failures keep plain relay input errors.
- Shared onboarding Stop Sharing failures now make the active-session recovery explicit before key replacement, confirming the key remains as-is and, in Swiftroots, that the local Trustroots link remains as-is until Retry Stop Sharing succeeds.
- Shared onboarding now uses the same Stop Sharing recovery wording as the main apps, including Retry Stop Sharing after failed stop publishes and Clear Expired Sharing for expired Swiftroots sessions before key replacement.
- Shared onboarding now uses app-specific key replacement confirmation copy, so Swiftroots warns that the local Trustroots link will be removed while Nostrail keeps the shorter setup-return warning.
- Clear-key completion now includes the resulting storage state, and main-app clears carry that success notice back into onboarding so people can see that no key remains stored before setting up another key.
- Generated-key save completion now says the generated key was saved before showing the storage state, making the backup-confirmation flow end in a clearer success message.
- Generated-key creation failures now use shared onboarding recovery copy with a direct Generate Key retry instruction instead of raw local error text.
- Onboarding and in-app Keychain save/delete failures now append the exact retry action (`Import Key`, `Save Key`, or `Clear Key`) while leaving normal validation errors unchanged; Swiftroots save failures also confirm the local Trustroots link was not changed.
- Shared native onboarding now uses tested status-clearing logic, so empty-clipboard, Trustroots helper, copied-nsec/npub, opening-link prompts, paste/import, paste/verify, Save Key, Clear Key, and parent recovery notices clear as soon as the user starts the next setup action instead of lingering; switching between Generate and Import also clears the hidden draft/input for the abandoned setup path, and generated-key drafts are cleared from view state immediately after a confirmed save.
- Full simulator test execution is blocked in this environment by CoreSimulator runtime mismatch.

## Implementation-Backed Backlog

Priority order for next implementation passes:

1. Harden production crypto and signing:
   - Keep the default path on pinned `nostr-sdk-ios` secp256k1/Schnorr/NIP-44 v2 and remove compatibility crypto once old local payloads no longer need migration support.
   - Expand beyond the current guarded official NIP-44 checksum sample into broader strict cross-client interoperability verification.
2. Harden relay runtime:
   - Expand relay pool read/write controls UX and operational behavior. (baseline persistence now implemented)
   - Add richer reconnect telemetry, backoff tuning, and deeper relay health reporting beyond the current shared last-check summary.
3. Persisted storage and onboarding hardening:
   - Continue auditing Keychain-backed storage behavior beyond the current import/replace/clear lifecycle and native onboarding gate coverage.
   - Expand Trustroots identity linking from the current lightweight NIP-05 verification step into full profile/link publishing parity.
   - Add persisted local event cache (GRDB/SQLite) and expiration pruning.
4. Product surface expansion in `Swiftroots` target:
   - Implement real profile, contacts/claims, chat, and map-note flows.
   - Add relay settings UI and deletion/expiration/user safety flows from `nr-web`.
5. Notifications track:
   - Implement APNs path and update notification schema/daemon integration.

## Key Decisions

- Platform: SwiftUI, iOS-first.
- App home: `nr-web/ios-app`.
- Minimum OS: iOS 17+.
- Release target: TestFlight first.
- Map stack: Apple MapKit, Trustroots-only for v1.
- Nostr stack: shared native core with pinned `nostr-sdk-ios` for production crypto, wrapped behind local provider interfaces.
- Local cache: SQLite via GRDB.
- Key storage: iOS Keychain.
- Existing web key migration: manual nsec or mnemonic import only.
- Push notifications: APNs in v1, requiring notification schema/daemon work.
- Remote signing/NIP-46: defer for v1.
- Source of truth when behavior differs: `nr-web` wins.

## Why SwiftUI

SwiftUI is the best fit if the product goal is a genuinely native iOS app rather than a fast mobile shell. It gives the app first-class Apple navigation, sheets, permissions, push notifications, Keychain integration, MapKit, accessibility, and App Store expectations.

The tradeoff is that much of the JavaScript UI has to be rebuilt. That is acceptable here because the chosen direction is iOS-first and native, not shared-code parity with Android.

Expo/React Native remains valuable context because `nr-app` already explored several mobile product decisions. Capacitor or WKWebView would be useful only for a quick wrapper prototype, not for the intended app.

## `nr-web` As Source Of Truth

`nr-web` is broader and more current as the product reference. The SwiftUI app should preserve its behavior unless there is a strong native reason to adjust presentation.

Important `nr-web` behavior to carry forward:

- Default relay model: `wss://nip42.trustroots.org`, `wss://relay.trustroots.org`, and `wss://relay.nomadwiki.org`.
- Per-relay read/post controls and relay status.
- NIP-42 auth relay read/write behavior.
- Map note intents.
- NIP-40 expiration, including saved/default expiration preference.
- Own-note deletion through kind 5 deletion events.
- Private key leak guard for nsec content in notes and chat.
- Relay-scope warnings for private/public publishing.
- Chat, including encrypted DMs and circle/channel conversations.
- Public profile routes, self profile, edit profile, and contacts/claims.
- Trustroots claim/contact signing flows.
- Existing tests and fixtures around routing, notes, deletion, expiration, claims, profiles, notifications, and relay publishing.

## Lessons From `nr-app`

`nr-app` is narrower than `nr-web`, but it has useful native-mobile behavior that should influence the SwiftUI app.

Carry forward:

- Welcome screen and first-run onboarding.
- Key setup flow with generate/import options.
- Trustroots NIP-05 linking as part of setup.
- Backup confirmation for generated keys.
- Secure device storage for secrets.
- Native push registration and notification tap handling.
- Native map ergonomics: location button, persisted map region, and bottom sheets.
- Subscribe-after-post prompt for map areas, adapted to APNs.
- System/light/dark appearance preference.
- Developer/debug controls, but hidden from normal users.

Do not carry forward for v1:

- Extra experimental map layers: Hitchmap, Hitchwiki, Time Safari, Trip Hopping, Unverified.
- The prototype NIP-46 connect screen. It appears dev-only and uses a hardcoded mnemonic.
- The simplified single-relay default from `nr-app`.

## Architecture

Create a SwiftUI app with explicit service boundaries:

- `KeyStore`: Keychain-backed key generation, nsec import, mnemonic import, export, backup confirmation, public key derivation, and event signing.
- `RelayPool`: relay configuration, relay status, per-relay read/write flags, NIP-42 auth, reconnects, subscriptions, and publishing acknowledgements.
- `EventStore`: GRDB-backed cache for Nostr events, replaceable event handling, parameterized replaceable event handling, deletion filtering, expiration filtering, and seen-on-relay metadata.
- `MapService`: visible plus-code calculation, Trustroots map note filters, selected area state, and MapKit annotation/overlay projection.
- `ProfileService`: kind 0 metadata, kind 10390 Trustroots profile events, NIP-05 lookup, image safety, profile editing, and claim/profile aggregation.
- `ChatService`: conversation list, encrypted DM/circle messages, message cache, deletion state, search/indexing, and unread state.
- `NotificationService`: APNs registration, encrypted notification subscription event publishing, local notification routing, and notification deep links.
- `SettingsStore`: app preferences, relay settings, appearance, onboarding completion, backup state, and debug flags.

Use Swift models that mirror `nr-common` event schemas and constants. Keep wire compatibility with existing relays and daemons.

## Notifications

`nr-app` currently uses Expo push tokens in kind `10395` notification subscription events. A SwiftUI app should use APNs tokens, so v1 needs backend support.

Implementation direction:

- Keep kind `10395` as the user-owned notification subscription event.
- Extend the encrypted payload to support APNs device tokens while preserving legacy Expo token compatibility.
- Update the notification daemon to deliver APNs notifications.
- Preserve existing subscription filter semantics for plus-code based notifications.
- On notification tap, route into the relevant map area and event detail.

## Native UI Direction

Use native iOS patterns, not web layout translated literally:

- Map is the primary screen.
- Area details open in native sheets.
- Posting uses a native composer sheet.
- Settings use grouped SwiftUI forms.
- Onboarding uses a step-based native flow.
- Profiles and chat use native navigation stacks.
- Relay controls should be clear but not overly technical for normal users.

Map v1 is Trustroots-only. Extra layers can be revisited after the app has stable map, notes, chat, profiles, and notifications.

## Test Plan

Start with spec and protocol tests before broad UI tests.

Port or mirror these `nr-web` test areas into XCTest:

- Hash/route classification as native deep-link routing cases.
- Key parsing and nsec leak detection.
- Note intents.
- Expiration and deletion behavior.
- Claim/contact summary logic.
- Profile field normalization and display projection.
- Notification payload validation.
- Relay publishing success/failure behavior where feasible.
- NIP encryption/signing test vectors supported by the Swift Nostr SDK.

Add XCUITest smoke flows for:

- Onboarding with generated key and backup confirmation.
- Manual nsec/mnemonic import.
- Trustroots identity linking.
- Map load and area selection.
- Note post, note delete, and note expiration display.
- Chat list and message send/read.
- Public profile, self profile, edit profile, and contacts.
- Relay settings.
- APNs registration and notification tap routing.

## Open Follow-Ups

- Confirm the final bundle identifier before TestFlight.
- Choose the exact Swift Nostr SDK version and audit its NIP-42/NIP-44 behavior against Nostroots relays.
- Design the APNs extension to kind `10395` and update the notification daemon.
- Decide how much of `nr-common` should be mirrored manually in Swift versus generated from schemas.
- Define the first TestFlight acceptance checklist.
