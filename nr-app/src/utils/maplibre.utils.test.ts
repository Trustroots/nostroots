import { plusCodeToRectangle } from "@/utils/map.utils";
import {
  debounce,
  gridPlusCodeForLngLat,
  plusCodeGridLinesToGeoJSON,
  plusCodeGridToGeoJSON,
  zoomToPlusCodeLength,
} from "./maplibre.utils";

// ---------------------------------------------------------------------------
// Tests: zoomToPlusCodeLength
// ---------------------------------------------------------------------------

describe("zoomToPlusCodeLength", () => {
  it("returns 2 for zoom 0–3", () => {
    expect(zoomToPlusCodeLength(0)).toBe(2);
    expect(zoomToPlusCodeLength(3)).toBe(2);
  });

  it("returns 4 for zoom 4–6", () => {
    expect(zoomToPlusCodeLength(4)).toBe(4);
    expect(zoomToPlusCodeLength(6)).toBe(4);
  });

  it("returns 6 for zoom 7–9", () => {
    expect(zoomToPlusCodeLength(7)).toBe(6);
    expect(zoomToPlusCodeLength(9)).toBe(6);
  });

  it("returns 8 for zoom 10–12", () => {
    expect(zoomToPlusCodeLength(10)).toBe(8);
    expect(zoomToPlusCodeLength(12)).toBe(8);
  });

  it("caps at 8 for zoom 13+", () => {
    expect(zoomToPlusCodeLength(13)).toBe(8);
    expect(zoomToPlusCodeLength(18)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Tests: plusCodeGridToGeoJSON
// ---------------------------------------------------------------------------

describe("plusCodeGridToGeoJSON", () => {
  it("returns an empty FeatureCollection for no cells", () => {
    expect(plusCodeGridToGeoJSON([], undefined)).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("emits one closed polygon ring per cell", () => {
    const { features } = plusCodeGridToGeoJSON(
      [{ plusCode: "8FVC2222+", heatCount: 0 }],
      undefined,
    );

    expect(features).toHaveLength(1);
    const ring = features[0].geometry.coordinates[0];
    // 4 corners plus a repeated first corner to close the ring
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    // GeoJSON is [longitude, latitude]
    expect(ring[0][0]).toBeGreaterThan(0);
  });

  it("carries plusCode and heatCount through as properties", () => {
    const { features } = plusCodeGridToGeoJSON(
      [{ plusCode: "8FVC2222+", heatCount: 3 }],
      undefined,
    );

    expect(features[0].properties).toMatchObject({
      plusCode: "8FVC2222+",
      heatCount: 3,
      selected: false,
    });
  });

  it("marks a cell selected when the selected plus code is inside it", () => {
    const { features } = plusCodeGridToGeoJSON(
      [{ plusCode: "8FVC2200+", heatCount: 0 }],
      "8FVC2222+",
    );

    expect(features[0].properties.selected).toBe(true);
  });

  it("marks a cell selected when it sits inside the selected plus code", () => {
    const { features } = plusCodeGridToGeoJSON(
      [{ plusCode: "8FVC2222+", heatCount: 0 }],
      "8FVC2200+",
    );

    expect(features[0].properties.selected).toBe(true);
  });

  it("leaves unrelated cells unselected", () => {
    const { features } = plusCodeGridToGeoJSON(
      [{ plusCode: "8FVC2222+", heatCount: 0 }],
      "9GXX3333+",
    );

    expect(features[0].properties.selected).toBe(false);
  });

  it("skips cells whose plus code cannot be decoded", () => {
    const { features } = plusCodeGridToGeoJSON(
      [
        { plusCode: "not-a-plus-code", heatCount: 1 },
        { plusCode: "8FVC2222+", heatCount: 1 },
      ],
      undefined,
    );

    expect(features).toHaveLength(1);
    expect(features[0].properties.plusCode).toBe("8FVC2222+");
  });
});

// ---------------------------------------------------------------------------
// Tests: plusCodeGridLinesToGeoJSON
// ---------------------------------------------------------------------------

describe("plusCodeGridLinesToGeoJSON", () => {
  it("returns an empty FeatureCollection when inputs are missing", () => {
    expect(plusCodeGridLinesToGeoJSON(undefined, undefined)).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("generates four boundary lines for a single-cell viewport", () => {
    const [southWest, , northEast] = plusCodeToRectangle("8FVC2222+");
    const result = plusCodeGridLinesToGeoJSON({ southWest, northEast }, 8);

    expect(result.features).toHaveLength(4);
    expect(
      result.features.every(
        (feature) => feature.geometry.type === "LineString",
      ),
    ).toBe(true);

    const horizontalCount = result.features.filter(
      (feature) => feature.properties.axis === "horizontal",
    ).length;
    const verticalCount = result.features.filter(
      (feature) => feature.properties.axis === "vertical",
    ).length;

    expect(horizontalCount).toBe(2);
    expect(verticalCount).toBe(2);
  });

  it("returns empty when precision length is missing", () => {
    const [southWest, , northEast] = plusCodeToRectangle("8FVC2222+");
    const result = plusCodeGridLinesToGeoJSON(
      { southWest, northEast },
      undefined,
    );

    expect(result).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("covers a viewport fully inside one cell with boundary lines", () => {
    const [southWest, , northEast] = plusCodeToRectangle("8FVC2222+");
    const inset = {
      southWest: {
        latitude:
          southWest.latitude + (northEast.latitude - southWest.latitude) * 0.25,
        longitude:
          southWest.longitude +
          (northEast.longitude - southWest.longitude) * 0.25,
      },
      northEast: {
        latitude:
          southWest.latitude + (northEast.latitude - southWest.latitude) * 0.75,
        longitude:
          southWest.longitude +
          (northEast.longitude - southWest.longitude) * 0.75,
      },
    };
    const result = plusCodeGridLinesToGeoJSON(inset, 8);

    expect(result.features).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Tests: debounce
// ---------------------------------------------------------------------------

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("delays invocation by the specified time", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on repeated calls", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    jest.advanceTimersByTime(300);
    debounced(); // reset
    jest.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls the function with the latest arguments", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced("first");
    debounced("second");
    jest.advanceTimersByTime(500);

    expect(fn).toHaveBeenCalledWith("second");
  });
});

describe("gridPlusCodeForLngLat", () => {
  it("returns a code in the same form as the drawn grid cells", () => {
    expect(gridPlusCodeForLngLat([8.5, 47.3], 6)).toBe("8FVC8G00+");
    expect(gridPlusCodeForLngLat([8.5, 47.3], 8)).toBe("8FVC8G22+");
  });

  it("resolves a tap near a cell edge to the cell that contains it", () => {
    const cell = "8FVC8G00+";
    const [sw, , ne] = plusCodeToRectangle(cell);
    const epsilon = 0.000001;

    // Just inside each corner — the case the 44px press hitbox got wrong.
    expect(
      gridPlusCodeForLngLat([sw.longitude + epsilon, sw.latitude + epsilon], 6),
    ).toBe(cell);
    expect(
      gridPlusCodeForLngLat([ne.longitude - epsilon, ne.latitude - epsilon], 6),
    ).toBe(cell);

    // Just outside lands in a neighbouring cell, so the boundary is not fudged.
    expect(
      gridPlusCodeForLngLat([sw.longitude - epsilon, sw.latitude - epsilon], 6),
    ).not.toBe(cell);
  });
});
