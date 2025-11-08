import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

type SettingsState = {
  username: string | null;
  hasBeenOpenedBefore: boolean;
  isDataLoaded: boolean;
  areTestFeaturesEnabled: boolean;
  useNewOnboarding: boolean;
  forceOnboarding: boolean;
  forceWelcome: boolean;
};

const initialState: SettingsState = {
  username: null,
  hasBeenOpenedBefore: false,
  isDataLoaded: false,
  areTestFeaturesEnabled: false,
  useNewOnboarding: true,
  forceOnboarding: false,
  forceWelcome: false,
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
    setUseNewOnboarding: (state, action: PayloadAction<boolean>) => {
      state.useNewOnboarding = action.payload;
    },
    setForceOnboarding: (state, action: PayloadAction<boolean>) => {
      state.forceOnboarding = action.payload;
    },
    setForceWelcome: (state, action: PayloadAction<boolean>) => {
      state.forceWelcome = action.payload;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
    selectUsername: (state) => state.username,
    selectHasBeenOpenedBefore: (state) => state.hasBeenOpenedBefore,
    selectIsDataLoaded: (state) => state.isDataLoaded,
  },
});

export const settingsActions = settingsSlice.actions;

export const settingsSelectors = settingsSlice.selectors;

export const selectFeatureFlags = createSelector(
  (state: RootState) => state.settings,
  (settings: SettingsState) => ({
    useNewOnboarding: settings.useNewOnboarding,
    forceOnboarding: settings.forceOnboarding,
    forceWelcome: settings.forceWelcome,
  }),
);
