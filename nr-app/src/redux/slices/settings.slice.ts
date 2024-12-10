import { createSlice } from "@reduxjs/toolkit";

type SettingsState = {
  areTestFeaturesEnabled: boolean;
};

const initialState: SettingsState = {
  areTestFeaturesEnabled: false,
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    toggleTestFeatures: (state, action) => {
      state.areTestFeaturesEnabled = !state.areTestFeaturesEnabled;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
  },
});

export const settingsActions = settingsSlice.actions;

export const settingsSelectors = settingsSlice.selectors;
