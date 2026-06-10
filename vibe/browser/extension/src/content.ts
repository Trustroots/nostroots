import { MESSAGE_SOURCE_CONTENT, MESSAGE_SOURCE_PAGE, isKnownNip07Method } from "./shared/constants";
import { extensionApi } from "./shared/extension-api";
import type { BridgeResponse, ProviderRequest } from "./shared/messages";

injectProviderScript();

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window) return;
  const request = event.data;
  if (!isProviderRequest(request)) return;

  void extensionApi.runtime
    .sendMessage<BridgeResponse>({
      source: MESSAGE_SOURCE_CONTENT,
      id: request.id,
      method: request.method,
      params: request.params,
      origin: window.location.origin,
    })
    .then(
      (response) => {
        window.postMessage(
          {
            source: MESSAGE_SOURCE_CONTENT,
            id: request.id,
            response,
          },
          window.location.origin,
        );
      },
      (error) => {
        window.postMessage(
          {
            source: MESSAGE_SOURCE_CONTENT,
            id: request.id,
            response: {
              ok: false,
              id: request.id,
              error: error instanceof Error ? error.message : "Nostroots Browser Extension request failed.",
            },
          },
          window.location.origin,
        );
      },
    );
});

function injectProviderScript(): void {
  const script = document.createElement("script");
  script.src = extensionApi.runtime.getURL("provider.js");
  script.async = false;
  script.type = "text/javascript";
  (document.head || document.documentElement).appendChild(script);
}

function isProviderRequest(value: unknown): value is ProviderRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ProviderRequest).source === MESSAGE_SOURCE_PAGE &&
    typeof (value as ProviderRequest).id === "string" &&
    isKnownNip07Method((value as ProviderRequest).method)
  );
}
