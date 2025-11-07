import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MAP_LAYER_KEY, MAP_LAYERS } from "@trustroots/nr-common";
import { matchFilter } from "nostr-tools";
import { BoundingBox, LatLng, Region } from "react-native-maps";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { eventsSelectors, EventWithMetadata } from "./events.slice";
import { setSubscriptionHasSeenEOSE } from "./relays.slice";

export const MAP_SUBSCRIPTION_ID = "mapVisiblePlusCodesSubscription";

interface MapState {
  mapSubscriptionIsUpdating: boolean;
  visiblePlusCodes: string[];
  selectedPlusCode: string;
  boundingBox?: BoundingBox;
  isMapModalOpen: boolean;
  isHalfMapEventModalOpen: boolean;
  isAddNoteModalOpen: boolean;
  selectedLatLng?: LatLng;
  currentMapLocation?: LatLng;
  centerMapOnCurrentLocation: boolean;
  currentNotificationEvent?: EventWithMetadata;

  selectedLayer: MAP_LAYER_KEY;
  enablePlusCodeMapTEMPORARY: boolean;
}

const initialState: MapState = {
  mapSubscriptionIsUpdating: false,
  visiblePlusCodes: [],
  isMapModalOpen: false,
  isHalfMapEventModalOpen: false,
  isAddNoteModalOpen: false,
  selectedLatLng: undefined,
  selectedPlusCode: "",
  selectedLayer: "trustroots",
  enablePlusCodeMapTEMPORARY: true,
  centerMapOnCurrentLocation: false,
  currentNotificationEvent: undefined,
};

export const mapSlice = createSlice({
  name: "map",
  initialState,
  reducers: {
    centerMapOnCurrentLocationComplete: (state) => {
      state.centerMapOnCurrentLocation = false;
    },
    centerMapOnCurrentLocation: (state) => {
      state.centerMapOnCurrentLocation = true;
    },
    setCurrentMapLocation: (state, action: PayloadAction<LatLng>) => {
      state.currentMapLocation = action.payload;
    },
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
    openHalfMapEventModal: (
      state,
      action: PayloadAction<EventWithMetadata>,
    ) => {
      state.isHalfMapEventModalOpen = true;
      state.currentNotificationEvent = action.payload;
    },
    closeHalfMapEventModal: (state) => {
      state.isHalfMapEventModalOpen = false;
      state.currentNotificationEvent = undefined;
    },
    closeMapModal: (state) => {
      state.isMapModalOpen = false;
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
    // Action to trigger map animation - handled by saga
    animateToRegion: (
      state,
      action: PayloadAction<{ region: Region; duration?: number }>,
    ) => {
      // This action is handled by the saga
    },
    // Action to trigger map animation to a coordinate
    animateToCoordinate: (
      state,
      action: PayloadAction<{
        latitude: number;
        longitude: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
        duration?: number;
      }>,
    ) => {
      // This action is handled by the saga
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
    selectEnabledLayers: createSelector(
      (state: MapState) => state.selectedLayer,
      (selectedLayer: MAP_LAYER_KEY) =>
        Object.fromEntries(
          Object.entries(MAP_LAYERS).map(([key]) => [
            key,
            key === selectedLayer,
          ]),
        ),
    ),
    selectEnabledLayersAndVisiblePlusCodes: (state) => ({
      enabledLayers: [state.selectedLayer],
      visiblePlusCodes: state.visiblePlusCodes,
    }),
    selectSelectedLayer: (state) => state.selectedLayer,
    selectSelectedLatLng: (state: MapState) => state.selectedLatLng,
    selectSelectedPlusCode: (state) => state.selectedPlusCode,
    selectIsMapModalOpen: (state) => state.isMapModalOpen,
    selectIsHalfMapEventModalOpen: (state) => state.isHalfMapEventModalOpen,
    selectIsAddNoteModalOpen: (state) => state.isAddNoteModalOpen,
    selectBoundingBox: (state) => state.boundingBox,
    selectEnablePlusCodeMapTEMPORARY: (state) =>
      state.enablePlusCodeMapTEMPORARY,
    selectEnabledLayerKeys: createSelector(
      (state: MapState) => state,
      (state: MapState) => [state.selectedLayer],
    ),
    selectCurrentMapLocation: (state: MapState) => state.currentMapLocation,
    selectCenterMapOnCurrentLocation: (state: MapState) =>
      state.centerMapOnCurrentLocation,
    selectCurrentNotificationEvent: (state: MapState) =>
      state.currentNotificationEvent,
  },
});

const mapSliceSelectors = mapSlice.selectors;

const selectEventsForSelectedMapLayer = createSelector(
  [eventsSelectors.selectAll, mapSliceSelectors.selectSelectedLayer],
  (events: EventWithMetadata[], selectedLayer: MAP_LAYER_KEY) => {
    const layer = MAP_LAYERS[selectedLayer];
    const eventsForLayer = events.filter((eventWithMetadata) =>
      matchFilter(layer.filter, eventWithMetadata.event),
    );
    return eventsForLayer;
  },
);

export const mapActions = mapSlice.actions;

export const mapSelectors = {
  ...mapSliceSelectors,
  selectEventsForSelectedMapLayer,
};
