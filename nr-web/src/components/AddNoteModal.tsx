"use client";

import { useState } from "react";
import { useNostrStore } from "@/store/nostr";
import { createMapNote } from "@/lib/events";
import OpenLocationCode from "open-location-code";

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number } | null;
}

export function AddNoteModal({ isOpen, onClose, location }: AddNoteModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishEvent = useNostrStore((state) => state.publishEvent);
  const privateKey = useNostrStore((state) => state.privateKey);

  if (!isOpen || !location) return null;

  const plusCode = OpenLocationCode.encode(location.lat, location.lng, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!privateKey) {
      setError("Please set up your identity in Settings first");
      return;
    }

    if (content.trim().length < 3) {
      setError("Note must be at least 3 characters");
      return;
    }

    if (content.length > 300) {
      setError("Note must be less than 300 characters");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const event = createMapNote(content.trim(), plusCode, privateKey);
      await publishEvent(event);
      setContent("");
      onClose();
    } catch (e) {
      setError("Failed to publish note. Please try again.");
      console.error("Publish error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Add a Note
        </h2>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
          <p className="text-gray-600">
            <span className="font-medium">Location:</span>{" "}
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Plus Code:</span>{" "}
            <code className="bg-green-100 px-1 rounded">{plusCode}</code>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Your Note
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something about this location..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trustroots focus:border-trustroots resize-none"
              rows={4}
              maxLength={300}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {content.length}/300
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="flex-1 px-4 py-2 bg-trustroots hover:bg-trustroots-dark disabled:bg-gray-300 text-white rounded-lg font-medium"
            >
              {isSubmitting ? "Publishing..." : "Publish Note"}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Your note will be published to the Trustroots relay and will be
          visible to others using Nostroots.
        </p>
      </div>
    </div>
  );
}
