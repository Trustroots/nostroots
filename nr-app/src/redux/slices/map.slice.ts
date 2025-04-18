import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MAP_LAYER_KEY, MAP_LAYERS } from "@trustroots/nr-common";
import { BoundingBox, LatLng } from "react-native-maps";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { setSubscriptionHasSeenEOSE } from "./relays.slice";

export const MAP_SUBSCRIPTION_ID = "mapVisiblePlusCodesSubscription";

interface MapState {
  mapSubscriptionIsUpdating: boolean;
  visiblePlusCodes: string[];
  selectedPlusCode: string;
  boundingBox?: BoundingBox;
  isAddNoteModalOpen: boolean;
  selectedLatLng?: LatLng;
  selectedLayer: MAP_LAYER_KEY;
  enablePlusCodeMapTEMPORARY: boolean;
}

const initialState: MapState = {
  mapSubscriptionIsUpdating: false,
  visiblePlusCodes: [],
  isAddNoteModalOpen: false,
  selectedPlusCode: "",
  selectedLayer: "trustroots",
  enablePlusCodeMapTEMPORARY: false,
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
      state.selectedLayer = action.payload;
    },
    disableLayer: (state, action: PayloadAction<MAP_LAYER_KEY>) => {
      // Disable turning off layers for now
      // return state;
      state.selectedLayer = "trustroots";
    },
    toggleLayer: (state, action: PayloadAction<MAP_LAYER_KEY>) => {
      if (state.selectedLayer === action.payload) {
        state.selectedLayer = "trustroots";
      } else {
        state.selectedLayer = action.payload;
      }
    },
    openAddNoteModal: (state) => {
      state.isAddNoteModalOpen = true;
    },
    closeAddNoteModal: (state) => {
      state.isAddNoteModalOpen = false;
    },
    setSelectedPlusCode: (state, action: PayloadAction<string>) => {
      state.selectedPlusCode = action.payload;
    },
    closeMapModal: (state) => {
      state.selectedPlusCode = "";
    },
    setSelectedLatLng: (state, action: PayloadAction<LatLng>) => {
      state.selectedLatLng = action.payload;
    },
    setBoundingBox: (
      state,
      action: PayloadAction<{ northEast: LatLng; southWest: LatLng }>,
    ) => {
      state.boundingBox = action.payload;
    },
    togglePlusCodeMapTEMPORARY: (state) => {
      state.enablePlusCodeMapTEMPORARY = !state.enablePlusCodeMapTEMPORARY;
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
    selectEnabledLayers: (state) =>
      Object.fromEntries(
        Object.entries(MAP_LAYERS).map(([key]) => [
          key,
          key === state.selectedLayer,
        ]),
      ),
    selectEnabledLayersAndVisiblePlusCodes: (state) => ({
      enabledLayers: [state.selectedLayer],
      visiblePlusCodes: state.visiblePlusCodes,
    }),
    selectSelectedLatLng: (state) => state.selectedLatLng,
    selectSelectedPlusCode: (state) => state.selectedPlusCode,
    selectIsMapModalOpen: (state) => state.selectedPlusCode !== "",
    selectIsAddNoteModalOpen: (state) => state.isAddNoteModalOpen,
    selectBoundingBox: (state) => state.boundingBox,
    selectEnablePlusCodeMapTEMPORARY: (state) =>
      state.enablePlusCodeMapTEMPORARY,
    selectEnabledLayerKeys: (state) => [state.selectedLayer],
  },
});

export const mapActions = mapSlice.actions;

export const mapSelectors = mapSlice.selectors;
