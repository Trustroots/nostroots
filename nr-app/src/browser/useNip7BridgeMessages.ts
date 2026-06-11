import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { WebView, WebViewMessageEvent } from "react-native-webview";

import {
  createFailureResponse,
  createNip7ResponseScript,
  handleNip7BridgeMessage,
  isKnownNip7Method,
  requestMetadata,
} from "@/browser/nip7-bridge";
import {
  hostForOrigin,
  isRememberedOrigin,
  isTrustedNip7Origin,
  originForUrl,
  recordTrustedOriginUse,
  rememberOrigin,
} from "@/browser/permission-store";
import {
  getPublicKeyHexStringFromSecureStorage,
  nip04Decrypt,
  nip04Encrypt,
  nip44Decrypt,
  nip44Encrypt,
  signEventTemplate,
} from "@/nostr/keystore.nostr";

export interface PermissionPrompt {
  origin: string;
  host: string;
  method: string;
}

const permissionDeniedMessage =
  "This website is not allowed to use the Nostroots Browser NIP-07 key.";

export function useNip7BridgeMessages(
  webViewRef: RefObject<WebView | null>,
  currentUrlRef: RefObject<string>,
) {
  const pendingMessagesByOrigin = useRef(new Map<string, string[]>());
  const [permissionPrompt, setPermissionPrompt] =
    useState<PermissionPrompt | null>(null);

  const sendBridgeResponse = useCallback(
    async (rawMessage: string) => {
      const response = await handleNip7BridgeMessage(rawMessage, {
        getPublicKey: getPublicKeyHexStringFromSecureStorage,
        signEvent: signEventTemplate,
        nip44Encrypt,
        nip44Decrypt,
        nip04Encrypt,
        nip04Decrypt,
      });
      webViewRef.current?.injectJavaScript(createNip7ResponseScript(response));
    },
    [webViewRef],
  );

  const denyBridgeMessage = useCallback(
    (rawMessage: string) => {
      const id = requestMetadata(rawMessage)?.id || "unknown";
      webViewRef.current?.injectJavaScript(
        createNip7ResponseScript(
          createFailureResponse(id, permissionDeniedMessage),
        ),
      );
    },
    [webViewRef],
  );

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const rawMessage = event.nativeEvent.data;
      const metadata = requestMetadata(rawMessage);
      if (!metadata || !isKnownNip7Method(metadata.method)) {
        await sendBridgeResponse(rawMessage);
        return;
      }

      const origin = originForUrl(currentUrlRef.current);
      if (!origin) {
        denyBridgeMessage(rawMessage);
        return;
      }

      if (isTrustedNip7Origin(origin)) {
        await recordTrustedOriginUse(origin);
        await sendBridgeResponse(rawMessage);
        return;
      }

      if (await isRememberedOrigin(origin)) {
        await sendBridgeResponse(rawMessage);
        return;
      }

      const pending = pendingMessagesByOrigin.current.get(origin) ?? [];
      pending.push(rawMessage);
      pendingMessagesByOrigin.current.set(origin, pending);

      setPermissionPrompt((current) => {
        if (current) return current;
        return {
          origin,
          host: hostForOrigin(origin),
          method: metadata.method,
        };
      });
    },
    [currentUrlRef, denyBridgeMessage, sendBridgeResponse],
  );

  const allowPrompt = useCallback(
    async (remember: boolean) => {
      if (!permissionPrompt) return;
      const { origin } = permissionPrompt;
      if (remember) {
        await rememberOrigin(origin);
      }
      const messages = pendingMessagesByOrigin.current.get(origin) ?? [];
      pendingMessagesByOrigin.current.delete(origin);
      setPermissionPrompt(null);
      for (const message of messages) {
        await sendBridgeResponse(message);
      }
    },
    [permissionPrompt, sendBridgeResponse],
  );

  const denyPrompt = useCallback(() => {
    if (!permissionPrompt) return;
    const { origin } = permissionPrompt;
    const messages = pendingMessagesByOrigin.current.get(origin) ?? [];
    pendingMessagesByOrigin.current.delete(origin);
    setPermissionPrompt(null);
    for (const message of messages) {
      denyBridgeMessage(message);
    }
  }, [denyBridgeMessage, permissionPrompt]);

  return {
    permissionPrompt,
    handleMessage,
    allowPrompt,
    denyPrompt,
  };
}
