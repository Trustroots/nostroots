export function isE2EEnabled() {
  return process.env.EXPO_PUBLIC_E2E === "1";
}
