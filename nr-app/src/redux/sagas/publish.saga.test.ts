import { createMockVerifiedEvent } from "@/test/nostrMocks";
import { publishVerifiedEventToRelay } from "@/nostr/publish.nostr";
import { signEventTemplate } from "@/nostr/keystore.nostr";
import {
  publishEventSagaEffect,
  publishEventTemplateSagaEffect,
} from "./publish.saga";
import {
  publishEventPromiseAction,
  publishEventTemplatePromiseAction,
} from "../actions/publish.actions";
import { runSaga } from "redux-saga";
import { DEFAULT_RELAY_URL } from "@trustroots/nr-common";

jest.mock("@/nostr/publish.nostr", () => ({
  publishVerifiedEventToRelay: jest.fn(async () => "ok"),
}));

jest.mock("@/nostr/keystore.nostr", () => ({
  signEventTemplate: jest.fn(),
}));

describe("publish.saga", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("publishes events to active relays", async () => {
    const dispatched: unknown[] = [];
    const event = createMockVerifiedEvent();
    const action = publishEventPromiseAction.request({ event });
    action.meta.promise = {
      reject: jest.fn(),
      resolve: jest.fn(),
    };

    await runSaga(
      {
        dispatch: (output) => dispatched.push(output),
        getState: () => ({
          relays: {
            relays: {
              [DEFAULT_RELAY_URL]: {
                isActive: true,
                isConnected: false,
                notices: [],
                url: DEFAULT_RELAY_URL,
              },
            },
            subscriptions: {},
          },
        }),
      },
      publishEventSagaEffect,
      action,
    ).toPromise();

    expect(publishVerifiedEventToRelay).toHaveBeenCalledWith(
      event,
      DEFAULT_RELAY_URL,
    );
    expect(dispatched).toContainEqual(
      publishEventPromiseAction.success({
        id: event.id,
        relayResponses: {
          [DEFAULT_RELAY_URL]: "ok",
        },
      }),
    );
    expect(action.meta.promise.resolve).toHaveBeenCalledWith({
      id: event.id,
      relayResponses: {
        [DEFAULT_RELAY_URL]: "ok",
      },
    });
  });

  it("signs and dispatches event templates", async () => {
    const dispatched: unknown[] = [];
    const event = createMockVerifiedEvent();
    (signEventTemplate as jest.Mock).mockResolvedValue(event);
    const eventTemplate = {
      content: "hello",
      created_at: 1,
      kind: 1,
      tags: [],
    };
    const action = publishEventTemplatePromiseAction.request({ eventTemplate });
    action.meta.promise = {
      reject: jest.fn(),
      resolve: jest.fn(),
    };

    await runSaga(
      {
        dispatch: (output) => dispatched.push(output),
      },
      publishEventTemplateSagaEffect,
      action,
    ).toPromise();

    expect(signEventTemplate).toHaveBeenCalledWith(eventTemplate);
    expect(dispatched).toContainEqual(
      publishEventTemplatePromiseAction.success({ event }),
    );
    expect(action.meta.promise.resolve).toHaveBeenCalledWith({ event });
  });
});
