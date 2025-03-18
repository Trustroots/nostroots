import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type SettingsState = {
  areTestFeaturesEnabled: boolean;
  username: string;
};

const initialState: SettingsState = {
  areTestFeaturesEnabled: false,
  username: "",
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    toggleTestFeatures: (state, action: PayloadAction) => {
      state.areTestFeaturesEnabled = !state.areTestFeaturesEnabled;
    },
    setUsername: (state, action: PayloadAction<string>) => {
      state.username = action.payload;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
    selectUsername: (state) => state.username,
  },
});

export const settingsActions = settingsSlice.actions;

export const settingsSelectors = settingsSlice.selectors;
