import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type SettingsState = {
  areTestFeaturesEnabled: boolean;
  username: string | null;
  hasBeenOpenedBefore: boolean;
  isDataLoaded: boolean;
  experimentalFeatures: {
    maplibreGL: boolean;
  };
};

const initialState: SettingsState = {
  areTestFeaturesEnabled: false,
  username: null,
  hasBeenOpenedBefore: false,
  isDataLoaded: false,
  experimentalFeatures: {
    maplibreGL: false,
  },
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
    setHasBeenOpenedBefore: (state, action: PayloadAction<boolean>) => {
      state.hasBeenOpenedBefore = action.payload;
    },
    setDataLoaded: (state, action: PayloadAction<boolean>) => {
      state.isDataLoaded = action.payload;
    },
    toggleMaplibreGL: (state) => {
      state.experimentalFeatures.maplibreGL =
        !state.experimentalFeatures.maplibreGL;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
    selectUsername: (state) => state.username,
    selectHasBeenOpenedBefore: (state) => state.hasBeenOpenedBefore,
    selectIsDataLoaded: (state) => state.isDataLoaded,
    selectEnableMaplibreGL: (state) => state.experimentalFeatures.maplibreGL,
  },
});

export const settingsActions = settingsSlice.actions;

export const settingsSelectors = settingsSlice.selectors;
