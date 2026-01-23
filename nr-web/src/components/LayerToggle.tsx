"use client";

import { useNostrStore } from "@/store/nostr";

const layers = [
  { key: "trustroots", label: "Trustroots", color: "bg-green-500" },
  { key: "hitchmap", label: "Hitchmap", color: "bg-yellow-500" },
  { key: "hitchwiki", label: "Hitchwiki", color: "bg-amber-500" },
  { key: "unverified", label: "Unverified", color: "bg-red-500" },
] as const;

export function LayerToggle() {
  const enabledLayers = useNostrStore((state) => state.enabledLayers);
  const toggleLayer = useNostrStore((state) => state.toggleLayer);

  return (
    <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
      <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Layers</p>
      <div className="space-y-2">
        {layers.map(({ key, label, color }) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              checked={enabledLayers[key] ?? true}
              onChange={() => toggleLayer(key)}
              className="rounded border-gray-300 text-trustroots focus:ring-trustroots"
            />
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-gray-700">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
