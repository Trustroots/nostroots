import AVFoundation
import MediaPlayer
import UIKit
import WebKit

struct RadiostrNowPlayingPayload: Equatable {
    let stationID: String
    let title: String
    let artist: String
    let album: String
    let artworkSources: [String]
    let isPlaying: Bool
    let isLiveStream: Bool

    init?(messageBody: Any) {
        guard
            let message = messageBody as? [String: Any],
            message["source"] as? String == "radiostr-now-playing",
            message["method"] as? String == "update",
            let payload = message["payload"] as? [String: Any],
            let stationID = Self.nonemptyString(payload["stationId"]),
            let title = Self.nonemptyString(payload["title"])
        else {
            return nil
        }

        self.stationID = stationID
        self.title = title
        self.artist = Self.nonemptyString(payload["artist"]) ?? "Internet radio"
        self.album = Self.nonemptyString(payload["album"]) ?? "Radiostr"
        self.artworkSources = (payload["artwork"] as? [Any] ?? [])
            .compactMap(Self.nonemptyString)
        self.isPlaying = payload["playing"] as? Bool ?? false
        self.isLiveStream = payload["liveStream"] as? Bool ?? true
    }

    static func isClearMessage(_ messageBody: Any) -> Bool {
        guard let message = messageBody as? [String: Any] else { return false }
        return message["source"] as? String == "radiostr-now-playing"
            && message["method"] as? String == "clear"
    }

    static func isAllowedPageURL(_ url: URL?) -> Bool {
        guard
            let url,
            url.scheme?.lowercased() == "https",
            url.host?.lowercased() == "nos.trustroots.org"
        else {
            return false
        }
        let normalizedPath = url.path.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return normalizedPath == "examples/radiostr"
    }

    private static func nonemptyString(_ value: Any?) -> String? {
        guard let value = value as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

@MainActor
final class RadiostrNowPlayingBridge {
    private weak var webView: WKWebView?
    private let infoCenter: MPNowPlayingInfoCenter
    private let commandCenter: MPRemoteCommandCenter
    private var commandTargets: [(command: MPRemoteCommand, target: Any)] = []
    private var artworkTask: URLSessionDataTask?
    private var artworkRevision = 0
    private var isActive = false

    init(
        infoCenter: MPNowPlayingInfoCenter = .default(),
        commandCenter: MPRemoteCommandCenter = .shared()
    ) {
        self.infoCenter = infoCenter
        self.commandCenter = commandCenter
        registerRemoteCommands()
        setRemoteCommandsEnabled(false)
    }

    deinit {
        artworkTask?.cancel()
        commandTargets.forEach { entry in
            entry.command.removeTarget(entry.target)
        }
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func handle(messageBody: Any, pageURL: URL?) {
        guard RadiostrNowPlayingPayload.isAllowedPageURL(pageURL) else {
            clear()
            return
        }
        if RadiostrNowPlayingPayload.isClearMessage(messageBody) {
            clear()
            return
        }
        guard let payload = RadiostrNowPlayingPayload(messageBody: messageBody) else { return }
        publish(payload, pageURL: pageURL)
    }

    func clearIfOutsideRadiostr(_ pageURL: URL?) {
        if !RadiostrNowPlayingPayload.isAllowedPageURL(pageURL) {
            clear()
        }
    }

    func clear() {
        guard isActive || infoCenter.nowPlayingInfo != nil else { return }
        isActive = false
        artworkRevision += 1
        artworkTask?.cancel()
        artworkTask = nil
        infoCenter.nowPlayingInfo = nil
        setRemoteCommandsEnabled(false)
        try? AVAudioSession.sharedInstance().setActive(
            false,
            options: [.notifyOthersOnDeactivation]
        )
    }

    private func publish(_ payload: RadiostrNowPlayingPayload, pageURL: URL?) {
        isActive = true
        setRemoteCommandsEnabled(true)
        if payload.isPlaying {
            activatePlaybackAudioSession()
        }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: payload.title,
            MPMediaItemPropertyArtist: payload.artist,
            MPMediaItemPropertyAlbumTitle: payload.album,
            MPMediaItemPropertyMediaType: MPMediaType.anyAudio.rawValue,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPNowPlayingInfoPropertyIsLiveStream: payload.isLiveStream,
            MPNowPlayingInfoPropertyPlaybackRate: payload.isPlaying ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyExternalContentIdentifier: "radiostr:\(payload.stationID)",
            MPNowPlayingInfoPropertyServiceIdentifier: "radiostr"
        ]
        if let fallbackArtwork = UIImage(named: "Logo67") {
            info[MPMediaItemPropertyArtwork] = mediaItemArtwork(from: fallbackArtwork)
        }
        infoCenter.nowPlayingInfo = info

        artworkRevision += 1
        let revision = artworkRevision
        let urls = payload.artworkSources.compactMap { source in
            resolvedArtworkURL(source, relativeTo: pageURL)
        }
        loadFirstArtwork(from: urls, revision: revision)
    }

    private func activatePlaybackAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
        } catch {
            // WebKit playback remains usable even if the native audio session cannot be promoted.
        }
    }

    private func registerRemoteCommands() {
        addHandler(to: commandCenter.playCommand, command: "play")
        addHandler(to: commandCenter.pauseCommand, command: "pause")
        addHandler(to: commandCenter.stopCommand, command: "stop")
        addHandler(to: commandCenter.previousTrackCommand, command: "previous")
        addHandler(to: commandCenter.nextTrackCommand, command: "next")
    }

    private func addHandler(to command: MPRemoteCommand, command name: String) {
        let target = command.addTarget { [weak self] _ in
            guard let self, self.isActive, self.webView != nil else {
                return .noActionableNowPlayingItem
            }
            Task { @MainActor in
                self.sendCommandToRadiostr(name)
            }
            return .success
        }
        commandTargets.append((command, target))
    }

    private func setRemoteCommandsEnabled(_ enabled: Bool) {
        commandCenter.playCommand.isEnabled = enabled
        commandCenter.pauseCommand.isEnabled = enabled
        commandCenter.stopCommand.isEnabled = enabled
        commandCenter.previousTrackCommand.isEnabled = enabled
        commandCenter.nextTrackCommand.isEnabled = enabled
        commandCenter.changePlaybackPositionCommand.isEnabled = false
        commandCenter.skipBackwardCommand.isEnabled = false
        commandCenter.skipForwardCommand.isEnabled = false
    }

    private func sendCommandToRadiostr(_ command: String) {
        guard
            let webView,
            let data = try? JSONEncoder().encode(command),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }
        webView.evaluateJavaScript(
            "window.__nostrootsNowPlayingCommand && window.__nostrootsNowPlayingCommand(\(json));"
        )
    }

    private func resolvedArtworkURL(_ source: String, relativeTo pageURL: URL?) -> URL? {
        guard !source.lowercased().hasPrefix("data:") else { return nil }
        guard let url = URL(string: source, relativeTo: pageURL)?.absoluteURL else { return nil }
        return url.scheme?.lowercased() == "https" ? url : nil
    }

    private func loadFirstArtwork(from urls: [URL], revision: Int) {
        guard revision == artworkRevision, let url = urls.first else { return }
        artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            Task { @MainActor in
                guard let self, revision == self.artworkRevision else { return }
                if let data, let image = UIImage(data: data) {
                    var info = self.infoCenter.nowPlayingInfo ?? [:]
                    info[MPMediaItemPropertyArtwork] = self.mediaItemArtwork(from: image)
                    self.infoCenter.nowPlayingInfo = info
                    self.artworkTask = nil
                } else {
                    self.loadFirstArtwork(from: Array(urls.dropFirst()), revision: revision)
                }
            }
        }
        artworkTask?.resume()
    }

    private func mediaItemArtwork(from image: UIImage) -> MPMediaItemArtwork {
        MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    }
}
