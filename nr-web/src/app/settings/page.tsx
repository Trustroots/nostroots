"use client";

import { useState } from "react";
import { useNostrStore } from "@/store/nostr";
import { generateKeyPair, importNsec, importMnemonic } from "@/lib/keys";
import { createProfileEvent } from "@/lib/events";
import { nip19 } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";

export default function SettingsPage() {
  const {
    publicKey,
    privateKey,
    mnemonic,
    trustrootsUsername,
    hasCompletedOnboarding,
    developerMode,
    setKeys,
    clearKeys,
    connectionStatus,
    enabledLayers,
    toggleLayer,
    toggleDeveloperMode,
    setTrustrootsUsername,
    resetOnboarding,
    publishEvent,
  } = useNostrStore();

  const [nsecInput, setNsecInput] = useState("");
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleGenerateKeys = () => {
    try {
      const keys = generateKeyPair();
      setKeys(keys.privateKey, keys.publicKey, keys.mnemonic);
      setSuccess("New keys generated successfully!");
      setError(null);
    } catch {
      setError("Failed to generate keys");
      setSuccess(null);
    }
  };

  const handleImportNsec = () => {
    try {
      const keys = importNsec(nsecInput.trim());
      setKeys(keys.privateKey, keys.publicKey);
      setNsecInput("");
      setSuccess("Key imported successfully!");
      setError(null);
    } catch {
      setError("Invalid nsec format");
      setSuccess(null);
    }
  };

  const handleImportMnemonic = () => {
    try {
      const keys = importMnemonic(mnemonicInput.trim());
      setKeys(keys.privateKey, keys.publicKey, mnemonicInput.trim());
      setMnemonicInput("");
      setSuccess("Mnemonic imported successfully!");
      setError(null);
    } catch {
      setError("Invalid mnemonic");
      setSuccess(null);
    }
  };

  const handleClearKeys = () => {
    if (confirm("Are you sure you want to clear your keys? Make sure you have backed them up!")) {
      clearKeys();
      setSuccess("Keys cleared");
    }
  };

  const handlePublishProfile = async () => {
    if (!privateKey || !usernameInput.trim()) {
      setError("Please enter a username");
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const profileEvent = createProfileEvent(usernameInput.trim(), privateKey);
      await publishEvent(profileEvent);
      setTrustrootsUsername(usernameInput.trim());
      setUsernameInput("");
      setSuccess("Profile published successfully!");
    } catch {
      setError("Failed to publish profile");
    } finally {
      setIsPublishing(false);
    }
  };

  const npub = publicKey ? nip19.npubEncode(publicKey) : null;
  const nsec = privateKey ? nip19.nsecEncode(hexToBytes(privateKey)) : null;

  const layerOptions = [
    { key: "trustroots", label: "Trustroots" },
    { key: "hitchmap", label: "Hitchmap" },
    { key: "hitchwiki", label: "Hitchwiki" },
    { key: "unverified", label: "Unverified Notes" },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* Connection Status */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-3 h-3 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-gray-700 capitalize">{connectionStatus}</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Relay: wss://relay.trustroots.org
        </p>
      </section>

      {/* Map Layers */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Map Layers</h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose which data sources to display on the map
        </p>
        <div className="space-y-3">
          {layerOptions.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledLayers[key] ?? true}
                onChange={() => toggleLayer(key)}
                className="w-4 h-4 text-trustroots rounded border-gray-300 focus:ring-trustroots"
              />
              <span className="text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Trustroots Profile */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Trustroots Profile</h2>

        {trustrootsUsername ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-trustroots to-trustroots-dark flex items-center justify-center text-white font-bold text-xl">
                {trustrootsUsername[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">@{trustrootsUsername}</p>
                <a
                  href={`https://www.trustroots.org/profile/${trustrootsUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-trustroots hover:underline"
                >
                  View on Trustroots →
                </a>
              </div>
            </div>
            <button
              onClick={() => setTrustrootsUsername(null)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Unlink profile
            </button>
          </div>
        ) : publicKey ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Link your Trustroots username to build trust in the community.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trustroots Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="your-username"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={handlePublishProfile}
                  disabled={isPublishing || !usernameInput.trim()}
                  className="px-4 py-2 bg-trustroots hover:bg-trustroots-dark disabled:bg-gray-300 text-white rounded-lg text-sm"
                >
                  {isPublishing ? "Publishing..." : "Link"}
                </button>
              </div>
            </div>
            <a
              href="/onboarding"
              className="text-sm text-trustroots hover:underline"
            >
              Or complete the full onboarding →
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Set up your identity first to link your Trustroots profile.
          </p>
        )}
      </section>

      {/* Identity Section */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Your Identity</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {publicKey ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Public Key (npub)
              </label>
              <input
                type="text"
                readOnly
                value={npub || ""}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Public Key (hex)
              </label>
              <input
                type="text"
                readOnly
                value={publicKey}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
              />
            </div>

            {privateKey && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Private Key (nsec) - Keep this secret!
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPrivateKey ? "text" : "password"}
                    readOnly
                    value={nsec || ""}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    {showPrivateKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            {mnemonic && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recovery Phrase (12 words) - Keep this secret!
                </label>
                <div className="flex gap-2">
                  <input
                    type={showMnemonic ? "text" : "password"}
                    readOnly
                    value={mnemonic}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={() => setShowMnemonic(!showMnemonic)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    {showMnemonic ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleClearKeys}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm"
            >
              Clear Keys
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <button
                onClick={handleGenerateKeys}
                className="w-full px-4 py-3 bg-trustroots hover:bg-trustroots-dark text-white rounded-lg font-medium"
              >
                Generate New Keys
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Create a new nostr identity
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-3">Import Existing Key</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Import nsec
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={nsecInput}
                      onChange={(e) => setNsecInput(e.target.value)}
                      placeholder="nsec1..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={handleImportNsec}
                      disabled={!nsecInput.trim()}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white rounded-lg text-sm"
                    >
                      Import
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Import Mnemonic (12 words)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={mnemonicInput}
                      onChange={(e) => setMnemonicInput(e.target.value)}
                      placeholder="word1 word2 word3..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={handleImportMnemonic}
                      disabled={!mnemonicInput.trim()}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white rounded-lg text-sm"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Help Section */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Help</h2>

        <div className="space-y-4 text-gray-600">
          <div>
            <h3 className="font-medium text-gray-800">How does this work?</h3>
            <p className="text-sm mt-1">
              After setting up your identity, you can leave semi-public notes on
              the map. You can see notes on the map left by others, or notes
              that relate to other projects like hitchwiki and hitchmap.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800">Where can I get help?</h3>
            <p className="text-sm mt-1">
              If you encounter issues, or want to share feedback, you can reach
              the team at{" "}
              <a
                href="https://www.trustroots.org/support"
                className="text-trustroots hover:underline"
              >
                trustroots.org/support
              </a>
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800">
              What is Nostroots?
            </h3>
            <p className="text-sm mt-1">
              Nostroots is an initiative to seamlessly transition Trustroots
              onto the nostr network, enhancing privacy, security, and user
              autonomy while maintaining the community-focused ethos.
            </p>
          </div>
        </div>
      </section>

      {/* Developer Mode */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Developer Mode</h2>
            <p className="text-sm text-gray-500">Enable advanced features and debugging</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={developerMode}
              onChange={toggleDeveloperMode}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-trustroots/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-trustroots"></div>
          </label>
        </div>
      </section>

      {/* Developer Options (only shown when developer mode is on) */}
      {developerMode && (
        <section className="mb-8 p-6 bg-yellow-50 rounded-lg shadow-sm border border-yellow-200">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">
            🛠️ Developer Options
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-yellow-800">Onboarding Status</h3>
              <p className="text-sm text-yellow-700">
                Completed: {hasCompletedOnboarding ? "Yes" : "No"}
              </p>
              <button
                onClick={resetOnboarding}
                className="mt-2 px-3 py-1.5 bg-yellow-200 hover:bg-yellow-300 text-yellow-800 rounded-lg text-sm"
              >
                Reset Onboarding
              </button>
            </div>

            <div>
              <h3 className="font-medium text-yellow-800">Debug Info</h3>
              <pre className="mt-2 p-3 bg-yellow-100 rounded-lg text-xs overflow-auto">
                {JSON.stringify(
                  {
                    connectionStatus,
                    hasPublicKey: !!publicKey,
                    hasPrivateKey: !!privateKey,
                    hasMnemonic: !!mnemonic,
                    trustrootsUsername,
                    hasCompletedOnboarding,
                    enabledLayers,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
