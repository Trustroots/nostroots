import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type SettingsState = {
  areTestFeaturesEnabled: boolean;
  username: string | null;
  hasBeenOpenedBefore: boolean;
  isDataLoaded: boolean;
  // Feature flag for opting into the new onboarding flow.
  // Defaults to false to preserve existing behavior.
  useNewOnboarding: boolean;
};

const initialState: SettingsState = {
  areTestFeaturesEnabled: false,
  username: null,
  hasBeenOpenedBefore: false,
  isDataLoaded: false,
  useNewOnboarding: false,
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
    // Explicit setter for New Onboarding feature flag.
    setUseNewOnboarding: (state, action: PayloadAction<boolean>) => {
      state.useNewOnboarding = action.payload;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
    selectUsername: (state) => state.username,
    selectHasBeenOpenedBefore: (state) => state.hasBeenOpenedBefore,
    selectIsDataLoaded: (state) => state.isDataLoaded,
    // Selector for the New Onboarding feature flag.
    selectUseNewOnboarding: (state) => state.useNewOnboarding,
  },
});

export const settingsActions = settingsSlice.actions;

export const settingsSelectors = settingsSlice.selectors;
