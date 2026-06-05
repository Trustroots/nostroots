import Foundation

struct RelayAvailabilitySummary: Equatable {
    let totalCount: Int
    let enabledCount: Int
    let readableCount: Int
    let writableCount: Int

    init(endpoints: [NRConstants.RelayEndpoint]) {
        totalCount = endpoints.count
        enabledCount = endpoints.filter { $0.readEnabled || $0.writeEnabled }.count
        readableCount = endpoints.filter(\.readEnabled).count
        writableCount = endpoints.filter(\.writeEnabled).count
    }

    var userFacingDescription: String {
        guard totalCount > 0 else {
            return "No relays are configured."
        }
        guard enabledCount > 0 else {
            return "All relays are turned off."
        }
        if readableCount == 0 {
            return "Receiving is off. Turn on at least one readable relay."
        }
        if writableCount == 0 {
            return "Sharing is off. Turn on at least one writable relay."
        }
        if enabledCount == totalCount {
            return totalCount == 1 ? "1 relay enabled." : "\(totalCount) relays enabled."
        }
        return "\(enabledCount) of \(totalCount) relays enabled."
    }
}

struct RelayEndpointAvailability: Equatable {
    let readEnabled: Bool
    let writeEnabled: Bool

    init(endpoint: NRConstants.RelayEndpoint) {
        readEnabled = endpoint.readEnabled
        writeEnabled = endpoint.writeEnabled
    }

    var userFacingDescription: String {
        switch (readEnabled, writeEnabled) {
        case (true, true):
            return "Receives and shares updates."
        case (true, false):
            return "Receives updates only."
        case (false, true):
            return "Shares updates only."
        case (false, false):
            return "Turned off."
        }
    }
}

struct RelayConnectionCheckResult: Equatable {
    enum State: Equatable {
        case skippedOff
        case connected
        case failed(String)
    }

    let url: URL
    let state: State
    let readEnabled: Bool
    let writeEnabled: Bool
    let consecutiveFailures: Int

    init(
        url: URL,
        state: State,
        readEnabled: Bool = true,
        writeEnabled: Bool = true,
        consecutiveFailures: Int = 0
    ) {
        self.url = url
        self.state = state
        self.readEnabled = readEnabled
        self.writeEnabled = writeEnabled
        self.consecutiveFailures = max(0, consecutiveFailures)
    }

    var userFacingDescription: String {
        switch state {
        case .skippedOff:
            return "Not checked because it is turned off."
        case .connected:
            return "Reachable."
        case .failed:
            return "Could not connect."
        }
    }

    var diagnosticDescription: String? {
        switch state {
        case .failed(let reason):
            return reason
        case .skippedOff, .connected:
            return nil
        }
    }

    var recoveryDescription: String? {
        guard case .failed = state else { return nil }
        let isRepeatFailure = consecutiveFailures >= 2
        switch (readEnabled, writeEnabled) {
        case (true, true):
            return isRepeatFailure
                ? "Receive and Share keep failing here. Turn this relay off or add another relay."
                : "Receive and Share are failing here. Turn this relay off or add another relay if it keeps failing."
        case (true, false):
            return isRepeatFailure
                ? "Receive keeps failing here. Turn this relay off or add another Receive relay."
                : "Receive is failing here. Turn this relay off or add another Receive relay if it keeps failing."
        case (false, true):
            return isRepeatFailure
                ? "Share keeps failing here. Turn this relay off or add another Share relay."
                : "Share is failing here. Turn this relay off or add another Share relay if it keeps failing."
        case (false, false):
            return nil
        }
    }
}
