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
  hasAcknowledgedExperimentalLayers: boolean;
  pendingTrustrootsUsername: string | null;
  pendingTrustrootsProfileUsername: string | null;
  useMapLibre: boolean;
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
  hasAcknowledgedExperimentalLayers: false,
  pendingTrustrootsUsername: null,
  pendingTrustrootsProfileUsername: null,
  useMapLibre: false,
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
    setHasAcknowledgedExperimentalLayers: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.hasAcknowledgedExperimentalLayers = action.payload;
    },
    setPendingTrustrootsUsername: (
      state,
      action: PayloadAction<string | null>,
    ) => {
      state.pendingTrustrootsUsername = action.payload;
    },
    clearPendingTrustrootsUsername: (state) => {
      state.pendingTrustrootsUsername = null;
    },
    setPendingTrustrootsProfileUsername: (
      state,
      action: PayloadAction<string | null>,
    ) => {
      state.pendingTrustrootsProfileUsername = action.payload;
    },
    clearPendingTrustrootsProfileUsername: (state) => {
      state.pendingTrustrootsProfileUsername = null;
    },
    toggleUseMapLibre: (state) => {
      state.useMapLibre = !state.useMapLibre;
    },
  },
  selectors: {
    selectAreTestFeaturesEnabled: (state) => state.areTestFeaturesEnabled,
    selectUsername: (state) => state.username,
    selectHasBeenOpenedBefore: (state) => state.hasBeenOpenedBefore,
    selectIsDataLoaded: (state) => state.isDataLoaded,
    selectColorScheme: (state) => state.colorScheme,
    selectKeyWasImported: (state) => state.keyWasImported,
    selectHasAcknowledgedExperimentalLayers: (state) =>
      state.hasAcknowledgedExperimentalLayers,
    selectPendingTrustrootsUsername: (state) => state.pendingTrustrootsUsername,
    selectPendingTrustrootsProfileUsername: (state) =>
      state.pendingTrustrootsProfileUsername,
    selectUseMapLibre: (state) => state.useMapLibre,
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
