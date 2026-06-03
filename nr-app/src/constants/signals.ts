export const SIGNAL_TAG_NAME = "signal";

export const SIGNAL_INTENTS = [
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "drinks", label: "Drinks", emoji: "🍺" },
  { key: "explore", label: "Explore", emoji: "🚶" },
  { key: "hosting", label: "Hosting", emoji: "🏠" },
  { key: "ride", label: "Ride", emoji: "🚗" },
] as const;

export type SignalIntent = (typeof SIGNAL_INTENTS)[number]["key"];

export const SIGNAL_DURATIONS = [
  { key: "today", label: "Today", seconds: 24 * 60 * 60 },
  { key: "few-days", label: "Few days", seconds: 3 * 24 * 60 * 60 },
  { key: "this-week", label: "This week", seconds: 7 * 24 * 60 * 60 },
] as const;

export type SignalDuration = (typeof SIGNAL_DURATIONS)[number]["key"];
