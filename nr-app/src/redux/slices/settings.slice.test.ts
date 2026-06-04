import {
  settingsActions,
  settingsSelectors,
  settingsSlice,
} from "./settings.slice";

describe("settings.slice", () => {
  it("stores the selected Trustroots username", () => {
    const state = settingsSlice.reducer(
      settingsSlice.getInitialState(),
      settingsActions.setUsername("alice"),
    );

    expect(settingsSelectors.selectUsername.unwrapped(state)).toBe("alice");
  });

  it("tracks pending Trustroots verification usernames", () => {
    const pendingState = settingsSlice.reducer(
      settingsSlice.getInitialState(),
      settingsActions.setPendingTrustrootsUsername("alice"),
    );

    expect(
      settingsSelectors.selectPendingTrustrootsUsername.unwrapped(pendingState),
    ).toBe("alice");

    const clearedState = settingsSlice.reducer(
      pendingState,
      settingsActions.clearPendingTrustrootsUsername(),
    );

    expect(
      settingsSelectors.selectPendingTrustrootsUsername.unwrapped(clearedState),
    ).toBeNull();
  });

  it("tracks pending profile publish usernames", () => {
    const pendingState = settingsSlice.reducer(
      settingsSlice.getInitialState(),
      settingsActions.setPendingTrustrootsProfileUsername("alice"),
    );

    expect(
      settingsSelectors.selectPendingTrustrootsProfileUsername.unwrapped(
        pendingState,
      ),
    ).toBe("alice");

    const clearedState = settingsSlice.reducer(
      pendingState,
      settingsActions.clearPendingTrustrootsProfileUsername(),
    );

    expect(
      settingsSelectors.selectPendingTrustrootsProfileUsername.unwrapped(
        clearedState,
      ),
    ).toBeNull();
  });

  it("stores color scheme and key import flags", () => {
    const coloredState = settingsSlice.reducer(
      settingsSlice.getInitialState(),
      settingsActions.setColorScheme("dark"),
    );
    const importedState = settingsSlice.reducer(
      coloredState,
      settingsActions.setKeyWasImported(true),
    );

    expect(settingsSelectors.selectColorScheme.unwrapped(importedState)).toBe(
      "dark",
    );
    expect(
      settingsSelectors.selectKeyWasImported.unwrapped(importedState),
    ).toBe(true);
  });

  it("toggles test features", () => {
    const state = settingsSlice.reducer(
      settingsSlice.getInitialState(),
      settingsActions.toggleTestFeatures(),
    );

    expect(
      settingsSelectors.selectAreTestFeaturesEnabled.unwrapped(state),
    ).toBe(true);
  });
});
