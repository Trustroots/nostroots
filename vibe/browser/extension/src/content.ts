import { MESSAGE_SOURCE_CONTENT, MESSAGE_SOURCE_PAGE, isKnownNip07Method } from "./shared/constants";
import type { BridgeResponse, ProviderRequest } from "./shared/messages";

injectProviderScript();

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window) return;
  const request = event.data;
  if (!isProviderRequest(request)) return;

  chrome.runtime.sendMessage(
    {
      source: MESSAGE_SOURCE_CONTENT,
      id: request.id,
      method: request.method,
      params: request.params,
      origin: window.location.origin,
    },
    (response: unknown) => {
      window.postMessage(
        {
          source: MESSAGE_SOURCE_CONTENT,
          id: request.id,
          response: response as BridgeResponse,
        },
        window.location.origin,
      );
    },
  );
});

function injectProviderScript(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("provider.js");
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
