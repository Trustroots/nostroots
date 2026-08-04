import { getRouterMock } from "@/test/router";
import { ROUTES } from "@/constants/routes";
import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import {
  configureNavigationDispatch,
  navigateToEvent,
} from "./navigation.utils";

jest.mock("./map.utils", () => ({
  getLayerForEvent: jest.fn(() => "trustroots"),
  plusCodeToCoordinates: jest.fn(() => ({
    latitude: 52.52,
    longitude: 13.405,
  })),
}));

describe("navigation.utils", () => {
  it("dispatches map actions and routes home for events", () => {
    const dispatch = jest.fn();
    const event = {
      content: "",
      created_at: 1,
      id: "0".repeat(64),
      kind: 1,
      pubkey: "1".repeat(64),
      sig: "2".repeat(128),
      tags: [],
    };

    configureNavigationDispatch(dispatch);
    navigateToEvent("9F4G0000+", event);

    expect(dispatch).toHaveBeenCalledWith(mapActions.enableLayer("trustroots"));
    expect(dispatch).toHaveBeenCalledWith(
      addEvent({ event, fromRelay: "notification" }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      mapActions.setCurrentMapLocation({
        latitude: 52.52,
        longitude: 13.405,
      }),
    );
    expect(getRouterMock().dismissTo).toHaveBeenCalledWith(ROUTES.HOME);
  });
});
