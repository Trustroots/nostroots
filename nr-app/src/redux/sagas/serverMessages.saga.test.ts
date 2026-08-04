import { createMockVerifiedEvent } from "@/test/nostrMocks";
import { SERVER_MESSAGE_KIND } from "@trustroots/nr-common";
import Toast from "react-native-root-toast";
import { put, take } from "redux-saga/effects";
import { rehydrated } from "../actions/startup.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import {
  handleServerMessageEffect,
  isServerMessageEvent,
  subscribeToServerMessages,
} from "./serverMessages.saga";

describe("serverMessages.saga", () => {
  const messageEvent = (tags: string[][] = []) =>
    createMockVerifiedEvent({
      kind: SERVER_MESSAGE_KIND,
      content: "Relay maintenance tonight",
      tags,
    });

  it("recognizes only server-message add-event actions", () => {
    expect(
      isServerMessageEvent(
        addEvent({ event: messageEvent(), fromRelay: "relay" }),
      ),
    ).toBe(true);
    expect(
      isServerMessageEvent(
        addEvent({ event: createMockVerifiedEvent(), fromRelay: "relay" }),
      ),
    ).toBe(false);
    expect(isServerMessageEvent({ type: "other" })).toBe(false);
  });

  it("shows public and correctly targeted server messages", () => {
    const publicMessage = handleServerMessageEffect(
      addEvent({ event: messageEvent(), fromRelay: "relay" }),
    );
    expect(publicMessage.next().value).toMatchObject({ type: "SELECT" });
    expect(publicMessage.next("me").done).toBe(true);
    expect(Toast.show).toHaveBeenCalledWith("Relay maintenance tonight", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });

    const targeted = handleServerMessageEffect(
      addEvent({ event: messageEvent([["p", "me"]]), fromRelay: "relay" }),
    );
    targeted.next();
    expect(targeted.next("me").done).toBe(true);
    expect(Toast.show).toHaveBeenCalledTimes(2);
  });

  it("ignores messages targeted at another user", () => {
    const generator = handleServerMessageEffect(
      addEvent({
        event: messageEvent([["p", "someone-else"]]),
        fromRelay: "relay",
      }),
    );
    generator.next();

    expect(generator.next("me").done).toBe(true);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("subscribes to server messages after rehydration", () => {
    const generator = subscribeToServerMessages();
    expect(generator.next().value).toEqual(take(rehydrated));
    expect(generator.next().value).toEqual(
      put(
        startSubscription({
          filters: [{ kinds: [SERVER_MESSAGE_KIND] }],
          id: "serverMessageSubscription",
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });
});
