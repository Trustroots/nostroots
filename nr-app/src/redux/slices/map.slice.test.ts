import { mapSlice, mapActions, mapSelectors } from "./map.slice";
import { MapViewport } from "@/utils/map.utils";

describe("map.slice", () => {
  describe("selectedLayer persistence", () => {
    const initialState = mapSlice.getInitialState();

    it("should have trustroots as default selectedLayer", () => {
      expect(initialState.selectedLayer).toBe("trustroots");
    });

    it("should update selectedLayer with enableLayer action", () => {
      const newState = mapSlice.reducer(
        initialState,
        mapActions.enableLayer("hitchwiki"),
      );

      expect(newState.selectedLayer).toBe("hitchwiki");
    });
  });

  describe("savedViewport", () => {
    const initialState = mapSlice.getInitialState();

    it("should have undefined savedViewport in initial state", () => {
      expect(initialState.savedViewport).toBeUndefined();
    });

    it("should set savedViewport with setSavedViewport action", () => {
      const viewport: MapViewport = {
        center: { latitude: 52.52, longitude: 13.405 },
        zoom: 9.5,
        boundingBox: {
          northEast: { latitude: 53.0, longitude: 14.0 },
          southWest: { latitude: 52.0, longitude: 13.0 },
        },
      };

      const newState = mapSlice.reducer(
        initialState,
        mapActions.setSavedViewport(viewport),
      );

      expect(newState.savedViewport).toEqual(viewport);
    });

    it("should select savedViewport from state", () => {
      const viewport: MapViewport = {
        center: { latitude: 48.8566, longitude: 2.3522 },
        zoom: 11,
        boundingBox: {
          northEast: { latitude: 49.0, longitude: 2.6 },
          southWest: { latitude: 48.7, longitude: 2.1 },
        },
      };

      const state = {
        ...initialState,
        savedViewport: viewport,
      };

      expect(mapSelectors.selectSavedViewport.unwrapped(state)).toEqual(
        viewport,
      );
    });
  });
  describe("event composer", () => {
    const initialState = mapSlice.getInitialState();

    it("closes the plus code sheet when the composer opens", () => {
      const withSheet = mapSlice.reducer(
        initialState,
        mapActions.setSelectedPlusCode("9C2X4W00+"),
      );
      const state = mapSlice.reducer(withSheet, mapActions.openEventComposer());

      expect(state.isEventComposerOpen).toBe(true);
      expect(state.isMapModalOpen).toBe(false);
    });

    it("returns to the plus code sheet when the composer closes", () => {
      const withSheet = mapSlice.reducer(
        initialState,
        mapActions.setSelectedPlusCode("9C2X4W00+"),
      );
      const opened = mapSlice.reducer(
        withSheet,
        mapActions.openEventComposer(),
      );
      const state = mapSlice.reducer(opened, mapActions.closeEventComposer());

      expect(state.isEventComposerOpen).toBe(false);
      expect(state.isMapModalOpen).toBe(true);
    });

    it("does not open an empty sheet when no plus code is selected", () => {
      const opened = mapSlice.reducer(
        initialState,
        mapActions.openEventComposer(),
      );
      const state = mapSlice.reducer(opened, mapActions.closeEventComposer());

      expect(state.isMapModalOpen).toBe(false);
    });
  });
});
