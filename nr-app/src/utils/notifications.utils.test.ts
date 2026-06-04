import {
  addFilterToFiltersArray,
  doesFilterMatchParentPlusCode,
  doesFilterMatchPlusCodeExactly,
  filterForPlusCode,
  removeFilterFromFiltersArray,
} from "./notifications.utils";

describe("notifications.utils", () => {
  it("adds filters without duplicates", () => {
    const filter = { filter: { kinds: [1] } };

    expect(addFilterToFiltersArray([], filter)).toEqual([filter]);
    expect(addFilterToFiltersArray([filter], filter)).toEqual([filter]);
  });

  it("removes matching filters", () => {
    const filter = { filter: { kinds: [1] } };
    const otherFilter = { filter: { kinds: [2] } };

    expect(removeFilterFromFiltersArray([filter, otherFilter], filter)).toEqual(
      [otherFilter],
    );
  });

  it("builds map-note filters for plus codes", () => {
    expect(filterForPlusCode("9F4G0000+")).toMatchObject({
      "#l": ["9F4G0000+"],
    });
  });

  it("matches exact plus-code labels", () => {
    expect(
      doesFilterMatchPlusCodeExactly({ "#l": ["9F4G0000+"] }, "9F4G0000+"),
    ).toBe(true);
    expect(doesFilterMatchPlusCodeExactly({ kinds: [1] }, "9F4G0000+")).toBe(
      false,
    );
  });

  it("matches parent plus-code labels", () => {
    expect(
      doesFilterMatchParentPlusCode({ "#l": ["9F4G0000+"] }, "9F4G9Q00+"),
    ).toBe(true);
    expect(doesFilterMatchParentPlusCode({ kinds: [1] }, "9F4G9Q00+")).toBe(
      false,
    );
  });
});
