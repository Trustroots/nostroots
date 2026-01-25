"use client";

import { useState } from "react";
import { useNostrStore } from "@/store/nostr";
import { formatDistanceToNow, getLocationFromEvent } from "@/lib/utils";
import { createReplyEvent } from "@/lib/events";
import { nip19, Event } from "nostr-tools";

export function EventDetailModal() {
  const selectedEvent = useNostrStore((state) => state.selectedEvent);
  const setSelectedEvent = useNostrStore((state) => state.setSelectedEvent);
  const events = useNostrStore((state) => state.events);
  const privateKey = useNostrStore((state) => state.privateKey);
  const publishEvent = useNostrStore((state) => state.publishEvent);

  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selectedEvent) return null;

  const location = getLocationFromEvent(selectedEvent);
  const npub = nip19.npubEncode(selectedEvent.pubkey);

  // Find replies to this event
  const replies = events.filter((e) =>
    e.tags.some(
      (tag) =>
        (tag[0] === "e" && tag[1] === selectedEvent.id) ||
        (tag[0] === "E" && tag[1] === selectedEvent.id)
    )
  );

  // Find author's profile event
  const authorProfile = events.find(
    (e) => e.kind === 10390 && e.pubkey === selectedEvent.pubkey
  );
  const authorUsername = authorProfile?.tags.find(
    (t) => t[0] === "l" && t[2] === "org.trustroots:username"
  )?.[1];

  // Get layer/source info
  const getSourceInfo = () => {
    if (selectedEvent.kind === 30398) {
      return { label: "Trustroots Verified", color: "bg-green-100 text-green-800" };
    }
    if (selectedEvent.kind === 30399) {
      if (selectedEvent.pubkey === "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209") {
        return { label: "Hitchmap", color: "bg-yellow-100 text-yellow-800" };
      }
      if (selectedEvent.pubkey === "16db5234c1dd8082897bd2d21bbec4b8051d2cd03e24b819aa5232077d443da9") {
        return { label: "Hitchwiki", color: "bg-amber-100 text-amber-800" };
      }
    }
    return { label: "Unverified", color: "bg-red-100 text-red-800" };
  };

  const sourceInfo = getSourceInfo();

  const handleSubmitReply = async () => {
    if (!privateKey || !replyContent.trim()) {
      setError("Please enter a reply");
      return;
    }

    setIsReplying(true);
    setError(null);

    try {
      const replyEvent = createReplyEvent(
        replyContent.trim(),
        selectedEvent,
        privateKey
      );
      await publishEvent(replyEvent);
      setReplyContent("");
      setShowReplyForm(false);
    } catch (err) {
      setError("Failed to publish reply. Please try again.");
      console.error(err);
    } finally {
      setIsReplying(false);
    }
  };

  const handleClose = () => {
    setSelectedEvent(null);
    setShowReplyForm(false);
    setReplyContent("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal - slides up on mobile, centered on desktop */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${sourceInfo.color}`}>
              {sourceInfo.label}
            </span>
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(selectedEvent.created_at * 1000)}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Author info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-trustroots to-trustroots-dark flex items-center justify-center text-white font-bold">
              {authorUsername?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              {authorUsername ? (
                <a
                  href={`https://www.trustroots.org/profile/${authorUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-trustroots hover:underline"
                >
                  @{authorUsername}
                </a>
              ) : (
                <span className="font-medium text-gray-700">Anonymous</span>
              )}
              <p className="text-xs text-gray-500 truncate max-w-[200px]">
                {npub.slice(0, 20)}...
              </p>
            </div>
          </div>

          {/* Note content */}
          <div className="mb-4">
            <p className="text-gray-800 whitespace-pre-wrap break-words">
              {selectedEvent.content || (
                <em className="text-gray-400">No content</em>
              )}
            </p>
          </div>

          {/* Location info */}
          {location && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <p className="text-gray-600">
                <span className="font-medium">📍 Location:</span>{" "}
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            </div>
          )}

          {/* Replies section */}
          {replies.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Replies ({replies.length})
              </h4>
              <div className="space-y-3">
                {replies.map((reply) => (
                  <ReplyItem key={reply.id} event={reply} events={events} />
                ))}
              </div>
            </div>
          )}

          {/* Reply form */}
          {showReplyForm ? (
            <div className="mt-4 pt-4 border-t">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trustroots focus:border-trustroots resize-none"
                rows={3}
                maxLength={300}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  {replyContent.length}/300
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyContent("");
                    }}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReply}
                    disabled={isReplying || !replyContent.trim()}
                    className="px-3 py-1.5 bg-trustroots hover:bg-trustroots-dark disabled:bg-gray-300 text-white rounded-lg text-sm"
                  >
                    {isReplying ? "Posting..." : "Reply"}
                  </button>
                </div>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
          ) : (
            privateKey && (
              <button
                onClick={() => setShowReplyForm(true)}
                className="mt-4 w-full py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-600"
              >
                💬 Write a reply
              </button>
            )
          )}

          {!privateKey && (
            <p className="mt-4 text-sm text-gray-500 text-center">
              <a href="/settings" className="text-trustroots hover:underline">
                Set up your identity
              </a>{" "}
              to reply to notes
            </p>
          )}
        </div>

        {/* Footer with event ID */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
          <p className="truncate">Event ID: {selectedEvent.id}</p>
        </div>
      </div>
    </div>
  );
}

// Reply item component
function ReplyItem({ event, events }: { event: Event; events: Event[] }) {
  const authorProfile = events.find(
    (e) => e.kind === 10390 && e.pubkey === event.pubkey
  );
  const authorUsername = authorProfile?.tags.find(
    (t) => t[0] === "l" && t[2] === "org.trustroots:username"
  )?.[1];

  return (
    <div className="pl-4 border-l-2 border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-sm text-gray-700">
          {authorUsername ? `@${authorUsername}` : "Anonymous"}
        </span>
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(event.created_at * 1000)}
        </span>
      </div>
      <p className="text-sm text-gray-600">{event.content}</p>
    </div>
  );
}
