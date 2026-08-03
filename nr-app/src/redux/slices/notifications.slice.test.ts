import {
  notificationSelectors,
  notificationsActions,
  notificationsSlice,
} from "./notifications.slice";

describe("notifications.slice", () => {
  it("adds and removes notification filters", () => {
    const filter = { filter: { kinds: [1], "#g": ["9F4G0000+"] } };
    const withFilter = notificationsSlice.reducer(
      notificationsSlice.getInitialState(),
      notificationsActions.addFilter(filter),
    );

    expect(notificationSelectors.selectFilters.unwrapped(withFilter)).toEqual([
      filter,
    ]);

    const withoutFilter = notificationsSlice.reducer(
      withFilter,
      notificationsActions.removeFilter(filter),
    );

    expect(
      notificationSelectors.selectFilters.unwrapped(withoutFilter),
    ).toEqual([]);
  });

  it("deduplicates Expo push tokens", () => {
    const withToken = notificationsSlice.reducer(
      notificationsSlice.getInitialState(),
      notificationsActions.addExpoPushToken("ExponentPushToken[test]"),
    );
    const duplicateState = notificationsSlice.reducer(
      withToken,
      notificationsActions.addExpoPushToken("ExponentPushToken[test]"),
    );

    expect(
      notificationSelectors.selectTokens.unwrapped(duplicateState),
    ).toEqual([{ expoPushToken: "ExponentPushToken[test]" }]);
    expect(
      notificationSelectors.selectExpoPushToken.unwrapped(duplicateState),
    ).toBe("ExponentPushToken[test]");
  });

  it("removes all filters", () => {
    const withFilter = notificationsSlice.reducer(
      notificationsSlice.getInitialState(),
      notificationsActions.addFilter({ filter: { kinds: [1] } }),
    );

    const emptyState = notificationsSlice.reducer(
      withFilter,
      notificationsActions.removeAllFilters(),
    );

    expect(notificationSelectors.selectFilters.unwrapped(emptyState)).toEqual(
      [],
    );
  });
});
