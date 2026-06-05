import Foundation

enum NRConstants {
    enum CryptoRuntimeMode: Equatable {
        case compatibility
        case secp256k1
    }

    static let cryptoRuntimeMode: CryptoRuntimeMode = .secp256k1
    static let nostrootsURL = URL(string: "https://nos.trustroots.org/")!
    static let nostrootsOrigin = "https://nos.trustroots.org"
}
