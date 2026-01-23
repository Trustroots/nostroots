"use client";

import dynamic from "next/dynamic";

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <div className="h-[calc(100vh-64px)]">
      <MapView />
    </div>
  );
}
