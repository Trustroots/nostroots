import {
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
} from "@trustroots/nr-common";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { startSubscription } from "../actions/subscription.actions";
import { MAP_SUBSCRIPTION_ID, mapActions } from "../slices/map.slice";
import { createMapFilters, updateDataForMapSagaEffect } from "./map.saga";
import { put } from "redux-saga/effects";

describe("map.saga", () => {
  it("builds the Trustroots filter plus enabled layer filters", () => {
    const filters = createMapFilters(["8F", "9F"], ["hitchwiki", "unverified"]);

    expect(filters).toHaveLength(3);
    expect(filters[0]).toEqual({
      kinds: [MAP_NOTE_REPOST_KIND],
      authors: [NOSTROOTS_VALIDATION_PUBKEY],
      "#L": ["open-location-code-prefix"],
      "#l": ["8F", "9F"],
    });
    expect(filters[1]).toMatchObject({ kinds: [30399], limit: 500 });
    expect(filters[2]).toMatchObject({ kinds: [30397], limit: 500 });
  });

  it("updates map loading state and starts the map subscription", () => {
    const generator = updateDataForMapSagaEffect(setVisiblePlusCodes(["8F"]));
    expect(generator.next().value).toMatchObject({ type: "SELECT" });
    expect(
      generator.next({
        visiblePlusCodes: ["8F"],
        enabledLayerKeys: [],
      }).value,
    ).toEqual(put(mapActions.setMapSubscriptionIsUpdating(true)));
    expect(generator.next().value).toEqual(
      put(
        startSubscription({
          filters: createMapFilters(["8F"], []),
          id: MAP_SUBSCRIPTION_ID,
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });

  it("reports map subscription setup failures", () => {
    const generator = updateDataForMapSagaEffect(setVisiblePlusCodes(["8F"]));
    generator.next();

    expect(generator.throw(new Error("bad map filter")).value).toEqual(
      put({ type: "fail", action: "bad map filter" }),
    );
  });
});
