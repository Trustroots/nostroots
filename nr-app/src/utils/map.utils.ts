import {
  DEFAULT_PLUS_CODE_LENGTH,
  NOSTR_EVENT_INDEX_MAXIMUM_PLUS_CODE_LENGTH,
} from "@/constants";
import OpenLocationCode from "open-location-code-typescript";

type PlusCodeShortLength = 2 | 4 | 6 | 8;

const plusCodeCharacters = "23456789CFGHJMPQRVWX" as const;

export function isValidPlusCode(code: string): boolean {
  return OpenLocationCode.isValid(code);
}

export function coordinatesToPlusCode({
  latitude,
  longitude,
  length: codeLength = DEFAULT_PLUS_CODE_LENGTH,
}: {
  latitude: number;
  longitude: number;
  length?: PlusCodeShortLength;
}): string {
  const plusCode = OpenLocationCode.encode(latitude, longitude, codeLength);
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
    throw new Error("Invalid Plus Code #QWEIOKJQWEOK");
  }
}

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
    latitude: latitude - latitudeDelta,
    longitude: longitude - longitudeDelta,
  };
  const topRightCoordinates = {
    latitude: latitude + latitudeDelta,
    longitude: longitude + longitudeDelta,
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

  const bottomRowIndex = plusCodeCharacters.indexOf(bottomRow);
  const topRowIndex = plusCodeCharacters.indexOf(topRow);
  const leftColumnIndex = plusCodeCharacters.indexOf(leftColumn);
  const rightColumnIndex = plusCodeCharacters.indexOf(rightColumn);

  const rows = topRowIndex - bottomRowIndex + 1;
  const columns = rightColumnIndex - leftColumnIndex + 1;

  // Nested iteration
  const parts = Array.from({ length: rows })
    .map((empty, rowIndex) => {
      return Array.from({ length: columns }).map((empty, columnIndex) => {
        const outputRowIndex = bottomRowIndex + rowIndex;
        const outputColumnIndex = leftColumnIndex + columnIndex;

        const rowCode = plusCodeCharacters[outputRowIndex];
        const columnCode = plusCodeCharacters[outputColumnIndex];

        return [rowCode, columnCode];
      });
    })
    .flat();

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
