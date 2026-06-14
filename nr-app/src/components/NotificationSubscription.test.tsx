import { fireEvent, waitFor } from "@testing-library/react-native";
import Toast from "react-native-root-toast";

import NotificationSubscription from "./NotificationSubscription";
import {
  subscribeToPlusCode,
  unsubscribeFromPlusCode,
} from "@/redux/actions/notifications.actions";
import { filterForPlusCode } from "@/utils/notifications.utils";
import { createTestStore, renderWithProviders } from "@/test/test-utils";
import { TEST_PLUS_CODE } from "@/test/fixtures";

describe("NotificationSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches a subscribe request for the selected plus code", async () => {
    const store = createTestStore({
      map: {
        selectedPlusCode: TEST_PLUS_CODE,
      },
    });
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const { getAllByText } = renderWithProviders(<NotificationSubscription />, {
      store,
    });

    fireEvent.press(getAllByText("Subscribe")[1]);

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: subscribeToPlusCode(TEST_PLUS_CODE).type,
          payload: { plusCode: TEST_PLUS_CODE },
        }),
      );
      expect(Toast.show).toHaveBeenCalledWith(
        "Successfully subscribed",
        expect.objectContaining({ duration: Toast.durations.LONG }),
      );
    });
  });

  it("shows unsubscribe for an exact subscription and dispatches removal", async () => {
    const store = createTestStore({
      map: {
        selectedPlusCode: TEST_PLUS_CODE,
      },
      notifications: {
        filters: [{ filter: filterForPlusCode(TEST_PLUS_CODE) }],
      },
    });
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const { getByText } = renderWithProviders(<NotificationSubscription />, {
      store,
    });

    expect(
      getByText("You are subscribed to notifications for this plus code."),
    ).toBeTruthy();

    fireEvent.press(getByText("Unsubscribe"));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: unsubscribeFromPlusCode(TEST_PLUS_CODE).type,
          payload: { plusCode: TEST_PLUS_CODE },
        }),
      );
      expect(Toast.show).toHaveBeenCalledWith(
        "Successfully unsubscribed",
        expect.objectContaining({ duration: Toast.durations.LONG }),
      );
    });
  });
});
