import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { rootLogger } from "@/utils/logger.utils";
import {
  allPlusCodesForRegion,
  getAllChildPlusCodes,
  PLUS_CODE_CHARACTERS,
  plusCodeToRectangle,
} from "@/utils/map.utils";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, {
  Details,
  Polygon,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { createSelector } from "reselect";

const log = rootLogger.extend("MapTesting");

const set1 = [
  "9F4C0000+",
  "9F4F0000+",
  "9F4G0000+",
  "9F4H0000+",
  "9F3C0000+",
  "9F3F0000+",
  "9F3G0000+",
  "9F3H0000+",
  "9F2C0000+",
  "9F2F0000+",
  "9F2G0000+",
  "9F2H0000+",
  "9G4C0000+",
  "9G4F0000+",
  "9G4G0000+",
  "9G4H0000+",
  "9G3C0000+",
  "9G3F0000+",
  "9G3G0000+",
  "9G3H0000+",
  "9G2C0000+",
  "9G2F0000+",
  "9G2G0000+",
  "9G2H0000+",
  "9H4C0000+",
  "9H4F0000+",
  "9H4G0000+",
  "9H4H0000+",
  "9H3C0000+",
  "9H3F0000+",
  "9H3G0000+",
  "9H3H0000+",
  "9H2C0000+",
  "9H2F0000+",
  "9H2G0000+",
  "9H2H0000+",
];
const set2 = ["9F5C0000+", "9F5F0000+", "9F5G0000+", "9F5H0000+"];

const selectPlusCodesToShow = createSelector(
  mapSelectors.selectVisiblePlusCodes,
  (visiblePlusCodes) => {
    const allPlusCodes = visiblePlusCodes.flatMap(getAllChildPlusCodes);
    // return allPlusCodes;
    const subset = allPlusCodes.slice(0, 200);
    return subset;
  },
);

function Poly({ plusCode }: { plusCode: string }) {
  return (
    <Polygon
      coordinates={plusCodeToRectangle(plusCode)}
      fillColor="rgba(255, 0, 0, 0.3)"
      strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
      strokeWidth={2}
      onPress={() => {
        console.log("#HYgLFP plus code polygon pressed");
      }}
    />
  );
}

export default function MapTesting() {
  const [plusCodes, setPlusCodes] = useState<string[]>(set1);
  const [plusCode, setPlusCode] = useState<string>(set1[0]);
  const [plusCodeTwo, setPlusCodeTwo] = useState<string>(set1[1]);

  useEffect(() => {
    setTimeout(() => {
      // setPlusCode(set2[0]);
      // setPlusCodeTwo(set2[1]);
      // setPlusCodes(set2);
      // return;
      const newPlusCodes = plusCodes.map((oldPlusCode) => {
        const characterToIncrement = oldPlusCode.substring(2, 3);
        const currentIndex = PLUS_CODE_CHARACTERS.indexOf(characterToIncrement);
        const nextIndex = (currentIndex + 1) % PLUS_CODE_CHARACTERS.length;
        const nextCharacter = PLUS_CODE_CHARACTERS[nextIndex];
        const newPlusCode =
          oldPlusCode.substring(0, 2) +
          nextCharacter +
          oldPlusCode.substring(3);
        return newPlusCode;
      });
      setPlusCodes(newPlusCodes);
    }, 2e3);
  }, [plusCodes, setPlusCodes]);

  const codes = [plusCode, plusCodeTwo];

  log.debug("#lGk61g Render()");

  return (
    <MapView
      style={styles.map}
      rotateEnabled={false}
      pitchEnabled={false}
      // only use google maps on android dev and prod builds
      provider={
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
        Platform.OS !== "android"
          ? PROVIDER_DEFAULT
          : PROVIDER_GOOGLE
      }
    >
      {/* {codes.map((c, i) => (
        <Polygon
          key={i}
          coordinates={plusCodeToRectangle(c)}
          fillColor="rgba(255, 0, 0, 0.3)"
          strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
          strokeWidth={2}
          onPress={() => {
            console.log("#HYgLFP plus code polygon pressed");
          }}
        />
      ))} */}
      {/* <Polygon
        coordinates={plusCodeToRectangle(plusCode)}
        fillColor="rgba(255, 0, 0, 0.3)"
        strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
        strokeWidth={2}
        onPress={() => {
          console.log("#HYgLFP plus code polygon pressed");
        }}
      />
      <Polygon
        coordinates={plusCodeToRectangle(plusCodeTwo)}
        fillColor="rgba(255, 0, 0, 0.3)"
        strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
        strokeWidth={2}
        onPress={() => {
          console.log("#HYgLFP plus code polygon pressed");
        }}
      /> */}
      {plusCodes.map((plusCode, i) => (
        <Polygon
          key={i}
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
