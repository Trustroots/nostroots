import type { NostrEvent } from "nostr-tools";
import type { PushToken } from "./subscriptionStore.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function truncateContent(s: string, max: number): string {
  const runes = [...s];
  if (runes.length <= max) return s;
  return runes.slice(0, max).join("") + "...";
}

interface ExpoPushMessage {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly priority: string;
  readonly data: {
    readonly type: string;
    readonly event: string;
  };
}

interface ExpoPushTicket {
  readonly status: "ok" | "error";
  readonly message?: string;
  readonly id?: string;
}

export async function sendPushNotifications(
  tokens: readonly PushToken[],
  event: NostrEvent,
  expoAccessToken: string,
  username?: string,
): Promise<void> {
  const title = `${username ?? "Somebody"} posted on the map`;
  const body = truncateContent(event.content, 80);
  const eventJson = JSON.stringify(event);

  const messages: readonly ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    priority: "default",
    data: {
      type: "eventJSON",
      event: eventJson,
    },
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        `Expo Push API error: ${response.status} ${response.statusText}`,
      );
      return;
    }

    const result = await response.json();
    const tickets = result.data as readonly ExpoPushTicket[];

    tickets.forEach((ticket, i) => {
      if (ticket.status === "ok") {
        console.log(`Sent push to ${tokens[i]}`);
      } else {
        console.error(`Failed to send to ${tokens[i]}: ${ticket.message}`);
      }
    });
  } catch (error) {
    console.error("Expo push error:", error);
  }
}
