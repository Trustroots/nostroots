import * as Notifications from "expo-notifications";

import { setIsDeviceMock } from "@/test/expoDeviceMock";
import {
  registerForPushNotificationsAsync,
  setupNotificationHandling,
} from "./notifications.service";

describe("notifications.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: "ExponentPushToken[test]",
    });
  });

  it("registers and returns an Expo push token when permission is granted", async () => {
    await expect(registerForPushNotificationsAsync()).resolves.toBe(
      "ExponentPushToken[test]",
    );

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "test-project-id",
    });
  });

  it("requests permission before fetching a push token", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "undetermined",
    });

    await registerForPushNotificationsAsync();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it("throws when notification permission is denied", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    await expect(registerForPushNotificationsAsync()).rejects.toThrow(
      "Permission not granted to get push token for push notification!",
    );
  });

  it("sets up response handling and returns the subscription", () => {
    const subscription = { remove: jest.fn() };
    (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mockReturnValueOnce(subscription);

    expect(setupNotificationHandling()).toBe(subscription);
    expect(
      Notifications.addNotificationResponseReceivedListener,
    ).toHaveBeenCalled();
  });

  it("throws when running off device", async () => {
    setIsDeviceMock(false);

    await expect(registerForPushNotificationsAsync()).rejects.toThrow(
      "Must use physical device for push notifications",
    );
  });
});
