"use client";

import { useNostrStore } from "@/store/nostr";
import { formatDistanceToNow } from "@/lib/utils";

export default function ListPage() {
  const events = useNostrStore((state) => state.events);
  const connectionStatus = useNostrStore((state) => state.connectionStatus);

  // Group events by kind
  const groupedEvents = events.reduce(
    (acc, event) => {
      const kind = event.kind.toString();
      if (!acc[kind]) {
        acc[kind] = [];
      }
      acc[kind].push(event);
      return acc;
    },
    {} as Record<string, typeof events>
  );

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case "30397":
        return "Map Notes";
      case "30398":
        return "Verified Notes (Reposts)";
      case "30399":
        return "External Notes (Hitchmap, etc.)";
      case "10390":
        return "Trustroots Profiles";
      default:
        return `Kind ${kind}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Stream of Notes
        </h1>
        <p className="text-gray-600">
          All events fetched from the Trustroots relay
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-500">
            {connectionStatus === "connected"
              ? "Connected to relay"
              : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="mb-4 p-4 bg-trustroots/10 rounded-lg">
        <p className="text-lg font-medium text-trustroots-dark">
          Total: {events.length} events
        </p>
      </div>

      {Object.entries(groupedEvents).map(([kind, kindEvents]) => (
        <div key={kind} className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
            {getKindLabel(kind)} ({kindEvents.length})
          </h2>

          <div className="space-y-4">
            {kindEvents.map((event) => (
              <div
                key={event.id}
                className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="mb-2">
                  <p className="text-gray-800 whitespace-pre-wrap break-words">
                    {event.content || <em className="text-gray-400">No content</em>}
                  </p>
                </div>

                <div className="text-sm text-gray-500 space-y-1">
                  <p>
                    <span className="font-medium">Time:</span>{" "}
                    {formatDistanceToNow(event.created_at * 1000)} (
                    {new Date(event.created_at * 1000).toLocaleString()})
                  </p>
                  <p className="truncate">
                    <span className="font-medium">Author:</span>{" "}
                    <code className="bg-gray-100 px-1 rounded text-xs">
                      {event.pubkey.slice(0, 16)}...
                    </code>
                  </p>

                  {/* Show location tag if present */}
                  {event.tags
                    .filter(
                      (tag) =>
                        tag[0] === "l" && tag[2] === "open-location-code"
                    )
                    .map((tag, i) => (
                      <p key={i}>
                        <span className="font-medium">Location:</span>{" "}
                        <code className="bg-green-100 px-1 rounded text-xs text-green-800">
                          {tag[1]}
                        </code>
                      </p>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No events yet. Waiting for data from relay...</p>
        </div>
      )}
    </div>
  );
}
