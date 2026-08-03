import { createMockVerifiedEvent } from "@/test/nostrMocks";
import {
  NOSTROOTS_METRICS_KIND,
  NOSTROOTS_METRICS_SUPPORTED_TYPES,
  NOSTROOTS_METRICS_TYPE_MESSAGES,
  NOSTROOTS_VALIDATION_PUBKEY,
  NOTIFICATION_SERVER_PUBKEY,
} from "@trustroots/nr-common";
import { put, take } from "redux-saga/effects";
import { rehydrated } from "../actions/startup.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import { metricsActions } from "../slices/metrics.slice";
import {
  handleMetricsEventEffect,
  isMetricsEvent,
  subscribeToMetrics,
} from "./metrics.saga";

const metricsEvent = (overrides: Record<string, unknown> = {}) =>
  createMockVerifiedEvent({
    kind: NOSTROOTS_METRICS_KIND,
    content: JSON.stringify({ "8FVC0000+": 7 }),
    tags: [["t", NOSTROOTS_METRICS_TYPE_MESSAGES]],
    ...overrides,
  });

describe("metrics.saga", () => {
  it("recognizes only metrics add-event actions", () => {
    expect(
      isMetricsEvent(addEvent({ event: metricsEvent(), fromRelay: "relay" })),
    ).toBe(true);
    expect(
      isMetricsEvent(
        addEvent({
          event: createMockVerifiedEvent({ kind: 1 }),
          fromRelay: "relay",
        }),
      ),
    ).toBe(false);
    expect(isMetricsEvent({ type: "something/else" })).toBe(false);
  });

  it("dispatches parsed metrics snapshots", () => {
    const event = metricsEvent();
    const generator = handleMetricsEventEffect(
      addEvent({ event, fromRelay: "relay" }),
    );

    expect(generator.next().value).toEqual(
      put(
        metricsActions.updateMetrics({
          metricType: NOSTROOTS_METRICS_TYPE_MESSAGES,
          plusCodeMetrics: { "8FVC0000+": 7 },
          event,
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });

  it.each([
    ["non-metrics events", createMockVerifiedEvent({ kind: 1 })],
    ["missing metric type", metricsEvent({ tags: [] })],
    ["unsupported metric type", metricsEvent({ tags: [["t", "unknown"]] })],
    ["malformed JSON", metricsEvent({ content: "{" })],
    ["array content", metricsEvent({ content: "[]" })],
    ["null content", metricsEvent({ content: "null" })],
  ])("ignores %s", (_case, event) => {
    const generator = handleMetricsEventEffect(
      addEvent({ event, fromRelay: "relay" }),
    );

    expect(generator.next().done).toBe(true);
  });

  it("subscribes to trusted metrics snapshots after rehydration", () => {
    const generator = subscribeToMetrics();

    expect(generator.next().value).toEqual(take(rehydrated));
    expect(generator.next().value).toEqual(
      put(
        startSubscription({
          filters: [
            {
              kinds: [NOSTROOTS_METRICS_KIND],
              authors: [
                NOSTROOTS_VALIDATION_PUBKEY,
                NOTIFICATION_SERVER_PUBKEY,
              ],
              "#t": [...NOSTROOTS_METRICS_SUPPORTED_TYPES],
              "#d": ["world"],
            },
          ],
          id: "nostroots-metrics",
        }),
      ),
    );
    expect(generator.next().done).toBe(true);
  });
});
