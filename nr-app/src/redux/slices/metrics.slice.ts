import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  Event,
  isPlusCodeInsidePlusCode,
  NOSTROOTS_METRICS_TYPE_MESSAGES,
  NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS,
} from "@trustroots/nr-common";

export type MetricsState = {
  // Shape: { [pluscode]: { [metricType]: value, ... }, ... }
  metrics: Record<string, Record<string, number>> | null;
  lastUpdated: number | null;
};

const initialState: MetricsState = {
  metrics: null,
  lastUpdated: null,
};

export const metricsSlice = createSlice({
  name: "metrics",
  initialState,
  reducers: {
    updateMetrics: (
      state,
      action: PayloadAction<{
        metricType: string;
        plusCodeMetrics: Record<string, number>;
        event: Event;
      }>,
    ) => {
      const { metricType, plusCodeMetrics, event } = action.payload;

      if (!state.metrics) {
        state.metrics = {};
      }

      // Merge metrics: for each pluscode, add/update the specific metric type
      for (const [plusCode, value] of Object.entries(plusCodeMetrics)) {
        if (!state.metrics[plusCode]) {
          state.metrics[plusCode] = {};
        }
        state.metrics[plusCode][metricType] = value;
      }

      state.lastUpdated = event.created_at;
    },
  },
  selectors: {
    selectData: (state) => state,
    selectMetrics: (state) => state.metrics,
    selectMetricsByPlusCode: (state, plusCode: string) =>
      state.metrics?.[plusCode] ?? null,
    selectPushSubscriptionsMetricByPlusCode: (state, plusCode: string) => {
      if (!state.metrics) {
        return 0;
      }

      let total = 0;
      for (const [metricPlusCode, metricValues] of Object.entries(
        state.metrics,
      )) {
        // Count subscriptions for this exact plus code and broader ancestor areas.
        if (!isPlusCodeInsidePlusCode(metricPlusCode, plusCode)) {
          continue;
        }
        total += metricValues[NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS] ?? 0;
      }

      return total;
    },
    selectMessagesMetricByPlusCode: (state, plusCode: string) => {
      if (!state.metrics) {
        return 0;
      }

      let total = 0;
      for (const [metricPlusCode, metricValues] of Object.entries(
        state.metrics,
      )) {
        if (!isPlusCodeInsidePlusCode(plusCode, metricPlusCode)) {
          continue;
        }

        total += metricValues[NOSTROOTS_METRICS_TYPE_MESSAGES] ?? 0;
      }

      return total;
    },
    selectLastUpdated: (state) => state.lastUpdated,
  },
});

export const metricsActions = metricsSlice.actions;
export const metricsSelectors = metricsSlice.selectors;
