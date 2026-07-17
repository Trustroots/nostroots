import { useColorScheme as useNativewindColorScheme } from "nativewind";

/**
 * The app's effective colour scheme, honouring the in-app Appearance setting.
 *
 * React Native's own useColorScheme reports the OS scheme and is unaware of
 * nativewind's colorScheme.set(), which is what the Appearance setting drives.
 */
export function useColorScheme(): "light" | "dark" {
  const { colorScheme } = useNativewindColorScheme();
  return colorScheme ?? "light";
}
