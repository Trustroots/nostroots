import { mapSlice, mapActions, mapSelectors } from "./map.slice";
import { Region } from "react-native-maps";

describe("map.slice", () => {
  describe("savedRegion", () => {
    const initialState = mapSlice.getInitialState();

    it("should have undefined savedRegion in initial state", () => {
      expect(initialState.savedRegion).toBeUndefined();
    });

    it("should set savedRegion with setSavedRegion action", () => {
      const region: Region = {
        latitude: 52.52,
        longitude: 13.405,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

      const newState = mapSlice.reducer(
        initialState,
        mapActions.setSavedRegion(region),
      );

      expect(newState.savedRegion).toEqual(region);
    });

    it("should select savedRegion from state", () => {
      const region: Region = {
        latitude: 48.8566,
        longitude: 2.3522,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };

      const state = {
        ...initialState,
        savedRegion: region,
      };

      // The unwrapped selector works on the slice state directly
      expect(mapSelectors.selectSavedRegion.unwrapped(state)).toEqual(region);
    });

    it("should preserve zoom level (deltas) in savedRegion", () => {
      const zoomedInRegion: Region = {
        latitude: 40.7128,
        longitude: -74.006,
        latitudeDelta: 0.01, // Very zoomed in
        longitudeDelta: 0.01,
      };

      const newState = mapSlice.reducer(
        initialState,
        mapActions.setSavedRegion(zoomedInRegion),
      );

      expect(newState.savedRegion?.latitudeDelta).toBe(0.01);
      expect(newState.savedRegion?.longitudeDelta).toBe(0.01);
    });
  });

  describe("selectedLayer persistence", () => {
    const initialState = mapSlice.getInitialState();

    it("should have trustroots as default selectedLayer", () => {
      expect(initialState.selectedLayer).toBe("trustroots");
    });

    it("should update selectedLayer with enableLayer action", () => {
      const newState = mapSlice.reducer(
        initialState,
        mapActions.enableLayer("hitchmap"),
      );

      expect(newState.selectedLayer).toBe("hitchmap");
    });
  });
});
