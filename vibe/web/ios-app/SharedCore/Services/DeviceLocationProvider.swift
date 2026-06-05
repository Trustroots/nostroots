import Combine
import CoreLocation
import Foundation

final class DeviceLocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var coordinate: CLLocationCoordinate2D?
    @Published var statusText = ""
    @Published var isRequestingLocation = false

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestCurrentLocation() {
        guard !isRequestingLocation else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            isRequestingLocation = true
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            isRequestingLocation = true
            manager.requestLocation()
        case .denied, .restricted:
            isRequestingLocation = false
            statusText = NostrailLocationStatusFormatter.permissionDenied
        @unknown default:
            isRequestingLocation = false
            statusText = NostrailLocationStatusFormatter.permissionUnavailable
        }
    }

    func cancelCurrentLocationRequest() {
        manager.stopUpdatingLocation()
        isRequestingLocation = false
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            isRequestingLocation = true
            manager.requestLocation()
        case .denied, .restricted:
            isRequestingLocation = false
            statusText = NostrailLocationStatusFormatter.permissionDenied
        case .notDetermined:
            break
        @unknown default:
            isRequestingLocation = false
            statusText = NostrailLocationStatusFormatter.permissionUnavailable
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        isRequestingLocation = false
        guard let location = locations.last else { return }
        coordinate = location.coordinate
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        isRequestingLocation = false
        statusText = NostrailLocationStatusFormatter.failureText(error.localizedDescription)
    }
}
