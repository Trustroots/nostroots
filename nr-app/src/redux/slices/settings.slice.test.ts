import {
  selectFeatureFlags,
  settingsActions,
  settingsSlice,
} from "./settings.slice";

describe("settingsSlice", () => {
  it("toggles developer test features", () => {
    const state = settingsSlice.reducer(
      undefined,
      settingsActions.toggleTestFeatures(),
    );

    expect(state.areTestFeaturesEnabled).toBe(true);
  });

  it("selects feature flags used by routing and onboarding", () => {
    const state = {
      settings: settingsSlice.reducer(
        undefined,
        settingsActions.setForceOnboarding(true),
      ),
    };

    expect(
      selectFeatureFlags(state as Parameters<typeof selectFeatureFlags>[0]),
    ).toEqual({
      useSkipOnboarding: true,
      forceOnboarding: true,
      forceWelcome: false,
    });
  });
});
