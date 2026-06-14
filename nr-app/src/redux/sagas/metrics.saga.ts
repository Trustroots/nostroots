import { metricsActions } from "@/redux/slices/metrics.slice";
import { rootLogger } from "@/utils/logger.utils";
import {
  NOSTROOTS_METRICS_KIND,
  NOSTROOTS_METRICS_SUPPORTED_TYPES,
  NOSTROOTS_METRICS_TYPE_TAG_NAME,
  NOTIFICATION_SERVER_PUBKEY,
  NOSTROOTS_VALIDATION_PUBKEY,
} from "@trustroots/nr-common";
import { AnyAction } from "redux-saga";
import { all, put, take, takeEvery } from "redux-saga/effects";
import { rehydrated } from "../actions/startup.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";

const log = rootLogger.extend("metrics.saga");
const METRICS_SUBSCRIPTION_ID = "nostroots-metrics";

function isMetricsEvent(action: AnyAction): boolean {
  return (
    addEvent.match(action) &&
    action.payload.event.kind === NOSTROOTS_METRICS_KIND
  );
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

function* metricsEventSaga(): Generator<any, void, any> {
  yield takeEvery(isMetricsEvent, handleMetricsEventEffect);
}

function* subscribeToMetrics() {
  yield take(rehydrated);

  yield put(
    startSubscription({
      filters: [
        {
          kinds: [NOSTROOTS_METRICS_KIND],
          authors: [NOSTROOTS_VALIDATION_PUBKEY, NOTIFICATION_SERVER_PUBKEY],
          "#t": [...NOSTROOTS_METRICS_SUPPORTED_TYPES],
          "#d": ["world"],
        },
      ],
      id: METRICS_SUBSCRIPTION_ID,
    }),
  );
}

export default function* metricsRootSaga(): Generator<any, void, any> {
  yield all([metricsEventSaga(), subscribeToMetrics()]);
}
