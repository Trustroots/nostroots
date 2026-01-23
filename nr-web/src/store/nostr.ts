import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Event, Relay, Filter } from "nostr-tools";
import {
  DEFAULT_RELAY_URL,
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

type OnboardingStep = "welcome" | "identity" | "backup" | "link" | "complete";

interface NostrState {
  // Connection
  relay: Relay | null;
  connectionStatus: ConnectionStatus;

  // Events
  events: Event[];

  // Identity
  publicKey: string | null;
  privateKey: string | null;
  mnemonic: string | null;
  trustrootsUsername: string | null;

  // Onboarding
  hasCompletedOnboarding: boolean;
  hasSeenWelcome: boolean;
  onboardingStep: OnboardingStep;

  // Settings
  enabledLayers: Record<string, boolean>;
  developerMode: boolean;

  // UI State
  selectedEvent: Event | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  setKeys: (privateKey: string, publicKey: string, mnemonic?: string) => void;
  clearKeys: () => void;
  publishEvent: (event: Event) => Promise<void>;
  toggleLayer: (layer: string) => void;
  
  // Onboarding actions
  setOnboardingStep: (step: OnboardingStep) => void;
  completeOnboarding: () => void;
  setHasSeenWelcome: (seen: boolean) => void;
  resetOnboarding: () => void;

  // Profile actions
  setTrustrootsUsername: (username: string | null) => void;

  // Settings actions
  toggleDeveloperMode: () => void;

  // UI actions
  setSelectedEvent: (event: Event | null) => void;
}

export const useNostrStore = create<NostrState>()(
  persist(
    (set, get) => ({
      // Initial state
      relay: null,
      connectionStatus: "disconnected",
      events: [],
      publicKey: null,
      privateKey: null,
      mnemonic: null,
      trustrootsUsername: null,
      hasCompletedOnboarding: false,
      hasSeenWelcome: false,
      onboardingStep: "welcome",
      enabledLayers: {
        trustroots: true,
        hitchmap: true,
        hitchwiki: true,
        unverified: true,
      },
      developerMode: false,
      selectedEvent: null,

      // Connect to relay
      connect: async () => {
        const state = get();

        // Don't reconnect if already connected or connecting
        if (
          state.connectionStatus === "connected" ||
          state.connectionStatus === "connecting"
        ) {
          return;
        }

        set({ connectionStatus: "connecting" });

        try {
          const { Relay } = await import("nostr-tools");
          const relay = await Relay.connect(DEFAULT_RELAY_URL);

          set({ relay, connectionStatus: "connected" });

          // Subscribe to events
          const filters: Filter[] = [
            {
              kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND, TRUSTROOTS_PROFILE_KIND, 30399, 1],
              limit: 500,
            },
          ];

          relay.subscribe(filters, {
            onevent(event: Event) {
              set((state) => {
                // Avoid duplicates
                if (state.events.some((e) => e.id === event.id)) {
                  return state;
                }
                return { events: [...state.events, event] };
              });
            },
            oneose() {
              console.log("End of stored events");
            },
          });

          // Handle relay close
          relay.onclose = () => {
            set({ connectionStatus: "disconnected", relay: null });
          };
        } catch (error) {
          console.error("Failed to connect to relay:", error);
          set({ connectionStatus: "disconnected", relay: null });
        }
      },

      // Disconnect from relay
      disconnect: () => {
        const { relay } = get();
        if (relay) {
          relay.close();
        }
        set({ relay: null, connectionStatus: "disconnected" });
      },

      // Set keys
      setKeys: (privateKey: string, publicKey: string, mnemonic?: string) => {
        set({ privateKey, publicKey, mnemonic: mnemonic || null });
      },

      // Clear keys
      clearKeys: () => {
        set({ privateKey: null, publicKey: null, mnemonic: null, trustrootsUsername: null });
      },

      // Publish event
      publishEvent: async (event: Event) => {
        const { relay, connectionStatus } = get();

        if (connectionStatus !== "connected" || !relay) {
          throw new Error("Not connected to relay");
        }

        await relay.publish(event);

        // Add to local state only if not already present (avoid race condition with subscription)
        set((state) => {
          if (state.events.some((e) => e.id === event.id)) {
            return state;
          }
          return { events: [...state.events, event] };
        });
      },

      // Toggle layer visibility
      toggleLayer: (layer: string) => {
        set((state) => ({
          enabledLayers: {
            ...state.enabledLayers,
            [layer]: !state.enabledLayers[layer],
          },
        }));
      },

      // Onboarding actions
      setOnboardingStep: (step: OnboardingStep) => {
        set({ onboardingStep: step });
      },

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true, onboardingStep: "complete" });
      },

      setHasSeenWelcome: (seen: boolean) => {
        set({ hasSeenWelcome: seen });
      },

      resetOnboarding: () => {
        set({
          hasCompletedOnboarding: false,
          hasSeenWelcome: false,
          onboardingStep: "welcome",
        });
      },

      // Profile actions
      setTrustrootsUsername: (username: string | null) => {
        set({ trustrootsUsername: username });
      },

      // Settings actions
      toggleDeveloperMode: () => {
        set((state) => ({ developerMode: !state.developerMode }));
      },

      // UI actions
      setSelectedEvent: (event: Event | null) => {
        set({ selectedEvent: event });
      },
    }),
    {
      name: "nostroots-web-storage",
      partialize: (state) => ({
        publicKey: state.publicKey,
        privateKey: state.privateKey,
        mnemonic: state.mnemonic,
        trustrootsUsername: state.trustrootsUsername,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSeenWelcome: state.hasSeenWelcome,
        enabledLayers: state.enabledLayers,
        developerMode: state.developerMode,
        // Don't persist: events, relay, connectionStatus, UI state
      }),
    }
  )
);
