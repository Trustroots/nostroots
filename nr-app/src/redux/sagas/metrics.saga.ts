import { startSubscription } from "@/redux/actions/subscription.actions";
import { metricsActions, metricsSelectors } from "@/redux/slices/metrics.slice";
import { rootLogger } from "@/utils/logger.utils";
import {
  DEFAULT_RELAY_URL,
  NOSTROOTS_METRICS_KIND,
  NOSTROOTS_METRICS_SUPPORTED_TYPES,
  NOSTROOTS_METRICS_TYPE_TAG_NAME,
} from "@trustroots/nr-common";
import { all, put, select, takeEvery } from "redux-saga/effects";
import { addEvent } from "../slices/events.slice";
import { RootState } from "../store";

const log = rootLogger.extend("metrics.saga");
const METRICS_SUBSCRIPTION_ID = "nostroots-metrics";

function* subscribeToMetricsEffect(): Generator<any, void, any> {
  yield put(
    startSubscription({
      filters: [
        {
          kinds: [NOSTROOTS_METRICS_KIND],
          "#t": [...NOSTROOTS_METRICS_SUPPORTED_TYPES],
          "#d": ["world"],
        },
      ],
      id: METRICS_SUBSCRIPTION_ID,
      relayUrls: [DEFAULT_RELAY_URL],
    }),
  );

  log.debug("#4K7m2i Subscribed to all metrics types", {
    types: NOSTROOTS_METRICS_SUPPORTED_TYPES,
  });
}

function* handleMetricsEventEffect(
  action: ReturnType<typeof addEvent>,
): Generator<any, void, any> {
  const { event } = action.payload;

  // Only process metrics events
  if (event.kind !== NOSTROOTS_METRICS_KIND) {
    return;
  }

  // Extract metric type from t-tag
  const tTag = event.tags.find(
    ([name]) => name === NOSTROOTS_METRICS_TYPE_TAG_NAME,
  );
  if (!tTag) {
    log.warn("#2X9mL3 Missing metric type tag");
    return;
  }

  const metricType = tTag[1];
  if (
    !(NOSTROOTS_METRICS_SUPPORTED_TYPES as readonly string[]).includes(
      metricType,
    )
  ) {
    log.warn("#2X9mL3 Unsupported metric type", { metricType });
    return;
  }

  // Parse metrics from content
  let plusCodeMetrics: Record<string, number>;
  try {
    plusCodeMetrics = JSON.parse(event.content);
    if (
      typeof plusCodeMetrics !== "object" ||
      plusCodeMetrics === null ||
      Array.isArray(plusCodeMetrics)
    ) {
      log.warn("#5H1mK9 Invalid metrics content format");
      return;
    }
  } catch (error) {
    log.warn("#8Q2pL6 Failed to parse metrics content", error);
    return;
  }

  yield put(
    metricsActions.updateMetrics({ metricType, plusCodeMetrics, event }),
  );
  log.debug("#9J3kR8 Updated metrics", {
    metricType,
    plusCodes: Object.keys(plusCodeMetrics).length,
  });
}

function* initializeMetricsSubscriptionEffect(): Generator<any, void, any> {
  const currentState: RootState = yield select();
  const hasMetricsData = metricsSelectors.selectMetrics(currentState) !== null;

  if (!hasMetricsData) {
    yield* subscribeToMetricsEffect();
  }
}

function* metricsEventSaga(): Generator<any, void, any> {
  yield takeEvery(addEvent, handleMetricsEventEffect);
}

function* metricsInitSaga(): Generator<any, void, any> {
  // Initialize metrics subscription after store is ready
  yield takeEvery("persist/REHYDRATE", initializeMetricsSubscriptionEffect);
}

export default function* metricsRootSaga(): Generator<any, void, any> {
  yield all([metricsInitSaga(), metricsEventSaga()]);
}
