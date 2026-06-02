import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Event } from "@trustroots/nr-common";

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
    selectLastUpdated: (state) => state.lastUpdated,
  },
});

export const metricsActions = metricsSlice.actions;
export const metricsSelectors = metricsSlice.selectors;
