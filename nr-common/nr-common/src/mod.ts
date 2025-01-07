import { OPEN_LOCATION_CODE_TAG_NAME } from './constants.js';
import { z } from './deps.js';
import { getFirstLabelValueFromEvent, getFirstLabelValueFromTags, isPlusCode } from './utils.js';

// import { version as PACKAGE_VERSION } from "./deno.json" with { type: "json" };
export const CONTENT_MINIMUM_LENGTH = 3;
export const CONTENT_MAXIMUM_LENGTH = 300;

export * from './constants.js';
export * from './utils.js';

const PACKAGE_VERSION = '0.0.1';

export const eventSchema = z
  .object({
    id: z.string().length(64),
    pubkey: z.string().length(64),
    kind: z.number(),
    created_at: z.number(),
    tags: z.string().array().array(),
    content: z.string(),
    sig: z.string(),
  })
  .strict();

export type Event = z.infer<typeof eventSchema>;

function hasOpenLocationCode(tags: string[][]): boolean {
  const namespaces = tags
    .filter((tag) => tag[0] === 'L')
    .map((tag) => tag.slice(1))
    .flat();
  const hasOpenLocationCodeNamespace = namespaces.includes(OPEN_LOCATION_CODE_TAG_NAME);
  if (!hasOpenLocationCodeNamespace) return false;

  const plusCodeTags = tags.filter(
    (tag) => tag.length > 3 && tag[0] === 'l' && tag[2] === OPEN_LOCATION_CODE_TAG_NAME
  );
  if (plusCodeTags.length === 0) return false;

  const plusCodes = plusCodeTags.map((plusCodeTag) => plusCodeTag[1]);
  const validPlusCodes = plusCodes.every(isPlusCode);

  if (!validPlusCodes) return false;

  return true;
}

function hasVersion(tags: string[][]): boolean {
  const versionTags = tags.filter((tag) => tag[0] === 'kind30398_version');
  if (versionTags.length !== 1) return false;
  const versionTag = versionTags[0];
  if (versionTag.length !== 2) return false;
  const version = versionTag[1];
  if (version !== PACKAGE_VERSION) return false;
  return true;
}

export const tagsIncludingPlusCodeSchema = z
  .string()
  .array()
  .array()
  .refine(
    (tags) => {
      const plusCode = getFirstLabelValueFromTags(tags, OPEN_LOCATION_CODE_TAG_NAME);
      if (typeof plusCode === 'undefined' || !isPlusCode(plusCode)) {
        return false;
      }
      return true;
    },
    { message: 'Tags have invalid or missing plus code' }
  );

export const contentSchema = z
  .string()
  .max(CONTENT_MAXIMUM_LENGTH, `content is above max length of ${CONTENT_MAXIMUM_LENGTH}`)
  .min(CONTENT_MINIMUM_LENGTH, `content is below min length of ${CONTENT_MINIMUM_LENGTH}`);

export const kind30398EventSchema = eventSchema.extend({
  kind: z.literal(30398),
  // TODO Enable version check
  tags: tagsIncludingPlusCodeSchema,
  // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
  //   message: "no valid kind30398_version",
  // }),
  content: contentSchema,
});

export type Kind30398Event = z.infer<typeof kind30398EventSchema>;

export const kind30397EventSchema = eventSchema.extend({
  kind: z.literal(30397),
  // TODO Enable version check
  tags: tagsIncludingPlusCodeSchema,
  // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
  //   message: "no valid kind30397_version",
  // }),
  content: contentSchema,
});

export function isValidEvent(event: Event) {
  const { kind } = event;
  switch (kind) {
    case 30397: {
      const { success } = kind30397EventSchema.safeParse(event);
      return success;
    }
    case 30398: {
      const { success } = kind30398EventSchema.safeParse(event);
      return success;
    }
  }

  const { success } = eventSchema.safeParse(event);
  return success;
}
