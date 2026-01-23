"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useNostrStore } from "@/store/nostr";
import { getLocationFromEvent, formatDistanceToNow } from "@/lib/utils";
import { AddNoteModal } from "./AddNoteModal";
import { LayerToggle } from "./LayerToggle";

// Fix for default marker icons in Leaflet with Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom icons for different layers
const layerIcons: Record<string, L.Icon> = {
  trustroots: L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
  hitchmap: L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
  hitchwiki: L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
  unverified: L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
};

L.Marker.prototype.options.icon = defaultIcon;

// Component to handle map clicks
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: () => {
      // Right click or long press would be better for mobile
    },
    contextmenu: (event) => {
      event.originalEvent.preventDefault();
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

// Component to center map on location
function LocationButton() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.setView(
          [position.coords.latitude, position.coords.longitude],
          13
        );
        setLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocating(false);
      }
    );
  };

  return (
    <button
      onClick={handleLocate}
      disabled={locating}
      className="absolute bottom-6 right-6 z-[1000] bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 disabled:opacity-50"
      title="Center on my location"
    >
      {locating ? (
        <span className="animate-pulse">📍</span>
      ) : (
        <span>📍</span>
      )}
    </button>
  );
}

export default function MapView() {
  const events = useNostrStore((state) => state.events);
  const enabledLayers = useNostrStore((state) => state.enabledLayers);
  const publicKey = useNostrStore((state) => state.publicKey);
  const connect = useNostrStore((state) => state.connect);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Connect to relay on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Filter events that have location data
  const eventsWithLocation = events
    .map((event) => {
      const location = getLocationFromEvent(event);
      if (!location) return null;

      // Determine layer based on event kind and author
      let layer = "unverified";
      if (event.kind === 30398) {
        layer = "trustroots";
      } else if (event.kind === 30399) {
        // Check author to determine source
        if (
          event.pubkey ===
          "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209"
        ) {
          layer = "hitchmap";
        } else if (
          event.pubkey ===
          "16db5234c1dd8082897bd2d21bbec4b8051d2cd03e24b819aa5232077d443da9"
        ) {
          layer = "hitchwiki";
        }
      }

      return { event, location, layer };
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && (enabledLayers[item.layer as keyof typeof enabledLayers] ?? true)
    );

  const handleMapClick = (lat: number, lng: number) => {
    if (!publicKey) {
      alert("Please set up your identity in Settings before posting notes.");
      return;
    }
    setSelectedLocation({ lat, lng });
    setModalOpen(true);
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[52.52, 13.405]} // Berlin by default
        zoom={5}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {eventsWithLocation.map(({ event, location, layer }) => (
          <Marker
            key={event.id}
            position={[location.lat, location.lng]}
            icon={layerIcons[layer] || defaultIcon}
          >
            <Popup maxWidth={300}>
              <div className="max-w-[280px]">
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mb-2">
                  {event.content || <em className="text-gray-400">No content</em>}
                </p>
                <div className="text-xs text-gray-500 border-t pt-2">
                  <p>
                    {formatDistanceToNow(event.created_at * 1000)}
                  </p>
                  <p className="truncate">
                    By: {event.pubkey.slice(0, 12)}...
                  </p>
                  <p className="mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${
                        layer === "trustroots"
                          ? "bg-green-100 text-green-800"
                          : layer === "hitchmap"
                            ? "bg-yellow-100 text-yellow-800"
                            : layer === "hitchwiki"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {layer}
                    </span>
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapClickHandler onMapClick={handleMapClick} />
        <LocationButton />
      </MapContainer>

      {/* Layer toggles */}
      <LayerToggle />

      {/* Instructions */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg text-sm text-gray-600">
        Right-click on map to add a note
      </div>

      {/* Event count */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow text-sm">
        {eventsWithLocation.length} notes visible
      </div>

      {/* Add note modal */}
      <AddNoteModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedLocation(null);
        }}
        location={selectedLocation}
      />
    </div>
  );
}
