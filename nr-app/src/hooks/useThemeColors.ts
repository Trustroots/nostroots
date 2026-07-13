import { useColorScheme } from "@/hooks/useColorScheme";
import { THEME } from "@/utils/theme.utils";

/**
 * The active half of the THEME palette, for the native props that NativeWind's
 * className cannot reach (icon `color`, `placeholderTextColor`, map styles...).
 */
export function useThemeColors() {
  return THEME[useColorScheme()];
}
