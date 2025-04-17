import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { eventsSelectors } from "@/redux/slices/events.slice";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import {
  isEventForPlusCodeExactly,
  isEventWithinThisPlusCode,
} from "@/utils/event.utils";
import { rootLogger } from "@/utils/logger.utils";
import {
  allPlusCodesForRegion,
  boundariesToRegion,
  coordinatesToPlusCode,
  getAllChildPlusCodes,
  getAllPlusCodesBetweenTwoPlusCodes,
  plusCodeToRectangle,
  regionToBoundingBox,
} from "@/utils/map.utils";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useMemo, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, {
  Details,
  Polygon,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { createSelector } from "reselect";

const log = rootLogger.extend("MapPlusCodes");

function whatLengthOfPlusCodeToShow(region: Region) {
  const factor = 1.6;
  if (region.latitudeDelta > 20 * factor) {
    return 2;
  } else if (region.latitudeDelta > 1 * factor) {
    return 4;
  } else if (region.latitudeDelta > 0.05 * factor) {
    return 6;
  }
  return 8;
}

const selectPlusCodesToShow = createSelector(
  mapSelectors.selectVisiblePlusCodes,
  (visiblePlusCodes) => {
    const allPlusCodes = visiblePlusCodes.flatMap(getAllChildPlusCodes);
    return allPlusCodes;
  },
);

const selectPlusCodesWithState = createSelector(
  [eventsSelectors.selectAll, mapSelectors.selectBoundingBox],
  (events, boundingBox) => {
    if (typeof boundingBox === "undefined") {
      return [];
    }

    const length = whatLengthOfPlusCodeToShow(boundariesToRegion(boundingBox));

    const southWest = coordinatesToPlusCode({
      ...boundingBox.southWest,
      length,
    });
    const northEast = coordinatesToPlusCode({
      ...boundingBox.northEast,
      length,
    });

    // const plusCodes = [southWest, northEast];
    const plusCodes = getAllPlusCodesBetweenTwoPlusCodes(
      southWest,
      northEast,
      length,
    );

    const output = plusCodes.map((plusCode) => {
      const eventsForThisPlusCodeExactly = events.filter((event) =>
        isEventForPlusCodeExactly(event.event, plusCode),
      );
      const eventsWithinThisPlusCode = events.filter((event) =>
        isEventWithinThisPlusCode(event.event, plusCode),
      );
      return {
        plusCode,
        eventCountForThisPlusCodeExactly: eventsForThisPlusCodeExactly.length,
        eventCountWithinThisPlusCode: eventsWithinThisPlusCode.length,
      };
    });
    return output;
  },
);

export default function MapPlusCodes() {
  const dispatch = useAppDispatch();

  const plusCodesWithState = useAppSelector(selectPlusCodesWithState);

  const mapViewRef = useRef<MapView>(null);

  const handleMapRegionChange = useMemo(
    () =>
      function handleMapRegionChangeHandler(region: Region, details: Details) {
        __DEV__ && console.log("#rIMmxg Map move completed", region, details);
        const boundingBox = regionToBoundingBox(region);
        dispatch(mapActions.setBoundingBox(boundingBox));
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
        const length = whatLengthOfPlusCodeToShow(region);
        log.debug("#mzWdGm regionChange plusCode length", length);
      },
    [dispatch],
  );

  return (
    <MapView
      ref={mapViewRef}
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
      onMapReady={async (event) => {
        if (mapViewRef.current === null) {
          log.error("#SHtaWM mapViewRef is null");
          return;
        }
        const boundaries = await mapViewRef.current.getMapBoundaries();
        log.debug("#iztRxR onMapReady", boundaries);
        const region = boundariesToRegion(boundaries);
        handleMapRegionChange(region, {});
      }}
    >
      {true &&
        plusCodesWithState.map((plusCodeWithState, index) => (
          <Polygon
            key={index}
            coordinates={plusCodeToRectangle(plusCodeWithState.plusCode)}
            // fillColor={`rgba(255, 0, 0, 0.${plusCodeWithState.events.length > 9 ? "9" : plusCodeWithState.events.length.toString().substring(0, 1)}})`}
            fillColor={`rgba(${Math.min(255, plusCodeWithState.eventCountWithinThisPlusCode * 60).toString()}, 0, 0, 0.6)`}
            strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
            strokeWidth={2}
            tappable={true}
            onPress={() => {
              dispatch(
                mapActions.setSelectedPlusCode(plusCodeWithState.plusCode),
              );
              dispatch(mapActions.openAddNoteModal());
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
