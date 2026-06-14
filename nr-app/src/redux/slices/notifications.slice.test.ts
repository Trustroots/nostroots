import {
  notificationSelectors,
  notificationsActions,
  notificationsSlice,
} from "./notifications.slice";
import { filterForPlusCode } from "@/utils/notifications.utils";
import { TEST_PLUS_CODE } from "@/test/fixtures";

describe("notificationsSlice", () => {
  it("deduplicates notification filters", () => {
    const filter = { filter: filterForPlusCode(TEST_PLUS_CODE) };
    const once = notificationsSlice.reducer(
      undefined,
      notificationsActions.addFilter(filter),
    );
    const twice = notificationsSlice.reducer(
      once,
      notificationsActions.addFilter(filter),
    );

    expect(twice.filters).toHaveLength(1);
  });

  it("adds and removes expo push tokens", () => {
    const withToken = notificationsSlice.reducer(
      undefined,
      notificationsActions.addExpoPushToken("ExponentPushToken[test]"),
    );
    const withoutToken = notificationsSlice.reducer(
      withToken,
      notificationsActions.removeExpoPushToken("ExponentPushToken[test]"),
    );

    expect(
      notificationSelectors.selectExpoPushToken({ notifications: withToken }),
    ).toBe("ExponentPushToken[test]");
    expect(withoutToken.tokens).toEqual([]);
  });
});
