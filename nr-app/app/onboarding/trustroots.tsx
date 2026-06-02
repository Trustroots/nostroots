import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { AlertTriangleIcon, MailCheckIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  authenticateWithCode,
  NrBridgeError,
  requestVerificationToken,
} from "@/services/nrBridge.service";
import { ensureOnboardingIdentity } from "@/services/onboardingIdentity.service";
import { finalizeTrustrootsProfilePublish } from "@/services/trustrootsProfile.service";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { validateTrustrootsUsername } from "@/utils/trustrootsUsername.utils";

type TrustrootsScreenState =
  | "idle"
  | "requesting"
  | "code-entry"
  | "authenticating"
  | "profile-retry"
  | "profile-publishing";

const AUTHENTICATION_FAILURE_MESSAGE = "failed to authenticate you. try again";
const LOG_PREFIX = "[nr-app:onboarding:trustroots]";

function getRequestErrorMessage(error: unknown): string {
  console.log(`${LOG_PREFIX} map request error message`, {
    isNrBridgeError: error instanceof NrBridgeError,
    code: error instanceof NrBridgeError ? error.code : undefined,
    status: error instanceof NrBridgeError ? error.status : undefined,
    message: error instanceof Error ? error.message : String(error),
  });

  if (error instanceof NrBridgeError) {
    if (error.code === "config") {
      return "Verification service is not configured.";
    }
    if (error.code === "network") {
      return "Could not reach the verification service. Try again.";
    }
  }

  return "Could not send a verification code. Try again.";
}

export default function OnboardingTrustrootsScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { error: errorParam } = useLocalSearchParams<{ error?: string }>();

  const pendingTrustrootsUsername = useAppSelector(
    settingsSelectors.selectPendingTrustrootsUsername,
  );
  const pendingTrustrootsProfileUsername = useAppSelector(
    settingsSelectors.selectPendingTrustrootsProfileUsername,
  );

  const [screenState, setScreenState] = useState<TrustrootsScreenState>("idle");
  const [usernameInput, setUsernameInput] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log(`${LOG_PREFIX} route error param changed`, { errorParam });
    if (errorParam === "auth") {
      setStatusMessage(AUTHENTICATION_FAILURE_MESSAGE);
    } else if (errorParam === "missing-token") {
      setStatusMessage("Verification link is missing a token. Try again.");
    } else if (errorParam === "start-in-app") {
      setStatusMessage(
        "Start verification in the app before opening the email link.",
      );
    }
  }, [errorParam]);

  useEffect(() => {
    console.log(`${LOG_PREFIX} pending state effect`, {
      pendingTrustrootsUsername,
      pendingTrustrootsProfileUsername,
      screenState,
    });

    if (pendingTrustrootsProfileUsername) {
      setUsernameInput(pendingTrustrootsProfileUsername);
      setScreenState("profile-retry");
      setStatusMessage(
        "Your Trustroots account was authenticated. Retry the profile publish to finish setup.",
      );
      return;
    }

    if (pendingTrustrootsUsername && screenState === "idle") {
      setUsernameInput(pendingTrustrootsUsername);
      setScreenState("code-entry");
      setStatusMessage("Enter the six-digit code from your email.");
    }
  }, [
    pendingTrustrootsProfileUsername,
    pendingTrustrootsUsername,
    screenState,
  ]);

  const resetToUsernameEntry = useCallback(
    (message?: string) => {
      console.log(`${LOG_PREFIX} reset to username entry`, { message });
      setCode("");
      setFieldError(null);
      setStatusMessage(message ?? null);
      setScreenState("idle");
      dispatch(settingsActions.clearPendingTrustrootsUsername());
    },
    [dispatch],
  );

  const runProfileFinalization = useCallback(
    async (username: string) => {
      console.log(`${LOG_PREFIX} profile finalization start`, { username });
      try {
        setScreenState("profile-publishing");
        await finalizeTrustrootsProfilePublish(username, dispatch);
        console.log(`${LOG_PREFIX} profile finalization success`, { username });
        router.replace("/onboarding/backup-confirm?from=bridge");
      } catch (error) {
        console.error("Failed to publish Trustroots profile", error);
        setScreenState("profile-retry");
        setStatusMessage(
          "Your Trustroots account was authenticated, but profile publishing failed. Try again.",
        );
      }
    },
    [dispatch, router],
  );

  const handleRequestCode = useCallback(async () => {
    console.log(`${LOG_PREFIX} request code pressed`, {
      rawUsernameInput: usernameInput,
    });
    const result = validateTrustrootsUsername(usernameInput);
    console.log(`${LOG_PREFIX} username validation result`, {
      success: result.success,
      username: result.success ? result.username : undefined,
      error: result.success ? undefined : result.error,
    });

    if (!result.success) {
      console.log(`${LOG_PREFIX} username validation failed`, {
        error: result.error,
      });
      setFieldError(result.error);
      return;
    }

    setScreenState("requesting");
    setFieldError(null);
    setStatusMessage(null);

    try {
      console.log(`${LOG_PREFIX} request verification token start`, {
        username: result.username,
      });
      await requestVerificationToken(result.username);
      console.log(`${LOG_PREFIX} request verification token success`, {
        username: result.username,
      });
      dispatch(settingsActions.setPendingTrustrootsUsername(result.username));
      setUsernameInput(result.username);
      setCode("");
      setStatusMessage("Check your Trustroots email for a six-digit code.");
      setScreenState("code-entry");
    } catch (error) {
      console.log(`${LOG_PREFIX} request verification token error`, {
        isNrBridgeError: error instanceof NrBridgeError,
        code: error instanceof NrBridgeError ? error.code : undefined,
        status: error instanceof NrBridgeError ? error.status : undefined,
        message: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof NrBridgeError && error.code === "already-pending") {
        console.log(`${LOG_PREFIX} handling already pending verification`, {
          username: result.username,
        });
        dispatch(settingsActions.setPendingTrustrootsUsername(result.username));
        setUsernameInput(result.username);
        setCode("");
        setStatusMessage(
          "A verification code is already pending. Check your Trustroots email.",
        );
        setScreenState("code-entry");
        return;
      }

      if (error instanceof NrBridgeError && error.code === "not-found") {
        console.log(`${LOG_PREFIX} handling username not found`, {
          username: result.username,
        });
        setFieldError("Trustroots username not found.");
        setScreenState("idle");
        return;
      }

      setStatusMessage(getRequestErrorMessage(error));
      setScreenState("idle");
    }
  }, [dispatch, usernameInput]);

  const handleCodeChange = (value: string) => {
    const sanitizedCode = value.replace(/\D/g, "").slice(0, 6);
    console.log(`${LOG_PREFIX} code input changed`, {
      rawLength: value.length,
      sanitizedLength: sanitizedCode.length,
    });
    setCode(sanitizedCode);
    setStatusMessage(null);
  };

  const handleAuthenticateCode = useCallback(async () => {
    const username =
      pendingTrustrootsUsername ?? usernameInput.trim().toLowerCase();
    console.log(`${LOG_PREFIX} authenticate code pressed`, {
      username,
      codeLength: code.length,
      hasPendingTrustrootsUsername: !!pendingTrustrootsUsername,
    });

    if (!username || code.length !== 6) {
      console.log(`${LOG_PREFIX} authenticate code ignored`, {
        hasUsername: !!username,
        codeLength: code.length,
      });
      return;
    }

    setScreenState("authenticating");
    setStatusMessage(null);

    try {
      console.log(`${LOG_PREFIX} ensure identity start`);
      const { npub } = await ensureOnboardingIdentity(dispatch);
      console.log(`${LOG_PREFIX} ensure identity success`, {
        hasNpub: !!npub,
      });
      console.log(`${LOG_PREFIX} authenticate with code start`, {
        username,
        codeLength: code.length,
      });
      await authenticateWithCode({ username, npub, code });
      console.log(`${LOG_PREFIX} authenticate with code success`, {
        username,
      });
    } catch (error) {
      console.error("Failed to authenticate Trustroots code", error);
      resetToUsernameEntry(AUTHENTICATION_FAILURE_MESSAGE);
      return;
    }

    await runProfileFinalization(username);
  }, [
    code,
    dispatch,
    pendingTrustrootsUsername,
    resetToUsernameEntry,
    runProfileFinalization,
    usernameInput,
  ]);

  const handleRetryProfilePublish = useCallback(async () => {
    const username = pendingTrustrootsProfileUsername;
    console.log(`${LOG_PREFIX} retry profile publish pressed`, { username });
    if (!username) {
      resetToUsernameEntry();
      return;
    }

    await runProfileFinalization(username);
  }, [
    pendingTrustrootsProfileUsername,
    resetToUsernameEntry,
    runProfileFinalization,
  ]);

  const handleSignup = async () => {
    console.log(`${LOG_PREFIX} signup pressed`);
    await WebBrowser.openBrowserAsync("https://www.trustroots.org/signup");
  };

  const goLegacyKeyFlow = () => {
    console.log(`${LOG_PREFIX} legacy key flow pressed`);
    router.push("/onboarding/key");
  };

  const goBack = () => {
    console.log(`${LOG_PREFIX} back pressed`, {
      canGoBack: router.canGoBack(),
    });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.dismissTo("/onboarding/identity");
    }
  };

  const isBusy =
    screenState === "requesting" ||
    screenState === "authenticating" ||
    screenState === "profile-publishing";
  const isCodeEntry =
    screenState === "code-entry" || screenState === "authenticating";
  const isProfileRetry =
    screenState === "profile-retry" || screenState === "profile-publishing";

  return (
    <>
      <View className="flex items-center gap-6">
        <MailCheckIcon size={128} color="#fff" strokeWidth={0.5} />
        <Text variant="h1" className="my-0">
          Verify your Trustroots email
        </Text>
      </View>

      <Text variant="p" className="mt-0">
        Enter your Trustroots username. We’ll email the address on that account
        with a six-digit code and an app link.
      </Text>

      <View className="bg-card rounded-xl p-4 w-full gap-3">
        {isProfileRetry ? (
          <>
            <Text className="font-bold text-foreground">
              Finish profile setup
            </Text>
            <Text className="text-sm text-muted-foreground text-left">
              Your email verification succeeded. Publish your Trustroots profile
              marker to finish onboarding.
            </Text>
            <Button
              title={
                screenState === "profile-publishing" ? "Publishing..." : "Retry"
              }
              onPress={handleRetryProfilePublish}
              disabled={isBusy}
            />
          </>
        ) : (
          <>
            <Text className="font-bold text-foreground text-left">
              Trustroots username
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={usernameInput}
              onChangeText={(value) => {
                setUsernameInput(value);
                setFieldError(null);
                setStatusMessage(null);
              }}
              editable={!isBusy && !isCodeEntry}
              placeholder="your-username"
              placeholderTextColor="#6b7280"
              className="w-full bg-muted text-foreground rounded-md p-3 text-sm text-left"
            />
            {fieldError && (
              <Text className="text-xs text-red-500 text-left">
                {fieldError}
              </Text>
            )}

            {isCodeEntry ? (
              <>
                <Text className="font-bold text-foreground text-left mt-3">
                  Six-digit code
                </Text>
                <TextInput
                  value={code}
                  onChangeText={handleCodeChange}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  editable={!isBusy}
                  placeholder="123456"
                  placeholderTextColor="#6b7280"
                  className="w-full bg-muted text-foreground rounded-md p-3 text-lg tracking-widest text-center"
                />
                <Button
                  title={
                    screenState === "authenticating"
                      ? "Authenticating..."
                      : "Verify code"
                  }
                  disabled={isBusy || code.length !== 6}
                  onPress={handleAuthenticateCode}
                />
                <Button
                  variant="outline"
                  title="Use a different username"
                  textClassName="text-foreground"
                  disabled={isBusy}
                  onPress={() => resetToUsernameEntry()}
                />
              </>
            ) : (
              <Button
                title={
                  screenState === "requesting"
                    ? "Sending..."
                    : "Verify Trustroots email"
                }
                disabled={isBusy}
                onPress={handleRequestCode}
              />
            )}
          </>
        )}
      </View>

      {statusMessage && (
        <View className="flex flex-row gap-4 items-center bg-red-700 px-3 py-2 rounded-lg">
          <AlertTriangleIcon color="white" />
          <Text className="text-xs shrink text-white">{statusMessage}</Text>
        </View>
      )}

      <View className="w-full gap-2">
        <Button
          variant="secondary"
          onPress={handleSignup}
          size="lg"
          title="Sign up for a new Trustroots account"
          disabled={isBusy}
        />
        <Button
          variant="outline"
          textClassName="text-white"
          onPress={goLegacyKeyFlow}
          size="lg"
          title="I’ve already set my key on Trustroots"
          disabled={isBusy}
        />
      </View>

      <View className="flex flex-row gap-2">
        <Button
          variant="outline"
          textClassName="text-white"
          onPress={goBack}
          size="lg"
          title="Back"
          disabled={isBusy}
        />
      </View>
    </>
  );
}
