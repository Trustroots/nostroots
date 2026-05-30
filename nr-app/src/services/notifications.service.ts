import { getPlusCodeFromEvent } from "@/utils/event.utils";
import { getExpoProjectId } from "@/utils/expo.utils";
import { navigateToEvent } from "@/utils/navigation.utils";
import { EventJSONNotificationDataSchema } from "@trustroots/nr-common";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { NostrEvent } from "nostr-tools";
import { Platform } from "react-native";
import Toast from "react-native-root-toast";
import { match } from "ts-pattern";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function handleRegistrationError(errorMessage: string) {
  throw new Error(errorMessage);
}

async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return status;
  return (await Notifications.requestPermissionsAsync()).status;
}

export async function registerForPushNotificationsAsync() {
  match(Platform.OS).with("android", () => {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  });

  if (!Device.isDevice) {
    return handleRegistrationError(
      "Must use physical device for push notifications",
    );
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return handleRegistrationError("Project ID not found");
  }

  const status = await ensureNotificationPermission();
  if (status !== "granted") {
    return handleRegistrationError(
      "Permission not granted to get push token for push notification!",
    );
  }

  try {
    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
    return pushTokenString;
  } catch (e: unknown) {
    handleRegistrationError(`${e}`);
  }
}

let lastHandledResponseId: string | null = null;

function notificationResponseReceived(
  response: Notifications.NotificationResponse,
): void {
  const notificationData = response.notification.request.content.data;

  // NOTE: We currently only use JSON notes, but this will change
  const parseResult =
    EventJSONNotificationDataSchema.safeParse(notificationData);

  if (!parseResult.success) {
    if (__DEV__)
      console.log(
        "#IBadHG Unknown notification payload received",
        parseResult,
        notificationData,
      );

    // TODO Figure out how to log errors here
    Toast.show(
      `Unknown notification payload received #aiylbx\n${JSON.stringify(notificationData)}`,
      {
        duration: Toast.durations.LONG,
      },
    );
    return;
  }

  const event: NostrEvent = JSON.parse(parseResult.data.event);

  const plusCode = getPlusCodeFromEvent(event);
  if (typeof plusCode !== "string") return;

  navigateToEvent(plusCode, event);
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const responseId = response.notification.request.identifier;
  if (lastHandledResponseId === responseId) {
    return;
  }
  lastHandledResponseId = responseId;
  notificationResponseReceived(response);
}

function handleInitialNotificationResponse() {
  try {
    const response = Notifications.getLastNotificationResponse();
    if (response) {
      handleNotificationResponse(response);
    }
  } catch (error) {
    if (__DEV__) {
      console.log(
        "#2t3pWw Failed to read initial notification response",
        error,
      );
    }
  }
}

export function setupNotificationHandling() {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse,
  );
  handleInitialNotificationResponse();
  return subscription;
}
