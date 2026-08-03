import {
  NOSTROOTS_METRICS_TYPE_MESSAGES,
  NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS,
} from "@trustroots/nr-common";
import { createMockVerifiedEvent } from "@/test/nostrMocks";
import {
  metricsActions,
  metricsSelectors,
  metricsSlice,
} from "./metrics.slice";

describe("metrics.slice", () => {
  it("merges metric types without replacing existing snapshots", () => {
    const event = createMockVerifiedEvent({ created_at: 100 });
    let state = metricsSlice.reducer(
      undefined,
      metricsActions.updateMetrics({
        metricType: NOSTROOTS_METRICS_TYPE_MESSAGES,
        plusCodeMetrics: { "8F000000+": 12, "8FVC0000+": 4 },
        event,
      }),
    );

    state = metricsSlice.reducer(
      state,
      metricsActions.updateMetrics({
        metricType: NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS,
        plusCodeMetrics: { "8F000000+": 3 },
        event: createMockVerifiedEvent({ created_at: 200 }),
      }),
    );

    expect(metricsSelectors.selectMetrics.unwrapped(state)).toEqual({
      "8F000000+": {
        [NOSTROOTS_METRICS_TYPE_MESSAGES]: 12,
        [NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS]: 3,
      },
      "8FVC0000+": { [NOSTROOTS_METRICS_TYPE_MESSAGES]: 4 },
    });
    expect(metricsSelectors.selectLastUpdated.unwrapped(state)).toBe(200);
  });

  it("selects exact plus-code snapshots and reports missing data", () => {
    const emptyState = metricsSlice.getInitialState();

    expect(metricsSelectors.selectData.unwrapped(emptyState)).toBe(emptyState);
    expect(
      metricsSelectors.selectMetricsByPlusCode.unwrapped(
        emptyState,
        "8FVC9G00+",
      ),
    ).toBeNull();
    expect(
      metricsSelectors.selectPushSubscriptionsMetricByPlusCode.unwrapped(
        emptyState,
        "8FVC9G00+",
      ),
    ).toBe(0);
    expect(
      metricsSelectors.selectMessagesMetricByPlusCode.unwrapped(
        emptyState,
        "8FVC9G00+",
      ),
    ).toBe(0);
  });

  it("aggregates subscriptions inherited from broader areas", () => {
    const state = {
      metrics: {
        "8F000000+": { [NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS]: 5 },
        "8FVC0000+": { [NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS]: 3 },
        "8FVC9G00+": { [NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS]: 2 },
        "9F000000+": { [NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS]: 99 },
      },
      lastUpdated: 1,
    };

    expect(
      metricsSelectors.selectPushSubscriptionsMetricByPlusCode.unwrapped(
        state,
        "8FVC9G8F+",
      ),
    ).toBe(10);
  });

  it("aggregates messages from an area and its descendants", () => {
    const state = {
      metrics: {
        "8F000000+": { [NOSTROOTS_METRICS_TYPE_MESSAGES]: 100 },
        "8FVC0000+": { [NOSTROOTS_METRICS_TYPE_MESSAGES]: 10 },
        "8FVC9G00+": { [NOSTROOTS_METRICS_TYPE_MESSAGES]: 4 },
        "9F000000+": { [NOSTROOTS_METRICS_TYPE_MESSAGES]: 99 },
      },
      lastUpdated: 1,
    };

    expect(
      metricsSelectors.selectMessagesMetricByPlusCode.unwrapped(
        state,
        "8FVC0000+",
      ),
    ).toBe(14);
  });
});
