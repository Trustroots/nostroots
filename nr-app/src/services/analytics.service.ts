import Constants from "expo-constants";
import { Dimensions, Platform } from "react-native";

const UMAMI_ENDPOINT = "https://1p.trustroots.org/api/send";
const UMAMI_WEBSITE_ID = "ba3d08c7-1790-45e6-9bfb-51e6cfbd0c50";
const UMAMI_HOSTNAME = "nr-app";

const ALLOWED_DATA_KEYS = new Set([
  "action",
  "intent",
  "method",
  "outcome",
  "source",
]);

type AnalyticsDataValue = boolean | number | string;
export type AnalyticsEventData = Record<string, AnalyticsDataValue>;

type UmamiPayload = {
  website: string;
  hostname: string;
  screen: string;
  language: string;
  title: string;
  url: string;
  referrer: string;
  name?: string;
  data?: AnalyticsEventData;
};

let analyticsEnabled = false;
let currentScreen = "/";

function getLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    return "en";
  }
}

function sanitizeRoute(route: string): string {
  const path = route.split(/[?#]/, 1)[0].trim();
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 120) || "/";
}

function sanitizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 50);
}

export function sanitizeAnalyticsData(
  data?: AnalyticsEventData,
): AnalyticsEventData | undefined {
  if (!data) return undefined;

  const sanitized = Object.entries(data).reduce<AnalyticsEventData>(
    (result, [key, value]) => {
      if (!ALLOWED_DATA_KEYS.has(key)) return result;

      if (typeof value === "string") {
        const safeValue = value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_:+.-]/g, "_")
          .slice(0, 80);
        if (safeValue) result[key] = safeValue;
      } else if (typeof value === "boolean" || typeof value === "number") {
        result[key] = value;
      }

      return result;
    },
    {},
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function setAnalyticsEnabled(enabled: boolean): void {
  analyticsEnabled = enabled;
}

export function createAnalyticsPayload(
  route: string,
  name?: string,
  data?: AnalyticsEventData,
): UmamiPayload {
  const { width, height } = Dimensions.get("screen");
  const url = sanitizeRoute(route);
  const eventName = name ? sanitizeName(name) : undefined;

  return {
    website: UMAMI_WEBSITE_ID,
    hostname: UMAMI_HOSTNAME,
    screen: `${Math.round(width)}x${Math.round(height)}`,
    language: getLanguage(),
    title: url,
    url,
    referrer: "",
    ...(eventName ? { name: eventName } : {}),
    ...(eventName && data ? { data: sanitizeAnalyticsData(data) } : {}),
  };
}

async function send(payload: UmamiPayload): Promise<void> {
  if (__DEV__ || Platform.OS === "web" || !analyticsEnabled) return;

  const version = Constants.expoConfig?.version ?? "unknown";

  try {
    await fetch(UMAMI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `Nostroots/${version} (${Platform.OS})`,
      },
      body: JSON.stringify({ type: "event", payload }),
    });
  } catch {
    // Analytics must never interfere with app behavior.
  }
}

export function trackScreenView(route: string): void {
  currentScreen = sanitizeRoute(route);
  void send(createAnalyticsPayload(currentScreen));
}

export function trackEvent(name: string, data?: AnalyticsEventData): void {
  const eventName = sanitizeName(name);
  if (!eventName) return;
  void send(createAnalyticsPayload(currentScreen, eventName, data));
}
