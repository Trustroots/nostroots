import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import {
  allPlusCodesForRegion,
  getAllChildPlusCodes,
  plusCodeToRectangle,
} from "@/utils/map.utils";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, {
  Details,
  Polygon,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { createSelector } from "reselect";

const selectPlusCodesToShow = createSelector(
  mapSelectors.selectVisiblePlusCodes,
  (visiblePlusCodes) => {
    const allPlusCodes = visiblePlusCodes.flatMap(getAllChildPlusCodes);
    // return allPlusCodes;
    const subset = allPlusCodes.slice(0, 200);
    return subset;
  },
);

export default function MapPlusCodes() {
  const dispatch = useAppDispatch();

  const showPlusCodes = useAppSelector(selectPlusCodesToShow);

  const handleMapRegionChange = useMemo(
    () =>
      function handleMapRegionChangeHandler(region: Region, details: Details) {
        __DEV__ && console.log("#rIMmxg Map move completed", region, details);
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
      },
    [dispatch],
  );

  return (
    <MapView
      style={styles.map}
      rotateEnabled={false}
      pitchEnabled={false}
      onRegionChangeComplete={handleMapRegionChange}
      // only use google maps on android dev and prod builds
      provider={
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
        Platform.OS !== "android"
          ? PROVIDER_DEFAULT
          : PROVIDER_GOOGLE
      }
    >
      {showPlusCodes.map((plusCode, index) => (
        <Polygon
          key={index}
          coordinates={plusCodeToRectangle(plusCode)}
          fillColor="rgba(255, 0, 0, 0.3)"
          strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
          strokeWidth={2}
          onPress={() => {
            console.log("#HYgLFP plus code polygon pressed");
          }}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  toggleWrapper: { position: "absolute", top: 40, left: 10, zIndex: 1 },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  input: {
    width: 200,
    padding: 10,
    backgroundColor: "white",
    marginBottom: 10,
  },
  marker: {
    width: 200,
  },
});
