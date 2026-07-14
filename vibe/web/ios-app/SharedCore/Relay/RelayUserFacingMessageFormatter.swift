import Foundation

enum RelayUserFacingMessageFormatter {
    enum Context {
        case connect
        case publish
        case subscribe
        case stop
    }

    static func message(for error: Error, context: Context) -> String {
        if let relayPoolError = error as? RelayPoolError {
            return message(for: relayPoolError, context: context)
        }
        if let relayClientError = error as? RelayClientError {
            return message(for: relayClientError, context: context)
        }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            return genericMessage(for: context)
        }
        return genericMessage(for: context)
    }

    private static func genericMessage(for context: Context) -> String {
        switch context {
        case .connect:
            return "Could not connect to relays. Check your connection and try again."
        case .publish:
            return "Could not send this update. Check your connection and try again."
        case .subscribe:
            return "Could not listen for shared locations. Check your connection and try again."
        case .stop:
            return "Could not stop sharing. Check your connection and try again."
        }
    }

    private static func message(for error: RelayPoolError, context: Context) -> String {
        switch error {
        case .noEnabledRelays:
            return "All relays are turned off. Turn on at least one relay before sharing."
        case .noReadableRelays:
            return "Receiving is off. Turn on at least one readable relay."
        case .noWritableRelays:
            return context == .stop
                ? "Sharing is off. Turn on at least one writable relay to send the stop notice."
                : "Sharing is off. Turn on at least one writable relay."
        case .connectFailed:
            return "Could not connect to relays. Check your connection and try again."
        case .publishFailed:
            return context == .stop
                ? "Could not stop sharing. Check your connection and try again."
                : "Could not send this update. Check your connection and try again."
        case .subscribeFailed:
            return context == .subscribe
                ? "Could not listen for shared locations. Check your connection and try again."
                : "Could not connect to relays. Check your connection and try again."
        }
    }

    private static func message(for error: RelayClientError, context: Context) -> String {
        switch error {
        case .invalidRelayURL:
            return "Relay settings need a websocket URL."
        case .socketNotConnected:
            return "Could not connect to relays. Check your connection and try again."
        case .authChallengeTimeout:
            return "Relay did not finish setup in time. Try again."
        case .malformedRelayMessage:
            return "Relay sent an unreadable response. Try again."
        case .publishRejected:
            return context == .stop
                ? "Relay rejected the stop notice. Try again in a moment."
                : "Relay rejected this update. Try again in a moment."
        case .subscriptionClosed:
            return "Relay stopped sending updates. Try reconnecting."
        case .publishAckTimeout:
            if context == .stop {
                return "Could not confirm sharing stopped. Try again."
            }
            return context == .publish
                ? "Could not confirm this update was sent. Try again."
                : "Relay did not respond in time. Try again."
        }
    }
}
