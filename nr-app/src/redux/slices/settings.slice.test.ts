import {
  settingsActions,
  settingsSelectors,
  settingsSlice,
} from "./settings.slice";

describe("settings.slice — useMapLibre feature flag", () => {
  it("defaults useMapLibre to false", () => {
    const state = settingsSlice.reducer(undefined, { type: "@@INIT" });
    expect(settingsSelectors.selectUseMapLibre.unwrapped(state)).toBe(false);
  });

  it("toggles useMapLibre to true", () => {
    let state = settingsSlice.reducer(undefined, { type: "@@INIT" });
    state = settingsSlice.reducer(state, settingsActions.toggleUseMapLibre());
    expect(settingsSelectors.selectUseMapLibre.unwrapped(state)).toBe(true);
  });

  it("toggles useMapLibre back to false", () => {
    let state = settingsSlice.reducer(undefined, { type: "@@INIT" });
    state = settingsSlice.reducer(state, settingsActions.toggleUseMapLibre());
    state = settingsSlice.reducer(state, settingsActions.toggleUseMapLibre());
    expect(settingsSelectors.selectUseMapLibre.unwrapped(state)).toBe(false);
  });
});
