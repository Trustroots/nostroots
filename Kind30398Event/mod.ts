import { z } from "zod";

import { version as PACKAGE_VERSION } from "./deno.json" with { type: "json" };
export const CONTENT_MINIMUM_LENGTH = 3;
export const CONTENT_MAXIMUM_LENGTH = 300;

function isHex(s: string) {
  return s.split("").every((c) => "0123456789abcdef".split("").includes(c));
}

function isPlusCode(code: string) {
  const re =
    /(^|\s)([23456789C][23456789CFGHJMPQRV][23456789CFGHJMPQRVWX]{6}\+[23456789CFGHJMPQRVWX]{2,7})(\s|$)/i;
  return re.test(code);
}

export const eventSchema = z
  .object({
    id: z.string().length(32),
    pubkey: z.string().length(32),
    kind: z.number(),
    created_at: z.number(),
    tags: z.string().array().array(),
    content: z.string(),
    sig: z.string(),
  })
  .strict();

export type Event = z.infer<typeof eventSchema>;

function hasOLC(tags: string[][]): boolean {
  const namespaces = tags
    .filter((tag) => tag[0] === "L")
    .map((tag) => tag.slice(1))
    .flat();
  const hasOLCNamespace = namespaces.includes("open-location-code");
  if (!hasOLCNamespace) return false;

  const plusCodeTags = tags.filter(
    (tag) => tag.length > 3 && tag[0] === "l" && tag[2] === "open-location-code"
  );
  if (plusCodeTags.length === 0) return false;

  const plusCodes = plusCodeTags.map((plusCodeTag) => plusCodeTag[1]);
  const validPlusCodes = plusCodes.every(isPlusCode);

  if (!validPlusCodes) return false;

  return true;
}

function hasVersion(tags: string[][]): boolean {
  const versionTags = tags.filter((tag) => tag[0] === "kind30398_version");
  if (versionTags.length !== 1) return false;
  const versionTag = versionTags[0];
  if (versionTag.length !== 2) return false;
  const version = versionTag[1];
  if (version !== PACKAGE_VERSION) return false
  return true
}

export const kind30398EventSchema = eventSchema.extend({
  kind: z.literal(30398),
  tags: z
    .string()
    .array()
    .array()
    .refine(hasOLC, { message: "no valid open-location-code label" })
    .refine(hasVersion, { message: "no valid kind30398_version" }),
  content: z.string().max(CONTENT_MAXIMUM_LENGTH, `content is above max length of ${CONTENT_MAXIMUM_LENGTH}`).min(CONTENT_MINIMUM_LENGTH, `content is below min length of ${CONTENT_MINIMUM_LENGTH}`)
});

export type Kind30398Event = z.infer<typeof kind30398EventSchema>;
