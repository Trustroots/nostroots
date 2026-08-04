import { MAP_LAYERS } from "@trustroots/nr-common";
import {
  addOpenLocationCodePrefixToFilter,
  filterForMapLayerConfig,
  filterForMapLayerConfigForPlusCodePrefixes,
  getTrustrootsMapFilter,
  openLocationCodePrefixFilter,
  trustrootsMapFilterForPlusCodePrefixes,
} from "./utils";

describe("common/utils", () => {
  it("creates the Trustroots map filter", () => {
    expect(getTrustrootsMapFilter()).toMatchObject({
      kinds: [30398],
    });
  });

  it("creates plus-code prefix filters", () => {
    expect(openLocationCodePrefixFilter(["9F4G"])).toEqual({
      "#L": ["open-location-code-prefix"],
      "#l": ["9F4G"],
    });
  });

  it("combines map filters with plus-code prefixes", () => {
    expect(addOpenLocationCodePrefixToFilter({ kinds: [1] }, ["9F4G"])).toEqual(
      {
        "#L": ["open-location-code-prefix"],
        "#l": ["9F4G"],
        kinds: [1],
      },
    );
  });

  it("builds Trustroots map filters for plus-code prefixes", () => {
    expect(trustrootsMapFilterForPlusCodePrefixes(["9F4G"])).toMatchObject({
      "#l": ["9F4G"],
      kinds: [30398],
    });
  });

  it("builds layer filters", () => {
    const layer = MAP_LAYERS.trustroots;

    expect(filterForMapLayerConfig(layer)).toMatchObject({
      kinds: [layer.kind],
    });
    expect(
      filterForMapLayerConfigForPlusCodePrefixes(layer, ["9F4G"]),
    ).toMatchObject({
      "#l": ["9F4G"],
      kinds: [layer.kind],
    });
  });
});
