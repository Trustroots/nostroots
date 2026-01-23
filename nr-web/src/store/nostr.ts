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

interface NostrState {
  // Connection
  relay: Relay | null;
  connectionStatus: ConnectionStatus;

  // Events
  events: Event[];

  // Identity
  publicKey: string | null;
  privateKey: string | null;

  // Settings
  enabledLayers: Record<string, boolean>;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  setKeys: (privateKey: string, publicKey: string) => void;
  clearKeys: () => void;
  publishEvent: (event: Event) => Promise<void>;
  toggleLayer: (layer: string) => void;
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
      enabledLayers: {
        trustroots: true,
        hitchmap: true,
        hitchwiki: true,
        unverified: true,
      },

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
              kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND, TRUSTROOTS_PROFILE_KIND, 30399],
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
      setKeys: (privateKey: string, publicKey: string) => {
        set({ privateKey, publicKey });
      },

      // Clear keys
      clearKeys: () => {
        set({ privateKey: null, publicKey: null });
      },

      // Publish event
      publishEvent: async (event: Event) => {
        const { relay, connectionStatus } = get();

        if (connectionStatus !== "connected" || !relay) {
          throw new Error("Not connected to relay");
        }

        await relay.publish(event);

        // Add to local state
        set((state) => ({
          events: [...state.events, event],
        }));
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
    }),
    {
      name: "nostroots-web-storage",
      partialize: (state) => ({
        publicKey: state.publicKey,
        privateKey: state.privateKey,
        enabledLayers: state.enabledLayers,
        // Don't persist events - they should be fetched fresh
      }),
    }
  )
);
