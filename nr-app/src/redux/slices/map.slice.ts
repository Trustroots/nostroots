import { MAP_LAYER_KEY } from "@common/constants";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { setSubscriptionHasSeenEOSE } from "./relays.slice";

export const MAP_SUBSCRIPTION_ID = "mapVisiblePlusCodesSubscription";

interface MapState {
  mapSubscriptionIsUpdating: boolean;
  visiblePlusCodes: string[];
  enabledLayers: {
    [key in MAP_LAYER_KEY]: boolean;
  };
}

const initialState: MapState = {
  mapSubscriptionIsUpdating: false,
  visiblePlusCodes: [],
  enabledLayers: {
    hitchmap: false,
    hitchwiki: false,
    timesafari: false,
    triphopping: false,
    unverified: true,
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
      state.enabledLayers[action.payload] = false;
    },
    toggleLayer: (state, action: PayloadAction<MAP_LAYER_KEY>) => {
      state.enabledLayers[action.payload] =
        !state.enabledLayers[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setVisiblePlusCodes, (state, action) => {
      state.visiblePlusCodes = action.payload;
    });
    builder.addCase(setSubscriptionHasSeenEOSE, (state, action) => {
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
  },
});

export const {
  setMapSubscriptionIsUpdating,
  enableLayer,
  disableLayer,
  toggleLayer,
} = mapSlice.actions;

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
