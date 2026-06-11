import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { WebView, WebViewMessageEvent } from "react-native-webview";

import {
  createFailureResponse,
  createNip7ResponseScript,
  handleNip7BridgeMessage,
  isKnownNip7Method,
  type Nip7Method,
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
  method: Nip7Method;
}

const permissionDeniedMessage =
  "This website is not allowed to use the Nostroots Browser NIP-07 key.";

interface PendingPermissionMessages {
  origin: string;
  method: Nip7Method;
  messages: string[];
}

function pendingPermissionKey(origin: string, method: Nip7Method): string {
  return `${origin}\n${method}`;
}

export function useNip7BridgeMessages(
  webViewRef: RefObject<WebView | null>,
  currentUrlRef: RefObject<string>,
) {
  const pendingMessagesByPermission = useRef(
    new Map<string, PendingPermissionMessages>(),
  );
  const [permissionPrompt, setPermissionPrompt] =
    useState<PermissionPrompt | null>(null);
  const permissionPromptRef = useRef<PermissionPrompt | null>(null);

  useEffect(() => {
    permissionPromptRef.current = permissionPrompt;
  }, [permissionPrompt]);

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

  const denyPendingForOrigin = useCallback(
    (origin: string) => {
      for (const [key, pending] of pendingMessagesByPermission.current) {
        if (pending.origin !== origin) continue;
        pendingMessagesByPermission.current.delete(key);
        for (const message of pending.messages) {
          denyBridgeMessage(message);
        }
      }
    },
    [denyBridgeMessage],
  );

  const showNextPermissionPrompt = useCallback(() => {
    const next = pendingMessagesByPermission.current.values().next().value as
      | PendingPermissionMessages
      | undefined;
    setPermissionPrompt(
      next
        ? {
            origin: next.origin,
            host: hostForOrigin(next.origin),
            method: next.method,
          }
        : null,
    );
  }, []);

  const handleNavigationUrlChange = useCallback(
    (url: string) => {
      const nextOrigin = originForUrl(url);
      const previousOrigin = originForUrl(currentUrlRef.current);
      currentUrlRef.current = url;

      if (previousOrigin === nextOrigin) return;

      const currentPrompt = permissionPromptRef.current;
      if (currentPrompt && currentPrompt.origin !== nextOrigin) {
        denyPendingForOrigin(currentPrompt.origin);
        setPermissionPrompt(null);
      }

      for (const pending of [...pendingMessagesByPermission.current.values()]) {
        if (pending.origin !== nextOrigin) {
          denyPendingForOrigin(pending.origin);
        }
      }
    },
    [currentUrlRef, denyPendingForOrigin],
  );

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const rawMessage = event.nativeEvent.data;
      const metadata = requestMetadata(rawMessage);
      if (!metadata) return;

      if (!isKnownNip7Method(metadata.method)) {
        denyBridgeMessage(rawMessage);
        return;
      }

      const origin =
        originForUrl(event.nativeEvent.url) ??
        originForUrl(currentUrlRef.current);
      if (!origin) {
        denyBridgeMessage(rawMessage);
        return;
      }

      if (isTrustedNip7Origin(origin)) {
        await recordTrustedOriginUse(origin);
        await sendBridgeResponse(rawMessage);
        return;
      }

      if (await isRememberedOrigin(origin, metadata.method)) {
        await sendBridgeResponse(rawMessage);
        return;
      }

      const key = pendingPermissionKey(origin, metadata.method);
      const pending = pendingMessagesByPermission.current.get(key) ?? {
        origin,
        method: metadata.method,
        messages: [],
      };
      pending.messages.push(rawMessage);
      pendingMessagesByPermission.current.set(key, pending);

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
      const { origin, method } = permissionPrompt;
      if (remember) {
        await rememberOrigin(origin, method);
      }
      const key = pendingPermissionKey(origin, method);
      const messages =
        pendingMessagesByPermission.current.get(key)?.messages ?? [];
      pendingMessagesByPermission.current.delete(key);
      setPermissionPrompt(null);
      for (const message of messages) {
        await sendBridgeResponse(message);
      }
      showNextPermissionPrompt();
    },
    [permissionPrompt, sendBridgeResponse, showNextPermissionPrompt],
  );

  const denyPrompt = useCallback(() => {
    if (!permissionPrompt) return;
    const { origin, method } = permissionPrompt;
    const key = pendingPermissionKey(origin, method);
    const messages =
      pendingMessagesByPermission.current.get(key)?.messages ?? [];
    pendingMessagesByPermission.current.delete(key);
    for (const message of messages) {
      denyBridgeMessage(message);
    }
    setPermissionPrompt(null);
    showNextPermissionPrompt();
  }, [denyBridgeMessage, permissionPrompt, showNextPermissionPrompt]);

  return {
    permissionPrompt,
    handleMessage,
    handleNavigationUrlChange,
    allowPrompt,
    denyPrompt,
  };
}
