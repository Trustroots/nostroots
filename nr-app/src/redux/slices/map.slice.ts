import { MAP_LAYER_KEY } from "@trustroots/nr-common";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { LatLng } from "react-native-maps";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { setSubscriptionHasSeenEOSE } from "./relays.slice";

export const MAP_SUBSCRIPTION_ID = "mapVisiblePlusCodesSubscription";

interface MapState {
  mapSubscriptionIsUpdating: boolean;
  visiblePlusCodes: string[];
  isAddNoteModalOpen: boolean;
  selectedLatLng?: LatLng;
  enabledLayers: {
    [key in MAP_LAYER_KEY]: boolean;
  };
}

const initialState: MapState = {
  mapSubscriptionIsUpdating: false,
  visiblePlusCodes: [],
  isAddNoteModalOpen: false,
  enabledLayers: {
    hitchmap: false,
    hitchwiki: false,
    timesafari: false,
    triphopping: false,
    unverified: false,
  },
};

export const mapSlice = createSlice({
  name: "map",
  initialState,
  reducers: {
    setMapSubscriptionIsUpdating: (state, action: PayloadAction<boolean>) => {
      if (state.mapSubscriptionIsUpdating !== action.payload) {
        state.mapSubscriptionIsUpdating = action.payload;
      }
    },
    enableLayer: (state, action: PayloadAction<MAP_LAYER_KEY>) => {
      state.enabledLayers[action.payload] = true;
    },
    disableLayer: (state, action: PayloadAction<MAP_LAYER_KEY>) => {
      // Disable uncommenting layers for now
      return state;
      // eslint-disable-next-line no-unreachable
      state.enabledLayers[action.payload] = false;
    },
    toggleLayer: (state, action: PayloadAction<MAP_LAYER_KEY>) => {
      state.enabledLayers[action.payload] =
        !state.enabledLayers[action.payload];
    },
    openAddNoteModal: (state) => {
      state.isAddNoteModalOpen = true;
    },
    closeAddNoteModal: (state) => {
      state.isAddNoteModalOpen = false;
    },
    setSelectedLatLng: (state, action: PayloadAction<LatLng>) => {
      state.selectedLatLng = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setVisiblePlusCodes, (state, action) => {
        state.visiblePlusCodes = action.payload;
      })
      .addCase(setSubscriptionHasSeenEOSE, (state, action) => {
        if (action.payload.id === MAP_SUBSCRIPTION_ID) {
          state.mapSubscriptionIsUpdating = false;
        }
      });
  },
  selectors: {
    selectVisiblePlusCodes: (state) => state.visiblePlusCodes,
    selectEnabledLayers: (state) => state.enabledLayers,
    selectEnabledLayersAndVisiblePlusCodes: (state) => ({
      enabledLayers: state.enabledLayers,
      visiblePlusCodes: state.visiblePlusCodes,
    }),
    selectSelectedLatLng: (state) => state.selectedLatLng,
    selectIsAddNoteModalOpen: (state) => state.isAddNoteModalOpen,
  },
});

export const mapActions = mapSlice.actions;

const selectEnabledLayerKeys = createSelector(
  [mapSlice.selectors.selectEnabledLayers],
  (enabledLayers) => {
    // NOTE: The return type of `Object.keys()` is `string[]` and I don't know
    // how to tell TypeScript that it should be `keyof typeof
    // state.enabledLayers` so I cast it here instead.
    const keys = Object.keys(enabledLayers) as MAP_LAYER_KEY[];
    const enabledKeys = keys.filter((key) => enabledLayers[key]);
    return enabledKeys;
  },
);

export const mapSelectors = { ...mapSlice.selectors, selectEnabledLayerKeys };
