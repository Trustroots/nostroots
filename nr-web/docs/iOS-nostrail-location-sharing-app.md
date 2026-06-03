# Nostrail: KISS Native iOS Plan

## Summary

Build `Nostrail`, a tiny native Swift iOS app for temporary encrypted location sharing between Trustroots-verified Nostr users.

## Implemented This Sprint (2026-05-15)

Built in `nr-web/ios-app`:

- Native `Nostrail` SwiftUI target with map + session controls.
- Shared core service layer used by both `Nostrail` and `Swiftroots` targets.
- Implemented flow:
  - import key (`hex` and checksum-validated `nsec`)
  - derive pubkey
  - connect/authenticate relay client as part of invite/share actions
  - publish encrypted invite/location/stop payloads to one or more recipients
  - apply expiration tag filtering
  - publish periodic session updates (5-minute interval) and manual stop
- Nostrail UI is now map-first:
  - app opens to key onboarding when no key is stored, instead of showing map/sharing controls early
  - shared native onboarding supports generate/import modes, one-tap paste-and-import, and generated-nsec backup confirmation
  - first map view now prompts people to choose their current approximate area before sharing
  - current-location button on the map
  - no current-area marker or sharing session start until iOS returns a real location fix
  - if the user starts sharing before location is ready, Nostrail now shows a cancelable waiting state, remembers the intent, starts after the first successful location fix, cancels cleanly when location permission is denied, and offers an Open Settings action
  - sharing sessions now keep a fixed session end time instead of extending on every periodic update, and the app shows that end time while sharing
  - manual "Update Shared Location" now publishes an immediate encrypted location event to the currently visible recipient list instead of only refreshing local coordinates
  - incoming peer stop events remove the matching active map marker immediately instead of waiting for passive expiration
  - expired received-location markers are pruned on a lightweight service timer even when no new relay event arrives
  - map Add People/count button opening a recipient sheet
  - empty share CTA says Add People to Share, matching the map recipient language
  - recipient sheet includes a visible Start Sharing section after people are added
  - multiple recipients per invite/share session
  - recipient input accepts bare Trustroots usernames, `@username`, pasted Trustroots profile URLs, `name@domain` NIP-05 handles, `npub1...`, or raw pubkey hex, with matching field/error copy, service-level profile-link resolution coverage, and one-at-a-time entry or comma/space/newline-separated paste-and-add with partial-success feedback
  - duplicate recipient inputs are canonicalized before sending, so `alice`, `@alice`, and `alice@trustroots.org` do not become separate invite targets
  - recipient resolution deduplicates both canonical input aliases and resolved pubkeys before encrypted invite/share fanout
  - invite sends support partial success, leaving unresolved recipients in the sheet with correction feedback after valid recipients are published
  - share start/update actions also support partial success, publishing to resolved recipients and reopening the sheet for unresolved entries
  - all-failed invite/share attempts now mark every attempted row as checkable or retryable instead of leaving the user on a generic error
  - partial-failure and recipient lookup errors now use shorter user-facing copy with direct check/retry guidance instead of protocol-oriented resolution wording, and malformed recipient input avoids duplicate format help
  - successful and unresolved recipients stay visible after partial success, with invite rows marked as `Sent`, share-update rows marked as `Updated`, bad-input rows marked as `Check`, and relay-send rows marked as `Retry` with retry-specific button/status copy
  - recipient sheet rows shorten long public keys/npubs for small screens while keeping the full recipient available to accessibility and copy
  - recipient sheet empty state now explains supported Trustroots handle/profile-link/key formats before inviting or sharing
  - recipient sheet notices summarize `Check`/`Retry` failures without repeating long recipient names already shown in the rows
  - invite retries show helper text explaining that only pending invite rows will be sent, reassure that already-invited recipients will not get duplicate invites, and all-sent sheets explain that everyone selected has already been invited
  - invite retries only resend unresolved or newly added rows, avoiding duplicate sends to entries already marked `Sent`
  - share retries only resend unresolved or newly added rows for that specific share update, while earlier invite `Sent` state does not suppress later location sharing
  - recipient retry state is now shared core logic with tests for invite retry, share-update retry, and successful-state clearing
  - invite sheet send/removal states are count-aware, block edits/dismissal while sending, and clear stale correctable errors as the user edits
  - main-screen recipient summaries stay compact, showing the first selected people and a `+N more` count while shortening long public keys
  - share/update/stop controls show in-flight state and disable competing actions while relay work is running
  - gear menu can copy the current public address before the destructive clear-key action
  - clear-key is blocked while sharing is active or stopping, so the app can publish a stop event before key removal
  - key import/generation is also blocked at the shared service boundary during an active sharing session, preventing accidental identity replacement before a stop event can be sent
  - pending share start is canceled before showing the clear-key confirmation, preventing a late location fix from starting sharing during key removal
  - clear-key actions require confirmation before removing the device key and returning to setup
  - key import errors now distinguish npub-vs-nsec, invalid nsec, bad hex, and invalid recovery phrase input
  - stop events now fan out to every recipient that received an update during the active session, even when the visible recipient list changed before stopping
- Approximate location snapping at neighborhood-scale granularity (~500m default).
- Location area identifiers now use Open Location Code / Plus Code format (8-digit neighborhood precision) instead of custom `A...` area strings.
- NIP-05 lookup now uses live `.well-known/nostr.json` resolution with response/pubkey validation.
- Location sharing publish now fans out one encrypted event per recipient (`p` tag), preventing recipient-encryption mismatch.
- Key storage is Keychain-backed with device-only accessibility in app builds; simulator-only fallback storage exists solely to keep unsigned local simulator runs usable when Keychain access is unavailable.
- Native key import now accepts repo-compatible BIP-39 recovery phrases and derives the private key using the same first-32-bytes-of-seed rule as `nr-web`.
- Accepted imports are normalized to private-key hex before reaching the `KeyStore` boundary, so storage never receives raw mnemonic/nsec text from the app service.
- Crypto flow now routes through a shared `NostrCryptoProviding` boundary backed by `nostr-sdk-ios` revision `e5855cbd3bdabf44075fd2abdf76f63bac4cbd5f` for secp256k1 pubkey derivation, Schnorr event signing, and NIP-44 v2 encryption.
- NIP-44 coverage now includes guarded official decrypt vector coverage for the pinned SDK path, including SDK-provider decrypt, `NIP44Box` routing, and tamper rejection around the verified checksum sample; package-free local builds also assert unavailable-SDK encrypt/decrypt paths fail closed instead of silently using compatibility crypto.
- XCTest compile coverage for key paths: import, auth-event shape, payload codec, expiration checks, relay flow wiring, and location snapping.

Known prototype constraints in current code:

- Compatibility HMAC/AES crypto remains available only as a fallback provider and for decrypting prior `NIP44COMPAT:v2/v3` local test payloads.
- Xcode package resolution is currently blocked in this sandbox because SwiftPM cannot write its manifest diagnostics cache / apply its package sandbox; the selected `nostr-sdk-ios` revision itself was verified with `swift build --disable-sandbox`.
- Local package-free compile checks are available via `NR_USE_NOSTR_SDK_PACKAGE=0 ruby scripts/generate_xcodeproj.rb`; that mode uses an explicit throwing fallback and is not a production runtime mode.
- Relay pool baseline is now in place with persisted relay read/write preferences; richer health/telemetry behavior is still pending.
- Relay pool connection now fails immediately with a user-facing "could not reach any enabled relay" error when all enabled relays are unreachable, while still allowing partial relay availability.
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
- Nostrail invite retry actions now use retry-specific button/status copy, so relay-send failures read as a retry flow instead of a fresh invite send.
- Nostrail share retry actions now also use retry-specific map CTA/status copy for failed sharing starts and failed location updates.
- Nostrail now shows a plain Reconnect action in the map status panel after stale relay streams or send/connect failures, letting people restore relay readiness before retrying pending invites or location updates without exposing relay-auth wording.
- Nostrail Reconnect success copy now reflects whether relays had stopped receiving, failed to send, or failed initial connection, giving people the next step that actually fits.
- Nostrail Reconnect success copy now also reflects limited receive/share relay paths after partial recovery, so the map status does not imply both directions work when only one does.
- Nostrail map and Relay Settings reconnect actions now show a short Try Again Soon cooldown after failed relay reconnects, reducing repeated taps while the relay path is still failing.
- Nostrail recipient-sheet relay failures now mark affected invite rows as retryable and use direct "Reconnect, then retry" copy instead of leaving users on a generic send error.
- Nostrail share/update relay failures now use the same retry-row recovery path as invites, while relay settings problems such as sharing being turned off still surface as settings/action copy instead of a misleading retry.
- Nostrail recipient rows with `Check` or `Retry` state now include a short second-line hint, so people know whether to edit/remove a bad recipient or reconnect before retrying.
- Nostrail `Check` rows now include a visible edit action that moves the bad recipient back into the input field and focuses it for correction.
- Nostrail recipient sheets now show a direct Reconnect button whenever invite rows are marked `Retry`, then hide it and switch the pinned helper/status to retry rows marked `Retry` after reconnect succeeds.
- Nostrail recipient-sheet reconnect now awaits the real relay reconnect result before showing recovery copy and includes limited receive/share relay-path guidance when recovery is partial.
- Nostrail recipient sheets now disable retry-send actions after reconnect when sharing still has no reachable relay, while keeping Reconnect available and offering a direct Relay Settings path for relay-setting fixes.
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
- Nostrail share retry controls now show an all-current disabled state with a next-step hint when every visible recipient already received the current sharing start/location update.
- Nostrail recipient-sheet sharing controls now use that same all-current disabled state and pending-update helper copy, preventing a no-op Share Current Area tap after all visible recipients already have the latest update.
- Successful Nostrail share/update sends now keep visible recipients marked current during the active session, while stopping sharing clears that transient current-state guard.
- Nostrail now clears that current-recipient guard only when iOS reports a different snapped area during active sharing, so real movement re-enables Share Current Area without GPS jitter causing duplicate prompts; the status copy explains that periodic updates will still happen automatically.
- Nostrail recipient-sheet Start Sharing helper copy now lives in shared formatter logic with test coverage for empty, invite-sending, and ready states.
- Nostrail recipient-sheet share action now switches between Start Sharing and the friendlier Share Current Area with matching helper copy when a session is already active.
- Nostrail recipient removal now prunes stale Sent/Check/Retry state and returns the invite sheet to a plain empty state when the last recipient is removed.
- Nostrail's disabled invite action now explains that at least one recipient is needed.
- All-failed invite/share fanout is now retry-tested end to end: failed rows stay actionable, relay readiness is reacquired automatically, and the next send can succeed without re-entering recipients.
- Failed initial share publishes now roll back active session state so the app does not claim sharing started when no update was sent; failed stop publishes pause periodic updates while keeping the session retryable with stop-specific reconnect/retry copy.
- Relay pool now rejects no-readable subscriptions explicitly and only subscribes/publishes against relays enabled for that direction, with tests for read/write disabled behavior.
- Swiftroots Settings now shows plain relay availability, including all-off, receiving-off, and sharing-off states, includes per-relay Receive/Share toggles with plain per-relay descriptions and last-check feedback backed by persisted relay preferences, clears stale check results when relay toggles really change while preserving recent relay-check confidence on no-op toggle requests, and asks for confirmation before turning off the last receiving or sharing path.
- Swiftroots Home/Settings connection status now uses user-facing copy for connected, ready, no-relays, all-off, receiving-off, and sharing-off relay states.
- Swiftroots Home/Settings now render that connection status through one shared view, keeping relay check buttons, changed-settings prompts, and helper text aligned.
- Swiftroots Home now replaces placeholder map/session rows with real identity, relay, active-sharing, restored recipient context, active-session current-area updates that distinguish restored vs newly added people while preserving the full active recipient set after additive updates, opening Start Sharing with an initial current-area prompt when no location is ready, keeping successful update confirmations visible in the sheet with an explicit Done completion state, clearing that completion state when recipients are edited again or a pending location request starts/fails, offering in-sheet Settings recovery when location permission is off, relabeling retryable location failures as Try Location Again without clearing selected people, and letting people cancel a pending location request without losing selected people or auto-sharing after a late location callback; late fresh-location callbacks now replace stale cancel/error copy with current-area-ready status, plus session-expiry and fresh-location summaries, direct Trustroots profile, and Stop Sharing actions.
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
- Swiftroots reconnect checks now report "Reconnected" or "Could not reconnect" after stopped-receiving recovery, keeping routine relay checks and recovery checks distinct.
- Shared relay-check history now records that reconnect-specific wording as well, so recent-check summaries stay aligned with the recovery action the user just took.
- Partial relay checks now include receive/share path guidance when only one direction still has a reachable relay, keeping the main summary actionable without listing diagnostics.
- Swiftroots failed relay checks now apply a short visible retry pause with "Try Again Soon" copy, avoiding rapid repeated reconnect attempts.
- The shared location service now stores the most recent relay-check summary after automatic or manual relay connection attempts; Swiftroots shows it in Home/Settings and Nostrail shows it in the map status panel, and the summary clears when relay settings or the local key change.
- Key import, generation, and clear now also reset relay auth/subscription runtime, stale per-relay reachability rows, and persisted relay failure counters, so a new local identity does not inherit old relay-check details or receive paths.
- Swiftroots Settings and shared onboarding now surface direct stop-sharing actions when an active share blocks key clearing or replacement.
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
- Key storage now has an explicit clear path across the shared `KeyStore` boundary, including Keychain deletion and Nostrail runtime reset state for future logout/reset flows; active sharing blocks key clearing/replacement until the session is stopped.
- Key status copy now distinguishes real device storage from local simulator test storage with test coverage, so unsigned simulator runs do not sound like production Keychain storage.
- Keychain save/update/delete failures now include safer recovery copy that says whether no key was stored, an existing key was unchanged, or a key may still be on the device, while preserving OSStatus diagnostics.
- Nostrail clear-key confirmation copy now lives in the shared key lifecycle helper with test coverage, matching the other destructive key-removal guard copy.
- Clear-key now uses the same full runtime reset path as key import/replacement, including cached location, relay/session tasks, received-location storage, persisted relay failure counters, and app-level relay recovery sheets/confirmation state.
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
- Stop-session service calls without an active session now report the same plain no-session state used by update attempts instead of silently returning.
- Recipient-targeted location updates now check for an active sharing session before resolving recipients, so a stopped session reports "Start a sharing session first." without misleading recipient lookup errors.
- Stop actions now detect locally expired sessions before relay work, clear stale sharing state, and avoid publishing unnecessary stop events.
- Nostrail action error copy now preserves the explicit "Sharing session expired." status in the UI instead of collapsing expired sessions into generic no-session copy.
- Nostrail clears share/update row-current state and stale share retry notices when sharing ends or expires, so selected people are available for the next Start Sharing flow instead of staying marked `Updated`; invite-sent state is preserved.
- Test execution on simulator is blocked in this environment by CoreSimulator runtime mismatch.

Hardening added this pass:

- Canonical NIP-01 event-id generation/validation in shared code.
- Wire decode now rejects malformed/tampered event payloads whose computed ID does not match the transported ID.
- Relay publish/auth ACK handling now times out explicitly instead of hanging indefinitely.
- Wire decode now also enforces bounded timestamp/content/tag sanity checks before accepting events.

Reviewed decisions now locked:

- Platform: native Swift/SwiftUI, not Expo.
- Identity: reuse existing Trustroots NIP-05 assumptions and `nip42.trustroots.org` relay gate.
- Delivery: temporary stored encrypted events, not live-only ephemeral events.
- Precision: approximate location by default.
- Background: limited background sharing only during an explicit active session.
- Protocol: repo-compatible signed encrypted events on the NIP-42 relay, not NIP-17 gift wraps in v1.

## Key Changes

- Create a small iOS app separate from the broad `nr-web/docs/iOS-plan.md`; do not port `nr-web`.
- Use SwiftUI, MapKit, CoreLocation, Keychain, URLSession/WebSocket, and a minimal Nostr layer.
- Use one relay in v1: `wss://nip42.trustroots.org`.
- Import only existing keys: `nsec` and private-key hex. No key generation or backup flow in v1.
- Resolve users by `name@trustroots.org`, following the repo's existing NIP-05 behavior.
- Out of scope: public map notes, profiles UI, chat UI, APNs, relay settings, map layers, full event cache.

## Protocol And Privacy

- Publish a custom regular Nostr event kind for Nostrail location payloads, with `p` tags for recipients, signed by the authenticated user, and encrypted content using NIP-44 v2.
- Include an `expiration` tag on every location event; clients must ignore expired events even if a relay still returns them.
- Use approximate location by snapping to an area, not exact coordinates. Default target precision: roughly neighborhood/block scale, around 250-500m.
- Payloads:

  ```json
  { "type": "trustroots.location.v1", "sessionId": "...", "area": "...", "centerLat": 52.52, "centerLon": 13.405, "accuracyM": 500, "createdAt": 1760000000, "expiresAt": 1760003600 }
  ```

  ```json
  { "type": "trustroots.location.invite.v1", "message": "", "createdAt": 1760000000 }
  ```

  ```json
  { "type": "trustroots.location.stop.v1", "sessionId": "...", "createdAt": 1760000000 }
  ```

- Do not use ephemeral event kinds in v1; they are too easy to miss when iOS apps are offline or suspended.

## App Behavior

- Onboarding: import key, derive pubkey, store secret in Keychain, and connect/authenticate to relays when the user invites or starts sharing.
- Map: show the user's approximate current area and fresh shared locations from accepted users.
- Sharing session: default duration 2 hours, manually stoppable, with temporary events expiring shortly after each update.
- Updates: send every 5 minutes while active, and in limited background mode only after the user explicitly enables sharing.
- Background sharing: request the needed iOS location permission only when starting an active session; show clear in-app state and stop automatically when the session expires.
- Invites: add one or more recipients by Trustroots username, `@username`, NIP-05, npub, or raw pubkey; resolve pubkeys; send one encrypted invite per recipient.

## Implementation Notes

- Use pinned `nostr-sdk-ios` through Swift Package Manager for secp256k1/Schnorr/ECDH and NIP-44 v2.
- Implement the minimal Nostr pieces needed: NIP-01 event signing, NIP-05 lookup, NIP-19 key parsing, NIP-42 auth event, NIP-44 encryption/decryption, relay publish/subscribe.
- Verify NIP-44 against official test vectors before using it for location payloads.
- Keep persistence small: Keychain for secret key, UserDefaults or SQLite for contacts, accepted sessions, and last fresh locations.

## Next Steps (From Current Codebase)

- Run the native app/test compile gates with the linked Swift package once SwiftPM cache writes/sandboxing are available to Xcode in the local environment.
- Expand guarded NIP-44 vector coverage beyond the current checksum sample into broader cross-client interoperability checks around the pinned SDK path.
- Add richer relay health/reporting behavior on top of the current pool runtime and shared last-check summary.
- Harden Keychain storage and key lifecycle behaviors.
- Add true background location-session lifecycle and permission flow.
- Add simulator/device test run once host CoreSimulator environment is healthy.

## Test Plan

- Unit test key import, pubkey derivation, NIP-05 lookup, NIP-42 auth event creation, NIP-44 vectors, payload validation, expiration handling, and approximate-location snapping.
- Integration test against local `nip42relay`: unauthenticated read fails, authenticated publish succeeds, wrong-pubkey publish fails, expired events are ignored by the app.
- iOS simulator smoke test: import key, grant location, add one or more recipients, send invite, start sharing, receive/decrypt a mocked location event, render marker on MapKit, stop sharing.

## Assumptions

- `Nostrail` is the app name.
- Approximate sharing is the v1 default; exact sharing is out of scope.
- Limited background sharing is required, but only during explicit time-bounded sessions.
- No relay/backend changes are required for v1.
- References: [NIP-01](https://raw.githubusercontent.com/nostr-protocol/nips/master/01.md), [NIP-05](https://raw.githubusercontent.com/nostr-protocol/nips/master/05.md), [NIP-42](https://raw.githubusercontent.com/nostr-protocol/nips/master/42.md), [NIP-44](https://raw.githubusercontent.com/nostr-protocol/nips/master/44.md), [`nostr-sdk-ios`](https://github.com/nostr-sdk/nostr-sdk-ios).
