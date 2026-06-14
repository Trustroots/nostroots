import { NOSTROOTS_WEB_URL } from "@/constants";

export type NavigationDecision = "allow" | "open-externally" | "cancel";

export function normalizeDeveloperUrl(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) return NOSTROOTS_WEB_URL;
  if (/^https?:\/\//i.test(trimmedInput)) return trimmedInput;
  return `https://${trimmedInput}`;
}

export function navigationDecision(
  url: string | null | undefined,
): NavigationDecision {
  if (!url) return "cancel";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "open-externally";
    }
    return "allow";
  } catch {
    return "cancel";
  }
}
