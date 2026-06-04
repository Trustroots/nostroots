import Foundation

enum RelayReconnectCooldown {
    static let defaultDelay: TimeInterval = 5
    static let maximumDelay: TimeInterval = 20

    static func delay(afterConsecutiveFailures failureCount: Int) -> TimeInterval {
        let boundedFailures = max(1, failureCount)
        let multiplier = min(4, 1 << min(boundedFailures - 1, 2))
        return min(defaultDelay * TimeInterval(multiplier), maximumDelay)
    }

    static func effectiveFailureCount(
        actionFailureCount: Int,
        relayCheckResults: [RelayConnectionCheckResult]
    ) -> Int {
        let relayFailureCount = relayCheckResults.reduce(0) { highestCount, result in
            guard case .failed = result.state else { return highestCount }
            return max(highestCount, result.consecutiveFailures)
        }
        return max(1, actionFailureCount, relayFailureCount)
    }

    static func nextAllowedAt(now: Date = Date(), delay: TimeInterval = defaultDelay) -> Date {
        now.addingTimeInterval(delay)
    }

    static func nextAllowedAt(now: Date = Date(), consecutiveFailures: Int) -> Date {
        nextAllowedAt(now: now, delay: delay(afterConsecutiveFailures: consecutiveFailures))
    }

    static func waitText(now: Date, nextAllowedAt: Date?) -> String {
        guard let nextAllowedAt, nextAllowedAt > now else { return "" }
        let seconds = max(1, Int(ceil(nextAllowedAt.timeIntervalSince(now))))
        return seconds == 1 ? "Try again in 1 second." : "Try again in \(seconds) seconds."
    }

    static func waitText(
        now: Date,
        nextAllowedAt: Date?,
        actionFailureCount: Int,
        relayCheckResults: [RelayConnectionCheckResult]
    ) -> String {
        let baseText = waitText(now: now, nextAllowedAt: nextAllowedAt)
        guard !baseText.isEmpty else { return "" }
        let repeatedRelayCount = relayCheckResults.filter { result in
            if case .failed = result.state {
                return result.consecutiveFailures >= 2
            }
            return false
        }.count
        if repeatedRelayCount > 0 {
            let relayText = repeatedRelayCount == 1 ? "A relay keeps failing" : "\(repeatedRelayCount) relays keep failing"
            return "\(baseText) \(relayText), so this wait is longer."
        }
        if actionFailureCount >= 2 {
            return "\(baseText) Reconnect keeps failing, so this wait is longer."
        }
        return baseText
    }

    static func retryStatusText(
        now: Date,
        nextAllowedAt: Date?,
        actionFailureCount: Int,
        relayCheckResults: [RelayConnectionCheckResult],
        readyText: String = "Try again now."
    ) -> String {
        let waitText = waitText(
            now: now,
            nextAllowedAt: nextAllowedAt,
            actionFailureCount: actionFailureCount,
            relayCheckResults: relayCheckResults
        )
        if !waitText.isEmpty {
            return waitText
        }
        guard actionFailureCount > 0 || relayCheckResults.contains(where: {
            if case .failed = $0.state {
                return $0.consecutiveFailures > 0
            }
            return false
        }) else {
            return ""
        }
        return readyText
    }

    static func isCoolingDown(now: Date = Date(), nextAllowedAt: Date?) -> Bool {
        !waitText(now: now, nextAllowedAt: nextAllowedAt).isEmpty
    }
}
