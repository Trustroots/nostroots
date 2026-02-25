import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

export type ColorSchemePreference = "system" | "light" | "dark";

type SettingsState = {
  username: string | null;
  hasBeenOpenedBefore: boolean;
  isDataLoaded: boolean;
  areTestFeaturesEnabled: boolean;
  useSkipOnboarding: boolean;
  forceOnboarding: boolean;
  forceWelcome: boolean;
  colorScheme: ColorSchemePreference;
  keyWasImported: boolean;
};

const initialState: SettingsState = {
  username: null,
  hasBeenOpenedBefore: false,
  isDataLoaded: false,
  areTestFeaturesEnabled: false,
  useSkipOnboarding: true,
  forceOnboarding: false,
  forceWelcome: false,
  colorScheme: "system",
  keyWasImported: false,
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    toggleTestFeatures: (state) => {
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
    setUseSkipOnboarding: (state, action: PayloadAction<boolean>) => {
      state.useSkipOnboarding = action.payload;
    },
    setForceOnboarding: (state, action: PayloadAction<boolean>) => {
      state.forceOnboarding = action.payload;
    },
    setForceWelcome: (state, action: PayloadAction<boolean>) => {
      state.forceWelcome = action.payload;
    },
    setColorScheme: (state, action: PayloadAction<ColorSchemePreference>) => {
      state.colorScheme = action.payload;
    },
    setKeyWasImported: (state, action: PayloadAction<boolean>) => {
      state.keyWasImported = action.payload;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
    selectUsername: (state) => state.username,
    selectHasBeenOpenedBefore: (state) => state.hasBeenOpenedBefore,
    selectIsDataLoaded: (state) => state.isDataLoaded,
    selectColorScheme: (state) => state.colorScheme,
    selectKeyWasImported: (state) => state.keyWasImported,
  },
});

export const settingsActions = settingsSlice.actions;

export const settingsSelectors = settingsSlice.selectors;

export const selectFeatureFlags = createSelector(
  (state: RootState) => state.settings,
  (settings: SettingsState) => ({
    useSkipOnboarding: settings.useSkipOnboarding,
    forceOnboarding: settings.forceOnboarding,
    forceWelcome: settings.forceWelcome,
  }),
);
