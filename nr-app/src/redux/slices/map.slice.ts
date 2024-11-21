import { MAP_LAYER_KEY } from "@/utils/map.utils";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { RootState } from "../store";

export const SLICE_NAME = "map";

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
    timesafari: false,
    triphopping: false,
  },
};

const mapSlice = createSlice({
  name: SLICE_NAME,
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
  },
  selectors: {
    selectEnabledLayerKeys: (state) => {
      // NOTE: The return type of `Object.keys()` is `string[]` and I don't know
      // how to tell TypeScript that it should be `keyof typeof
      // state.enabledLayers` so I cast it here instead.
      const keys = Object.keys(state.enabledLayers) as MAP_LAYER_KEY[];
      const enabledKeys = keys.filter((key) => state.enabledLayers[key]);
      return enabledKeys;
    },
  },
});

export default mapSlice.reducer;

export const {
  setMapSubscriptionIsUpdating,
  enableLayer,
  disableLayer,
  toggleLayer,
} = mapSlice.actions;

export const mapSelectors = mapSlice.getSelectors(
  (state: RootState) => state[SLICE_NAME],
);
