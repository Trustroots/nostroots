import { NOSTR_EVENT_INDEX_MAXIMUM_PLUS_CODE_LENGTH } from "@/constants";
import {
  getFirstTagValueFromEvent,
  MAP_LAYER_KEY,
  MAP_LAYERS,
  MapLayer,
} from "@trustroots/nr-common";
import { NostrEvent } from "nostr-tools";
import OpenLocationCode from "open-location-code-typescript";
import { urlJoin } from "url-join-ts";

type PlusCodeShortLength = 2 | 4 | 6 | 8;

const PLUS_CODE_CHARACTERS = "23456789CFGHJMPQRVWX" as const;

export function isValidPlusCode(code: string): boolean {
  return OpenLocationCode.isValid(code);
}

export function plusCodeToFirstFourSegments(
  plusCode: string,
): [string, string, string, string] {
  if (!isValidPlusCode(plusCode)) {
    throw new Error("#yCmPga-invalid-plus-code");
  }
  const first = plusCode.substring(0, 2);
  const second = plusCode.substring(2, 4);
  const third = plusCode.substring(4, 6);
  const fourth = plusCode.substring(6, 8);
  return [first, second, third, fourth];
}

export function coordinatesToPlusCode({
  latitude,
  longitude,
  length,
}: {
  latitude: number;
  longitude: number;
  length?: PlusCodeShortLength;
}): string {
  const plusCode = OpenLocationCode.encode(latitude, longitude, length);
  return plusCode;
}

export function plusCodeToArrayPairs(plusCode: string): [string, string][] {
  const [beforePlus, afterPlus] = plusCode.split("+");
  const [
    firstRow,
    firstColumn,
    secondRow,
    secondColumn,
    thirdRow,
    thirdColumn,
    fourthRow,
    fourthColumn,
  ] = beforePlus;
  if (afterPlus !== "") {
    throw new Error(
      "Cannot split plus codes with values after the plus. #GKPQHB",
    );
  }

  const allPairs: [string, string][] = [
    [firstRow, firstColumn],
    [secondRow, secondColumn],
    [thirdRow, thirdColumn],
    [fourthRow, fourthColumn],
  ];

  const pairs = allPairs.filter(([row]) => row !== "0");

  return pairs;
}

export function plusCodeToCoordinates(plusCode: string): {
  latitude: number;
  longitude: number;
} {
  let decoded;
  try {
    decoded = OpenLocationCode.decode(plusCode);
  } catch (error) {
    if (error instanceof Error) {
      console.error("#ewW2XQ Error decoding Plus Code:", error.message);
    }
    throw error;
  }

  if (decoded) {
    return {
      latitude: decoded.latitudeHi,
      longitude: decoded.longitudeHi,
    };
  } else {
    throw new Error("Invalid Plus Code #YNP4B1");
  }
}

export function plusCodeToRectangle(
  plusCode: string,
): [
  { latitude: number; longitude: number },
  { latitude: number; longitude: number },
  { latitude: number; longitude: number },
  { latitude: number; longitude: number },
] {
  let decoded;
  try {
    decoded = OpenLocationCode.decode(plusCode);
  } catch (error) {
    if (error instanceof Error) {
      console.error("#ewW2XQ Error decoding Plus Code:", error.message);
    }
    throw error;
  }

  if (decoded) {
    return [
      { latitude: decoded.latitudeLo, longitude: decoded.longitudeLo },
      { latitude: decoded.latitudeHi, longitude: decoded.longitudeLo },
      { latitude: decoded.latitudeHi, longitude: decoded.longitudeHi },
      { latitude: decoded.latitudeLo, longitude: decoded.longitudeHi },
    ];
  } else {
    throw new Error("Invalid Plus Code #QWEIOK");
  }
}

/**
 * Get a set of plus codes that contains the entire space of the visible map.
 *
 * This is useful to fetch events. By fetching events for these plus codes the
 * entire map will be covered and some area outside of the visible map.
 */
export function allPlusCodesForRegion({
  latitude,
  latitudeDelta,
  longitude,
  longitudeDelta,
  codeLength = NOSTR_EVENT_INDEX_MAXIMUM_PLUS_CODE_LENGTH,
}: {
  latitude: number;
  latitudeDelta: number;
  longitude: number;
  longitudeDelta: number;
  codeLength?: PlusCodeShortLength;
}) {
  // - Code for bottom left
  // - Code for top right
  const bottomLeftCoordinates = {
    latitude: latitude - latitudeDelta / 2,
    longitude: longitude - longitudeDelta / 2,
  };
  const topRightCoordinates = {
    latitude: latitude + latitudeDelta / 2,
    longitude: longitude + longitudeDelta / 2,
  };

  const bottomLeftCode = OpenLocationCode.encode(
    bottomLeftCoordinates.latitude,
    bottomLeftCoordinates.longitude,
    codeLength,
  );
  const topRightCode = OpenLocationCode.encode(
    topRightCoordinates.latitude,
    topRightCoordinates.longitude,
    codeLength,
  );

  const bottomLeftPairs = plusCodeToArrayPairs(bottomLeftCode);
  const topRightPairs = plusCodeToArrayPairs(topRightCode);

  // Find the first digit that changes for row and column
  const firstIndexWithDifference = bottomLeftPairs.findIndex(
    ([bottomRow, leftColumn], index) => {
      const [topRow, rightColumn] = topRightPairs[index];
      return topRow !== bottomRow || leftColumn !== rightColumn;
    },
  );

  const outputCodeLength = (firstIndexWithDifference + 1) * 2;

  const bottomLeftLastPair = bottomLeftPairs.at(firstIndexWithDifference)!;
  const topRightLastPair = topRightPairs.at(firstIndexWithDifference)!;

  const [bottomRow, leftColumn] = bottomLeftLastPair;
  const [topRow, rightColumn] = topRightLastPair;

  const bottomRowIndex = PLUS_CODE_CHARACTERS.indexOf(bottomRow);
  const topRowIndex = PLUS_CODE_CHARACTERS.indexOf(topRow);
  const leftColumnIndex = PLUS_CODE_CHARACTERS.indexOf(leftColumn);
  const rightColumnIndex = PLUS_CODE_CHARACTERS.indexOf(rightColumn);

  const rows = topRowIndex - bottomRowIndex + 1;
  const columns = rightColumnIndex - leftColumnIndex + 1;

  // Nested iteration
  const parts = Array.from({ length: rows }).flatMap((empty, rowIndex) => {
    return Array.from({ length: columns }).map((empty, columnIndex) => {
      const outputRowIndex = bottomRowIndex + rowIndex;
      const outputColumnIndex = leftColumnIndex + columnIndex;

      const rowCode = PLUS_CODE_CHARACTERS[outputRowIndex];
      const columnCode = PLUS_CODE_CHARACTERS[outputColumnIndex];

      return [rowCode, columnCode];
    });
  });

  const codePrefixLength = outputCodeLength > 2 ? outputCodeLength - 2 : 0;
  const codePrefix = bottomLeftCode.slice(0, codePrefixLength);

  const codes = parts.map(([row, column]) => {
    const partialCode = `${codePrefix}${row}${column}`;
    const codeToPlus = partialCode.padEnd(8, "0");
    const code = `${codeToPlus}+`;
    return code;
  });
  return codes;
}

export function isPlusCodeBetweenTwoPlusCodes(
  firstPlusCode: string,
  secondPlusCode: string,
  targetPlusCode: string,
) {
  const firstCoordinates = plusCodeToCoordinates(firstPlusCode);
  const secondCoordinates = plusCodeToCoordinates(secondPlusCode);
  const targetCoordinates = plusCodeToCoordinates(targetPlusCode);
  const isLatitudeWithinTarget =
    (targetCoordinates.latitude >= firstCoordinates.latitude &&
      targetCoordinates.latitude <= secondCoordinates.latitude) ||
    (targetCoordinates.latitude >= secondCoordinates.latitude &&
      targetCoordinates.latitude <= firstCoordinates.latitude);
  const isLongitudeWithinTarget =
    (targetCoordinates.longitude >= firstCoordinates.longitude &&
      targetCoordinates.longitude <= secondCoordinates.longitude) ||
    (targetCoordinates.longitude >= secondCoordinates.longitude &&
      targetCoordinates.longitude <= firstCoordinates.longitude);
  return isLatitudeWithinTarget && isLongitudeWithinTarget;
}

export function plusCodeHasTrailingZeroes(plusCode: string) {
  // A plus code cannot have trailing zeroes unless it is exactly 9 chars long
  if (plusCode.length !== 9) {
    return false;
  }

  if (!isValidPlusCode(plusCode)) {
    return false;
  }

  const secondPair = plusCode.substring(2, 4);
  const thirdPair = plusCode.substring(4, 6);
  const fourthPair = plusCode.substring(6, 8);

  if (
    (secondPair === "00" && thirdPair === "00" && fourthPair === "00") ||
    (thirdPair === "00" && fourthPair === "00") ||
    fourthPair === "00"
  ) {
    return true;
  }

  return false;
}

export function getAllChildPlusCodes(plusCode: string) {
  if (!plusCodeHasTrailingZeroes(plusCode)) {
    throw new Error("#g4qh7N-invalid-plus-code");
  }

  const segments = plusCodeToFirstFourSegments(plusCode);

  const nonZeroPrefix = segments.reduce((output, segment) => {
    if (segment === "00") {
      return output;
    }
    return output + segment;
  }, "");

  const everySubSegment = Array.from(PLUS_CODE_CHARACTERS).flatMap(
    (firstCharacter) =>
      Array.from(PLUS_CODE_CHARACTERS).map(
        (secondCharacter) => firstCharacter + secondCharacter,
      ),
  );

  const childPlusCodes = everySubSegment.map((subSegment) => {
    const prefix = nonZeroPrefix + subSegment;
    const plusCode = prefix.padEnd(8, "0") + "+";
    return plusCode;
  });

  return childPlusCodes;
}

export function getMapLayer(layerKey?: string) {
  if (typeof layerKey === "undefined" || !(layerKey in MAP_LAYERS)) {
    return;
  }
  return MAP_LAYERS[layerKey as MAP_LAYER_KEY];
}

export function getEventLinkUrl(event: NostrEvent, layerConfig?: MapLayer) {
  if (typeof layerConfig === "undefined") {
    return;
  }
  const linkPath = getFirstTagValueFromEvent(event, "linkPath");
  if (typeof linkPath === "undefined") {
    return;
  }
  const linkBaseUrl = layerConfig.rootUrl;
  const url = urlJoin(linkBaseUrl, linkPath);
  return url;
}
