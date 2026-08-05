import {
  BoundingBox,
  coordinatesToPlusCode,
  plusCodeToRectangle,
  type PlusCodeShortLength,
} from "@/utils/map.utils";

export interface PlusCodeGridCell {
  plusCode: string;
  heatCount: number;
}

export interface PlusCodeGridProperties extends PlusCodeGridCell {
  selected: boolean;
}

export type GridGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  PlusCodeGridProperties
>;

export type GridLineGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { axis: "horizontal" | "vertical" }
>;

/**
 * Determine plus code precision from MapLibre zoom level.
 * Higher zoom → more precise plus codes → more granular markers.
 *
 *   Zoom 0–3   → 2-char (region-level, ~110km)
 *   Zoom 4–6   → 4-char (area-level, ~5km)
 *   Zoom 7–9   → 6-char (neighborhood, ~250m)
 *   Zoom 10+   → 8-char (building-level, ~14m)
 *
 * Capped at 8 so the grid never has to draw the thousands of cells a
 * 10-char (~3m) precision would put inside a single viewport.
 */
/**
 * A latitudeDelta spans the visible height of the map, and each zoom level
 * halves that span. Zoom 0 shows roughly 180° of latitude.
 */
export function latitudeDeltaToZoom(latitudeDelta: number): number {
  if (!(latitudeDelta > 0)) return 12;
  return Math.min(20, Math.max(0, Math.log2(180 / latitudeDelta)));
}

export function zoomToPlusCodeLength(zoom: number): PlusCodeShortLength {
  if (zoom <= 3) return 2;
  if (zoom <= 6) return 4;
  if (zoom <= 9) return 6;
  return 8;
}

/**
 * The grid cell containing a pressed point.
 *
 * MapLibre's press hitbox is 44x44 pixels, so the `features` reported for a
 * press include every cell intersecting that box — near a boundary the first
 * of them is often the neighbour rather than the cell actually pressed. The
 * grid tiles the plane exactly, so deriving the cell from the press
 * coordinates is both simpler and always right.
 */
export function gridPlusCodeForLngLat(
  [longitude, latitude]: [longitude: number, latitude: number],
  length: PlusCodeShortLength,
): string {
  return coordinatesToPlusCode({ latitude, longitude, length });
}

/**
 * Turn the visible plus code cells into polygon features for the grid layers.
 *
 * A cell counts as selected when it contains the selected plus code or is
 * contained by it, so the highlight survives a change of grid precision.
 */
/**
 * Reduce a plus code to its significant prefix so codes of different
 * precisions can be compared. "0" is not in the plus code alphabet, so
 * trailing zeroes are always padding rather than real digits.
 *
 *   "8FVC2200+" → "8FVC22"
 */
function significantPrefix(plusCode: string): string {
  return plusCode.replace("+", "").replace(/0+$/, "");
}

export function plusCodeGridToGeoJSON(
  cells: PlusCodeGridCell[],
  selectedPlusCode: string | undefined,
): GridGeoJSON {
  const features: GeoJSON.Feature<GeoJSON.Polygon, PlusCodeGridProperties>[] =
    [];

  for (const { plusCode, heatCount } of cells) {
    let corners;
    try {
      corners = plusCodeToRectangle(plusCode);
    } catch {
      continue;
    }

    const ring: GeoJSON.Position[] = corners.map(({ latitude, longitude }) => [
      longitude,
      latitude,
    ]);
    ring.push(ring[0]);

    const cellPrefix = significantPrefix(plusCode);
    const selectedPrefix = selectedPlusCode
      ? significantPrefix(selectedPlusCode)
      : undefined;

    const selected =
      typeof selectedPrefix === "string" &&
      (selectedPrefix.startsWith(cellPrefix) ||
        cellPrefix.startsWith(selectedPrefix));

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { plusCode, heatCount, selected },
    });
  }

  return { type: "FeatureCollection", features };
}

const GRID_COORD_PRECISION = 12;

function normalizeGridCoord(value: number): number {
  return Number(value.toFixed(GRID_COORD_PRECISION));
}

/**
 * Build horizontal and vertical grid lines directly from viewport bounds.
 *
 * This avoids iterating every visible plus code cell just to recover the same
 * regular line spacing.
 */
export function plusCodeGridLinesToGeoJSON(
  boundingBox: BoundingBox | undefined,
  length: PlusCodeShortLength | undefined,
): GridLineGeoJSON {
  if (!boundingBox || !length) {
    return { type: "FeatureCollection", features: [] };
  }

  const minLat = normalizeGridCoord(boundingBox.southWest.latitude);
  const maxLat = normalizeGridCoord(boundingBox.northEast.latitude);
  const minLng = normalizeGridCoord(boundingBox.southWest.longitude);
  const maxLng = normalizeGridCoord(boundingBox.northEast.longitude);

  const anchorPlusCode = coordinatesToPlusCode({
    latitude: minLat,
    longitude: minLng,
    length,
  });

  let anchorRect;
  try {
    anchorRect = plusCodeToRectangle(anchorPlusCode);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }

  const anchorSouth = normalizeGridCoord(anchorRect[0].latitude);
  const anchorWest = normalizeGridCoord(anchorRect[0].longitude);
  const stepLat = normalizeGridCoord(anchorRect[1].latitude - anchorSouth);
  const stepLng = normalizeGridCoord(anchorRect[2].longitude - anchorWest);

  if (!(stepLat > 0) || !(stepLng > 0)) {
    return { type: "FeatureCollection", features: [] };
  }

  const startLatIndex = Math.floor((minLat - anchorSouth) / stepLat);
  const endLatIndex = Math.ceil((maxLat - anchorSouth) / stepLat);
  const startLngIndex = Math.floor((minLng - anchorWest) / stepLng);
  const endLngIndex = Math.ceil((maxLng - anchorWest) / stepLng);

  const features: GridLineGeoJSON["features"] = [];

  for (let i = startLatIndex; i <= endLatIndex; i += 1) {
    const latitude = normalizeGridCoord(anchorSouth + i * stepLat);
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [minLng, latitude],
          [maxLng, latitude],
        ],
      },
      properties: { axis: "horizontal" },
    });
  }

  for (let i = startLngIndex; i <= endLngIndex; i += 1) {
    const longitude = normalizeGridCoord(anchorWest + i * stepLng);
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [longitude, minLat],
          [longitude, maxLat],
        ],
      },
      properties: { axis: "vertical" },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Create a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
