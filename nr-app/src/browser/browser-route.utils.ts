import { originForUrl } from "@/browser/permission-store";
import { NOSTROOTS_WEB_URL } from "@/constants";

export function resolveNip7BrowserInitialUrl(
  urlParam: string | string[] | undefined,
): string {
  const raw = Array.isArray(urlParam) ? urlParam[0] : urlParam;
  if (!raw) return NOSTROOTS_WEB_URL;
  return originForUrl(raw) ?? NOSTROOTS_WEB_URL;
}
