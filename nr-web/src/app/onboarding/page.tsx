"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNostrStore } from "@/store/nostr";
import { generateKeyPair } from "@/lib/keys";
import { createProfileEvent } from "@/lib/events";
import { nip19 } from "nostr-tools";

type Step = "identity" | "backup" | "link";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("identity");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Identity step state
  const [generatedKeys, setGeneratedKeys] = useState<{
    privateKey: string;
    publicKey: string;
    mnemonic: string;
  } | null>(null);

  // Backup step state
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Link step state
  const [trustrootsUsername, setTrustrootsUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const {
    publicKey,
    setKeys,
    completeOnboarding,
    setTrustrootsUsername: saveTrustrootsUsername,
    publishEvent,
    connect,
  } = useNostrStore();

  // Connect to relay on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Generate keys on identity step
  const handleGenerateKeys = () => {
    try {
      const keys = generateKeyPair();
      setGeneratedKeys(keys);
      setError(null);
    } catch {
      setError("Failed to generate keys. Please try again.");
    }
  };

  // Save keys and move to backup step
  const handleSaveKeys = () => {
    if (!generatedKeys) return;
    setKeys(generatedKeys.privateKey, generatedKeys.publicKey, generatedKeys.mnemonic);
    setCurrentStep("backup");
  };

  // Confirm backup and move to link step
  const handleConfirmBackup = () => {
    if (!backupConfirmed) {
      setError("Please confirm that you have backed up your recovery phrase");
      return;
    }
    setCurrentStep("link");
    setError(null);
  };

  // Copy mnemonic to clipboard
  const handleCopyMnemonic = async () => {
    if (!generatedKeys?.mnemonic) return;
    try {
      await navigator.clipboard.writeText(generatedKeys.mnemonic);
      alert("Recovery phrase copied to clipboard!");
    } catch {
      setError("Failed to copy. Please select and copy manually.");
    }
  };

  // Verify Trustroots profile
  const handleVerifyProfile = async () => {
    if (!trustrootsUsername.trim()) {
      setError("Please enter your Trustroots username");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Generate verification code from public key
      const npub = publicKey ? nip19.npubEncode(publicKey) : "";
      const code = npub.slice(-8).toUpperCase();
      setVerificationCode(code);

      // In a real implementation, this would verify against the Trustroots API
      // For now, we'll show the verification code and let the user confirm
      
      // After user confirms they've added the code to their profile:
      // - We would call Trustroots API to verify
      // - Then publish a profile event
      
    } catch {
      setError("Failed to start verification. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Complete profile linking
  const handleCompleteLink = async () => {
    if (!trustrootsUsername.trim() || !publicKey) {
      setError("Missing username or public key");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { privateKey } = useNostrStore.getState();
      if (!privateKey) throw new Error("No private key");

      // Create and publish profile event
      const profileEvent = createProfileEvent(trustrootsUsername.trim(), privateKey);
      await publishEvent(profileEvent);

      saveTrustrootsUsername(trustrootsUsername.trim());
      completeOnboarding();
      router.push("/");
    } catch (err) {
      setError("Failed to publish profile. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Skip linking and complete onboarding
  const handleSkipLink = () => {
    completeOnboarding();
    router.push("/");
  };

  const steps = [
    { id: "identity", label: "Create Identity", number: 1 },
    { id: "backup", label: "Backup", number: 2 },
    { id: "link", label: "Link Profile", number: 3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep === step.id
                    ? "bg-trustroots text-white"
                    : steps.findIndex((s) => s.id === currentStep) > index
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {steps.findIndex((s) => s.id === currentStep) > index ? "✓" : step.number}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    steps.findIndex((s) => s.id === currentStep) > index
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Identity Step */}
          {currentStep === "identity" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Create Your Identity
              </h2>
              <p className="text-gray-600 mb-6">
                Generate a new Nostr identity. This creates cryptographic keys that
                only you control.
              </p>

              {!generatedKeys ? (
                <button
                  onClick={handleGenerateKeys}
                  className="w-full py-3 bg-trustroots hover:bg-trustroots-dark text-white rounded-lg font-medium"
                >
                  Generate New Identity
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium mb-2">
                      ✓ Identity Generated!
                    </p>
                    <p className="text-sm text-green-700">
                      Your public key (npub):
                    </p>
                    <code className="text-xs bg-green-100 p-2 rounded block mt-1 break-all">
                      {nip19.npubEncode(generatedKeys.publicKey)}
                    </code>
                  </div>

                  <button
                    onClick={handleSaveKeys}
                    className="w-full py-3 bg-trustroots hover:bg-trustroots-dark text-white rounded-lg font-medium"
                  >
                    Continue to Backup
                  </button>
                </div>
              )}

              {error && (
                <p className="mt-4 text-red-600 text-sm">{error}</p>
              )}
            </div>
          )}

          {/* Backup Step */}
          {currentStep === "backup" && generatedKeys && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Backup Your Recovery Phrase
              </h2>
              <p className="text-gray-600 mb-6">
                Write down these 12 words and store them safely. This is the only
                way to recover your identity if you lose access.
              </p>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-800 text-sm font-medium mb-2">
                  ⚠️ Never share these words with anyone!
                </p>
              </div>

              <div className="relative">
                <div
                  className={`p-4 bg-gray-100 rounded-lg font-mono text-center ${
                    !showMnemonic ? "blur-sm select-none" : ""
                  }`}
                >
                  {generatedKeys.mnemonic}
                </div>
                {!showMnemonic && (
                  <button
                    onClick={() => setShowMnemonic(true)}
                    className="absolute inset-0 flex items-center justify-center bg-gray-100/50 rounded-lg"
                  >
                    <span className="px-4 py-2 bg-white rounded-lg shadow text-gray-700">
                      Click to reveal
                    </span>
                  </button>
                )}
              </div>

              {showMnemonic && (
                <button
                  onClick={handleCopyMnemonic}
                  className="mt-2 w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                >
                  Copy to Clipboard
                </button>
              )}

              <label className="flex items-start gap-3 mt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  onChange={(e) => setBackupConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-trustroots rounded"
                />
                <span className="text-sm text-gray-700">
                  I have written down my recovery phrase and stored it in a safe
                  place. I understand that if I lose it, I cannot recover my
                  identity.
                </span>
              </label>

              <button
                onClick={handleConfirmBackup}
                disabled={!backupConfirmed}
                className="mt-6 w-full py-3 bg-trustroots hover:bg-trustroots-dark disabled:bg-gray-300 text-white rounded-lg font-medium"
              >
                Continue
              </button>

              {error && (
                <p className="mt-4 text-red-600 text-sm">{error}</p>
              )}
            </div>
          )}

          {/* Link Step */}
          {currentStep === "link" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Link Your Trustroots Profile
              </h2>
              <p className="text-gray-600 mb-6">
                Connect your Trustroots account to build trust in the community.
                This step is optional but recommended.
              </p>

              {!verificationCode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trustroots Username
                    </label>
                    <input
                      type="text"
                      value={trustrootsUsername}
                      onChange={(e) => setTrustrootsUsername(e.target.value)}
                      placeholder="your-username"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trustroots focus:border-trustroots"
                    />
                  </div>

                  <button
                    onClick={handleVerifyProfile}
                    disabled={isVerifying || !trustrootsUsername.trim()}
                    className="w-full py-3 bg-trustroots hover:bg-trustroots-dark disabled:bg-gray-300 text-white rounded-lg font-medium"
                  >
                    {isVerifying ? "Verifying..." : "Start Verification"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 font-medium mb-2">
                      Verification Code:
                    </p>
                    <code className="text-2xl font-bold text-blue-900">
                      {verificationCode}
                    </code>
                  </div>

                  <div className="text-sm text-gray-600 space-y-2">
                    <p>To verify your profile:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>
                        Go to your{" "}
                        <a
                          href={`https://www.trustroots.org/profile/${trustrootsUsername}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-trustroots hover:underline"
                        >
                          Trustroots profile settings
                        </a>
                      </li>
                      <li>Add the verification code to your profile description</li>
                      <li>Come back here and click &quot;Complete Verification&quot;</li>
                    </ol>
                  </div>

                  <button
                    onClick={handleCompleteLink}
                    disabled={isLoading}
                    className="w-full py-3 bg-trustroots hover:bg-trustroots-dark disabled:bg-gray-300 text-white rounded-lg font-medium"
                  >
                    {isLoading ? "Publishing..." : "Complete Verification"}
                  </button>
                </div>
              )}

              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={handleSkipLink}
                  className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Skip for now →
                </button>
              </div>

              {error && (
                <p className="mt-4 text-red-600 text-sm">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Back button */}
        {currentStep !== "identity" && (
          <button
            onClick={() => {
              if (currentStep === "backup") setCurrentStep("identity");
              if (currentStep === "link") setCurrentStep("backup");
            }}
            className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
