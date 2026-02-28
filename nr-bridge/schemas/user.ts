// Note that this ZOD schema was derived from the trustroots.org JS codebase.
// This ZOD file doesn't exist in the other repo, but was AI generated based on the code.

import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const ObjectIdSchema = z.string().regex(objectIdRegex, "Invalid ObjectId");

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 34;
const ACQUISITION_STORY_MAX_LENGTH = 500;

const usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;
const dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/;

const UserMemberSchema = z.object({
  tribe: ObjectIdSchema,
  since: z.coerce.date().default(() => new Date()),
});

const UserPushRegistrationSchema = z.object({
  platform: z.enum(["android", "ios", "web", "expo"]),
  token: z.string().min(1),
  created: z.coerce.date().default(() => new Date()),
  deviceId: z.string().trim().optional(),
});

const UserSchema = z.object({
  _id: ObjectIdSchema.optional(),

  firstName: z.string().min(1, "Please fill in your first name."),
  lastName: z.string().min(1, "Please fill in your last name."),
  displayName: z.string().optional(),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please fill a valid email address."),

  emailTemporary: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .or(z.literal(""))
    .default(""),

  tagline: z.string().default(""),
  description: z.string().default(""),

  birthdate: z.coerce.date().nullable().optional(),

  gender: z.enum(["", "female", "male", "non-binary", "other"]).default(""),

  languages: z.array(z.string()).default([]),

  locationLiving: z.string().optional(),
  locationFrom: z.string().optional(),

  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(
      USERNAME_MIN_LENGTH,
      `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    )
    .max(
      USERNAME_MAX_LENGTH,
      `Username must be at most ${USERNAME_MAX_LENGTH} characters.`,
    )
    .regex(
      usernameRegex,
      'Username may only contain a-z, 0-9, ".", "-", and "_", and must include at least one alphanumeric character.',
    )
    .refine((val) => dotsRegex.test(val), {
      message:
        'Username must not begin or end with "." and must not contain consecutive dots.',
    }),

  usernameUpdated: z.coerce.date().optional(),

  extSitesCouchers: z.string().trim().optional(),
  extSitesBW: z.string().trim().optional(),
  extSitesCS: z.string().trim().optional(),
  extSitesWS: z.string().trim().optional(),

  nostrNpub: z
    .string()
    .trim()
    .refine(
      (val) => !val || val.toLowerCase().startsWith("npub"),
      {
        message:
          'Nostr key must start with "npub" (public key). Never use your nsec (secret key).',
      },
    )
    .optional(),

  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    )
    .default(""),

  emailHash: z.string().optional(),
  salt: z.string().optional(),

  provider: z.string().default("local"),
  providerData: z.record(z.unknown()).optional(),
  additionalProvidersData: z
    .object({
      facebook: z.object({ id: z.string() }).passthrough().optional(),
      twitter: z.object({ screen_name: z.string() }).passthrough().optional(),
      github: z.object({ login: z.string() }).passthrough().optional(),
    })
    .passthrough()
    .optional(),

  roles: z
    .array(
      z.enum([
        "admin",
        "moderator",
        "shadowban",
        "suspended",
        "user",
        "volunteer-alumni",
        "volunteer",
      ]),
    )
    .default(["user"]),

  seen: z.coerce.date().optional(),
  updated: z.coerce.date().optional(),
  created: z.coerce.date().default(() => new Date()),

  avatarSource: z
    .enum(["none", "gravatar", "facebook", "local"])
    .default("gravatar"),
  avatarUploaded: z.boolean().default(false),

  newsletter: z.boolean().default(false),

  locale: z.string().default(""),

  passwordUpdated: z.coerce.date().optional(),
  emailToken: z.string().optional(),

  public: z.boolean().default(false),

  publicReminderCount: z.number().int().optional(),
  publicReminderSent: z.coerce.date().optional(),

  welcomeSequenceSent: z.coerce.date().optional(),
  welcomeSequenceStep: z.number().int().min(0).default(0),

  resetPasswordToken: z.string().optional(),
  resetPasswordExpires: z.coerce.date().optional(),

  removeProfileToken: z.string().optional(),
  removeProfileExpires: z.coerce.date().optional(),

  member: z.array(UserMemberSchema).default([]),
  pushRegistration: z.array(UserPushRegistrationSchema).default([]),

  blocked: z.array(ObjectIdSchema).default([]),

  acquisitionStory: z
    .string()
    .max(
      ACQUISITION_STORY_MAX_LENGTH,
      `Acquisition story must be at most ${ACQUISITION_STORY_MAX_LENGTH} characters.`,
    )
    .default(""),
});

const UserProfileUpdateSchema = UserSchema.pick({
  firstName: true,
  lastName: true,
  tagline: true,
  description: true,
  birthdate: true,
  gender: true,
  languages: true,
  locationLiving: true,
  locationFrom: true,
  username: true,
  extSitesCouchers: true,
  extSitesBW: true,
  extSitesCS: true,
  extSitesWS: true,
  nostrNpub: true,
  avatarSource: true,
  avatarUploaded: true,
  newsletter: true,
  locale: true,
}).partial();

const UserPublicProfileSchema = UserSchema.pick({
  displayName: true,
  username: true,
  gender: true,
  tagline: true,
  description: true,
  locationFrom: true,
  locationLiving: true,
  languages: true,
  birthdate: true,
  seen: true,
  created: true,
  updated: true,
  passwordUpdated: true,
  avatarSource: true,
  avatarUploaded: true,
  member: true,
  extSitesCouchers: true,
  extSitesBW: true,
  extSitesCS: true,
  extSitesWS: true,
  nostrNpub: true,
  emailHash: true,
}).extend({
  _id: ObjectIdSchema.optional(),
  id: z.string().optional(),
  replyRate: z.number().optional(),
  replyTime: z.number().optional(),
  additionalProvidersData: z
    .object({
      facebook: z.object({ id: z.string() }).optional(),
      twitter: z.object({ screen_name: z.string() }).optional(),
      github: z.object({ login: z.string() }).optional(),
    })
    .optional(),
  memberIds: z.array(z.string()).optional(),
  usernameUpdateAllowed: z.boolean().optional(),
  isVolunteer: z.boolean().optional(),
  isVolunteerAlumni: z.boolean().optional(),
});

const UserMiniProfileSchema = UserSchema.pick({
  displayName: true,
  username: true,
  avatarSource: true,
  avatarUploaded: true,
  emailHash: true,
}).extend({
  _id: ObjectIdSchema.optional(),
  id: z.string().optional(),
  updated: z.coerce.date().optional(),
  additionalProvidersData: z
    .object({
      facebook: z.object({ id: z.string() }).optional(),
    })
    .optional(),
});

export {
  ACQUISITION_STORY_MAX_LENGTH, ObjectIdSchema,
  PASSWORD_MIN_LENGTH, UserMemberSchema, UserMiniProfileSchema, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, UserProfileUpdateSchema,
  UserPublicProfileSchema, UserPushRegistrationSchema, UserSchema
};

export type User = z.infer<typeof UserSchema>;
export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;
export type UserPublicProfile = z.infer<typeof UserPublicProfileSchema>;
export type UserMiniProfile = z.infer<typeof UserMiniProfileSchema>;
