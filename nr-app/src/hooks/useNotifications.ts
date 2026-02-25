import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getExpoProjectId } from "@/utils/expo.utils";
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
  // removing this alert so it doesn't annoy us during dev
  // alert(errorMessage);
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

/** @todo I believe this will set up multiple listeners if hook is used in multiple places? */
export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState(
    "only works on device with dev build",
  );
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >(undefined);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);
  useEffect(() => {
    registerForPushNotificationsAsync()
      .then((token) => setExpoPushToken(token ?? ""))
      .catch((error: any) => setExpoPushToken(`${error}`));

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log(response);
      });

    return () => {
      notificationListener.current && notificationListener.current.remove();
      responseListener.current && responseListener.current.remove();
    };
  }, []);
  return { expoPushToken, notification };
}
