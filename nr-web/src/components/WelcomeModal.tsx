"use client";

import { useNostrStore } from "@/store/nostr";

export function WelcomeModal() {
  const hasSeenWelcome = useNostrStore((state) => state.hasSeenWelcome);
  const hasCompletedOnboarding = useNostrStore((state) => state.hasCompletedOnboarding);
  const setHasSeenWelcome = useNostrStore((state) => state.setHasSeenWelcome);

  // Don't show if already seen or if onboarding is complete
  if (hasSeenWelcome || hasCompletedOnboarding) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header Image/Banner */}
        <div className="bg-gradient-to-br from-trustroots to-trustroots-dark p-8 text-white text-center">
          <div className="text-5xl mb-4">🌱</div>
          <h1 className="text-3xl font-bold mb-2">Welcome to Nostroots</h1>
          <p className="text-white/90">
            A decentralized map for sharing, hosting, and community building
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🗺️</span>
              <div>
                <h3 className="font-semibold text-gray-900">Explore the Map</h3>
                <p className="text-sm text-gray-600">
                  Discover notes left by travelers and hosts around the world
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-semibold text-gray-900">Share Notes</h3>
                <p className="text-sm text-gray-600">
                  Leave tips, recommendations, or find travel companions
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🔐</span>
              <div>
                <h3 className="font-semibold text-gray-900">Own Your Identity</h3>
                <p className="text-sm text-gray-600">
                  Your keys, your data. No central authority controls your account
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <h3 className="font-semibold text-gray-900">Connect with Trustroots</h3>
                <p className="text-sm text-gray-600">
                  Link your Trustroots profile to build trust in the community
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setHasSeenWelcome(true)}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
            >
              Explore First
            </button>
            <a
              href="/onboarding"
              onClick={() => setHasSeenWelcome(true)}
              className="flex-1 px-4 py-3 bg-trustroots hover:bg-trustroots-dark text-white rounded-lg font-medium text-center"
            >
              Get Started
            </a>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            You can set up your identity anytime from Settings
          </p>
        </div>
      </div>
    </div>
  );
}
