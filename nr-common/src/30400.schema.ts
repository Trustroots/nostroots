import {
  NOSTROOTS_METRICS_KIND,
  NOSTROOTS_METRICS_SUPPORTED_TYPES,
  NOSTROOTS_METRICS_TYPE_TAG_NAME,
} from "../constants.ts";
import { z } from "../deps.ts";
import { baseEventSchema } from "./base.schema.ts";
import { isPlusCode } from "./utils.ts";

function getTagValues(tags: string[][], tagName: string): string[] {
  return tags.filter(([name]) => name === tagName).map((tag) => tag[1]);
}

function getSingleSupportedMetricsType(tags: string[][]) {
  const typeValues = getTagValues(tags, NOSTROOTS_METRICS_TYPE_TAG_NAME);
  if (typeValues.length !== 1) {
    return null;
  }

  const metricsType = typeValues[0];
  const isSupported = (
    NOSTROOTS_METRICS_SUPPORTED_TYPES as readonly string[]
  ).includes(metricsType);
  if (!isSupported) {
    return null;
  }

  return metricsType;
}

function getSingleDTagValue(tags: string[][]) {
  const dValues = getTagValues(tags, "d");
  if (dValues.length !== 1) {
    return null;
  }

  const dValue = dValues[0]?.trim();
  if (!dValue) {
    return null;
  }

  return dValue;
}

export const kind30400EventSchema = baseEventSchema
  .extend({
    kind: z.literal(NOSTROOTS_METRICS_KIND),
    content: z.string().min(2),
  })
  .superRefine((event, ctx) => {
    const dTagValue = getSingleDTagValue(event.tags);
    if (dTagValue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tags"],
        message:
          "event must have exactly one non-empty d tag to be parameterized replaceable",
      });
      return;
    }

    const metricsType = getSingleSupportedMetricsType(event.tags);
    if (metricsType === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tags"],
        message: `event must have exactly one ${NOSTROOTS_METRICS_TYPE_TAG_NAME} tag with a supported metrics type: ${NOSTROOTS_METRICS_SUPPORTED_TYPES.join(
          ", ",
        )}`,
      });
      return;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(event.content);
    } catch (_error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "content must be valid JSON",
      });
      return;
    }

    const isObject =
      typeof decoded === "object" &&
      decoded !== null &&
      !Array.isArray(decoded);
    if (!isObject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "content must be a JSON object whose keys are plus codes",
      });
      return;
    }

    const entries = Object.entries(decoded as Record<string, unknown>);
    for (const [plusCode, value] of entries) {
      if (!isPlusCode(plusCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: `content key \"${plusCode}\" must be a valid plus code`,
        });
      }

      const requiresNonNegativeInt =
        metricsType === "push-subscriptions" ||
        metricsType === "messages-single" ||
        metricsType === "messages-total";
      if (requiresNonNegativeInt) {
        const isNonNegativeInteger =
          typeof value === "number" && Number.isInteger(value) && value >= 0;
        if (!isNonNegativeInteger) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["content"],
            message:
              "content values must be non-negative integers for the current metrics type",
          });
        }
      }
    }
  });

export type Kind30400Event = z.infer<typeof kind30400EventSchema>;
